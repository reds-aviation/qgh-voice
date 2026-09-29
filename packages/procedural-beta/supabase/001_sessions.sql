-- Run once in the ATC Training Suite Supabase project's SQL editor.
-- Clients use an anonymous Auth identity, never the service-role key.
begin;
create schema if not exists atc_private;
revoke all on schema atc_private from public, anon, authenticated;

create table atc_private.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  local_id uuid not null,
  host_key uuid not null,
  pin text not null unique check (pin ~ '^[0-9]{6}$'),
  exercise_id text,
  sequence bigint not null default 0,
  snapshot jsonb,
  seen_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '8 hours',
  closed boolean not null default false,
  unique(owner_id, local_id)
);
create table atc_private.members (
  room_id uuid not null references atc_private.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  status text not null default 'waiting' check (status in ('waiting','admitted','ready','rejected')),
  primary key (room_id,user_id)
);
create table atc_private.commands (
  id uuid primary key,
  room_id uuid not null references atc_private.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body jsonb not null,
  result jsonb,
  created_at timestamptz not null default now()
);
create index on atc_private.commands (room_id,created_at);
create table atc_private.limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  starts_at timestamptz not null default now(),
  count integer not null default 1,
  primary key(user_id,bucket)
);
create table atc_private.maps (
  room_id uuid primary key references atc_private.rooms(id) on delete cascade,
  image_id text not null check (image_id ~ '^[a-f0-9]{64}$'),
  mime text not null check (mime in ('image/png','image/jpeg')),
  data bytea not null check (octet_length(data) between 1 and 5242880)
);
alter table atc_private.rooms enable row level security;
alter table atc_private.members enable row level security;
alter table atc_private.commands enable row level security;
alter table atc_private.limits enable row level security;
alter table atc_private.maps enable row level security;
revoke all on all tables in schema atc_private from public, anon, authenticated;

create function atc_private.take_limit(p_bucket text, p_limit int, p_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into atc_private.limits(user_id,bucket) values(auth.uid(),p_bucket)
  on conflict (user_id,bucket) do update set
    count = case when atc_private.limits.starts_at < now() - make_interval(secs=>p_seconds) then 1 else atc_private.limits.count + 1 end,
    starts_at = case when atc_private.limits.starts_at < now() - make_interval(secs=>p_seconds) then now() else atc_private.limits.starts_at end
  returning count into n;
  return n <= p_limit;
end $$;

create function atc_private.new_pin() returns text
language plpgsql security definer set search_path = '' as $$
declare candidate text;
begin
  -- Serialise allocation so parallel instructors cannot reserve the same PIN.
  perform pg_advisory_xact_lock(470291);
  loop
    candidate := lpad(floor(random()*1000000)::int::text,6,'0');
    exit when not exists(select 1 from atc_private.rooms where pin=candidate);
  end loop;
  return candidate;
end $$;

create function atc_private.room_view(p_room uuid, p_owner boolean) returns jsonb
language sql security definer set search_path = '' as $$
  select case when p_owner then jsonb_build_object('pin',r.pin,'students',coalesce((
    select jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.name,'status',m.status) order by m.name)
    from atc_private.members m where m.room_id=r.id),'[]'::jsonb))
  else (select jsonb_build_object('name',m.name,'status',case when r.closed or r.expires_at<now() then 'rejected' else m.status end)
        from atc_private.members m where m.room_id=r.id and m.user_id=auth.uid()) end
  from atc_private.rooms r where r.id=p_room;
$$;

-- One narrow API. No table, snapshot or PIN directory is publicly readable.
create function public.atc_session(p_action text, p_room uuid default null, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  who uuid := auth.uid(); r atc_private.rooms%rowtype; m atc_private.members%rowtype;
  c atc_private.commands%rowtype; item jsonb; state jsonb; command_id uuid; ack jsonb;
  host boolean; map_result jsonb; command_type text; map_data bytea; stale boolean;
begin
  if who is null then return jsonb_build_object('error','Open an authenticated session.','status',401); end if;
  if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>7200000 then
    return jsonb_build_object('error','Invalid session request.','status',400);
  end if;
  if p_action='create' then
    if not atc_private.take_limit('create',12,3600) then return jsonb_build_object('error','Too many room requests. Try again later.','status',429); end if;
    perform pg_advisory_xact_lock(470291);
    delete from atc_private.rooms where expires_at<now();
    if (select count(*) from atc_private.rooms where not closed)>=40 then
      return jsonb_build_object('error','The online training pilot is at capacity. Use this-device mode or try later.','status',429);
    end if;
    insert into atc_private.rooms(owner_id,local_id,host_key,pin)
      values(who,(p_payload->>'localId')::uuid,(p_payload->>'hostKey')::uuid,atc_private.new_pin()) returning * into r;
    return jsonb_build_object('id',r.id,'pin',r.pin,'localId',r.local_id,'sequence',r.sequence);
  elsif p_action='join' then
    -- Return errors instead of raising: failed attempts must retain their rate counter.
    if not atc_private.take_limit('join',12,60) then return jsonb_build_object('error','Too many PIN attempts. Wait one minute.','status',429); end if;
    if coalesce(p_payload->>'pin','')!~'^[0-9]{6}$' or length(trim(coalesce(p_payload->>'name',''))) not between 1 and 60 or (p_payload->>'name') ~ '[[:cntrl:]]' then
      return jsonb_build_object('error','Enter your name and the six-digit PIN.','status',400);
    end if;
    select * into r from atc_private.rooms where pin=p_payload->>'pin' and not closed and expires_at>now() and seen_at>now()-interval '15 seconds' for update;
    if not found then return jsonb_build_object('error','Incorrect PIN or instructor offline.','status',403); end if;
    if r.owner_id=who then return jsonb_build_object('error','Open the controller in a separate session.','status',409); end if;
    if (select count(*) from atc_private.members where room_id=r.id)>=24 and not exists(select 1 from atc_private.members where room_id=r.id and user_id=who) then
      return jsonb_build_object('error','This room has reached its controller limit.','status',429);
    end if;
    insert into atc_private.members(room_id,user_id,name) values(r.id,who,trim(p_payload->>'name'))
      on conflict(room_id,user_id) do nothing;
    return jsonb_build_object('id',r.id,'room',atc_private.room_view(r.id,false));
  end if;

  select * into r from atc_private.rooms where id=p_room for update;
  if not found then return jsonb_build_object('error','Session no longer available.','status',404); end if;
  host := r.owner_id=who;
  select * into m from atc_private.members where room_id=r.id and user_id=who;
  if not host and m.user_id is null then return jsonb_build_object('error','This is not your exercise room.','status',403); end if;
  if p_action='poll' and not host then
    stale := r.seen_at<now()-interval '6 seconds' or r.closed or r.expires_at<now();
    state := case when m.status='ready' and not r.closed and r.expires_at>now() then r.snapshot else null end;
    if stale and state is not null then state := state || '{"available":false,"running":false,"radio":{"phase":"idle"},"df":null}'::jsonb; end if;
    return jsonb_build_object('room',atc_private.room_view(r.id,false),'state',state,'sequence',r.sequence,
      'receipts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'result',result)) from atc_private.commands
        where room_id=r.id and user_id=who and result is not null and created_at>now()-interval '5 minutes'),'[]'::jsonb));
  end if;
  if p_action='claim' and host and r.expires_at>now() then
    if r.closed and (select count(*) from atc_private.rooms where not closed and expires_at>now())>=40 then return jsonb_build_object('error','Online rooms are at capacity.','status',429); end if;
    update atc_private.rooms set host_key=(p_payload->>'hostKey')::uuid,seen_at=now(),sequence=sequence+1,
      closed=false,pin=case when closed then atc_private.new_pin() else pin end,
      snapshot=snapshot || '{"running":false,"radio":{"phase":"idle"},"df":null}'::jsonb where id=r.id returning * into r;
    return jsonb_build_object('id',r.id,'pin',r.pin,'localId',r.local_id,'sequence',r.sequence);
  end if;
  if r.closed or r.expires_at<now() then return jsonb_build_object('error','Session ended. Request a new PIN.','status',410); end if;
  if host and (p_payload->>'hostKey')::uuid is distinct from r.host_key then
    return jsonb_build_object('error','This instructor connection was replaced. Reopen the saved exercise.','status',409);
  end if;
  if p_action in ('admit','reject','reset','close','exchange','map-put') and not host then
    return jsonb_build_object('error','Instructor control required.','status',403);
  end if;

  if p_action='room' then return jsonb_build_object('room',atc_private.room_view(r.id,host));
  elsif p_action='ready' and not host then
    if m.status not in ('admitted','ready') then return jsonb_build_object('error','Wait for admission.','status',403); end if;
    update atc_private.members set status='ready' where room_id=r.id and user_id=who;
  elsif p_action in ('admit','reject') then
    update atc_private.members set status=case when p_action='reject' then 'rejected' when status='ready' then 'ready' else 'admitted' end
      where room_id=r.id and user_id=(p_payload->>'studentId')::uuid;
    if p_action='reject' then update atc_private.commands set result='{"status":403,"body":{"error":"Controller removed from room."}}' where room_id=r.id and user_id=(p_payload->>'studentId')::uuid and result is null; end if;
  elsif p_action in ('reset','close') then
    update atc_private.members set status='rejected' where room_id=r.id;
    update atc_private.commands set result='{"status":410,"body":{"error":"Session changed. Request the new PIN."}}' where room_id=r.id and result is null;
    update atc_private.rooms set pin=atc_private.new_pin(),closed=(p_action='close'),seen_at=now() where id=r.id;
  elsif p_action='exchange' then
    state := p_payload->'state';
    if state is null or state->>'role' is distinct from 'student' or state ?| array['aircraft','events','alerts'] or length(coalesce(state->>'exerciseId','')) not between 1 and 100 or octet_length(state::text)>524288 then
      return jsonb_build_object('error','Only the bounded student projection may be shared.','status',400);
    end if;
    if (p_payload->>'sequence')::bigint is null or (p_payload->>'sequence')::bigint<=r.sequence then
      return jsonb_build_object('error','Out-of-order exercise update.','status',409);
    end if;
    if jsonb_typeof(coalesce(p_payload->'receipts','[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_payload->'receipts','[]'::jsonb)) > 32 then
      return jsonb_build_object('error','Invalid command receipts.','status',400);
    end if;
    for ack in select value from jsonb_array_elements(coalesce(p_payload->'receipts','[]'::jsonb)) loop
      if octet_length(ack::text)>8192 then return jsonb_build_object('error','Oversized command receipt.','status',400); end if;
    end loop;
    if r.exercise_id is not null and r.exercise_id is distinct from state->>'exerciseId' then
      update atc_private.members set status='rejected' where room_id=r.id;
      update atc_private.commands set result='{"status":409,"body":{"error":"Exercise was replaced."}}' where room_id=r.id and result is null;
      update atc_private.rooms set pin=atc_private.new_pin() where id=r.id;
    end if;
    update atc_private.rooms set snapshot=state,exercise_id=state->>'exerciseId',sequence=(p_payload->>'sequence')::bigint,seen_at=now() where id=r.id;
    for ack in select value from jsonb_array_elements(coalesce(p_payload->'receipts','[]'::jsonb)) loop
      update atc_private.commands set result=ack->'result' where id=(ack->>'id')::uuid and room_id=r.id and result is null;
    end loop;
    delete from atc_private.commands where room_id=r.id and result is not null and created_at<now()-interval '10 minutes';
    return jsonb_build_object('room',atc_private.room_view(r.id,true),'sequence',(p_payload->>'sequence')::bigint,
      'commands',coalesce((select jsonb_agg(q.body order by q.created_at) from (
        select queued.body,queued.created_at from atc_private.commands queued join atc_private.members n on n.room_id=queued.room_id and n.user_id=queued.user_id
        where queued.room_id=r.id and queued.result is null and n.status='ready' and queued.body->>'exerciseId'=state->>'exerciseId'
        order by queued.created_at limit 32) q),'[]'::jsonb));
  elsif p_action='command' and not host then
    item := p_payload->'command'; command_type := item->>'type';
    if m.status<>'ready' or r.seen_at<now()-interval '6 seconds' then return jsonb_build_object('error','Wait for the instructor connection and Ready.','status',403); end if;
    if command_type not in ('strip','controller-call') or command_type is null or item->>'exerciseId' is distinct from r.exercise_id or octet_length(item::text)>8192 then
      return jsonb_build_object('error','This instruction is not available to the controller.','status',403);
    end if;
    command_id := (item->>'id')::uuid;
    select * into c from atc_private.commands where id=command_id;
    if found then
      if c.room_id<>r.id or c.user_id<>who or c.body<>item then return jsonb_build_object('error','Instruction ID already in use.','status',409); end if;
      return jsonb_build_object('id',c.id,'result',c.result);
    end if;
    if not atc_private.take_limit('command',60,60) or (select count(*) from atc_private.commands where room_id=r.id and result is null)>=200 then
      return jsonb_build_object('error','Too many pending instructions. Wait for the instructor.','status',429);
    end if;
    insert into atc_private.commands(id,room_id,user_id,body) values(command_id,r.id,who,item);
    return jsonb_build_object('id',command_id,'result',null);
  elsif p_action='map-put' then
    map_data := decode(p_payload->>'data','base64');
    if octet_length(map_data) not between 1 and 5242880 or coalesce(p_payload->>'imageId','')!~'^[a-f0-9]{64}$' or
      not ((p_payload->>'mime'='image/png' and substring(map_data from 1 for 4)=decode('89504e47','hex')) or
           (p_payload->>'mime'='image/jpeg' and substring(map_data from 1 for 3)=decode('ffd8ff','hex'))) then
      return jsonb_build_object('error','Choose a PNG or JPEG up to 5 MB.','status',400);
    end if;
    insert into atc_private.maps(room_id,image_id,mime,data) values(r.id,p_payload->>'imageId',p_payload->>'mime',map_data)
      on conflict(room_id) do update set image_id=excluded.image_id,mime=excluded.mime,data=excluded.data;
    return '{"saved":true}'::jsonb;
  elsif p_action='map-get' then
    if not host and (m.status<>'ready' or p_payload->>'imageId' is distinct from r.snapshot#>>'{environment,map,imageId}') then
      return jsonb_build_object('error','Map access requires admission.','status',403);
    end if;
    select jsonb_build_object('data',encode(data,'base64'),'mime',mime) into map_result from atc_private.maps where room_id=r.id and image_id=p_payload->>'imageId';
    return coalesce(map_result,'{"error":"Map is not shared yet.","status":404}'::jsonb);
  else return jsonb_build_object('error','Unsupported session operation.','status',400);
  end if;
  return jsonb_build_object('room',atc_private.room_view(r.id,host));
end $$;
revoke all on all functions in schema atc_private from public, anon, authenticated;
revoke all on function public.atc_session(text,uuid,jsonb) from public, anon;
grant execute on function public.atc_session(text,uuid,jsonb) to authenticated;
commit;
