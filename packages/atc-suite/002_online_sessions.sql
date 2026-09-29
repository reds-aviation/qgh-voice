-- Separate relay for QGH / surveillance / SRA / PAR. Does not modify Procedural rooms.
begin;
create table if not exists atc_private.suite_rooms (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  host_key uuid not null, pin text not null unique, host_revision bigint not null default 0,
  seen_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '8 hours',
  closed boolean not null default false
);
create table if not exists atc_private.suite_members (
  room_id uuid not null references atc_private.suite_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting', seat_token text, revision bigint not null default 0,
  primary key(room_id,user_id)
);
create table if not exists atc_private.suite_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references atc_private.suite_rooms(id) on delete cascade,
  recipient uuid not null references auth.users(id) on delete cascade,
  body jsonb not null, created_at timestamptz not null default now()
);
create index if not exists suite_messages_room_recipient on atc_private.suite_messages(room_id,recipient,id);
alter table atc_private.suite_rooms enable row level security;
alter table atc_private.suite_members enable row level security;
alter table atc_private.suite_messages enable row level security;
revoke all on atc_private.suite_rooms,atc_private.suite_members,atc_private.suite_messages from public,anon,authenticated;
revoke all on sequence atc_private.suite_messages_id_seq from public,anon,authenticated;

create or replace function public.atc_suite_session(p_action text,p_room uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  who uuid:=auth.uid(); r atc_private.suite_rooms%rowtype; m atc_private.suite_members%rowtype;
  item jsonb; target uuid; kind text; host boolean; token text; candidate text; rev bigint; cursor_id bigint;
begin
  if who is null then return '{"error":"Open an authenticated session.","status":401}'::jsonb; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>600000 then
    return '{"error":"Invalid online request.","status":400}'::jsonb;
  end if;
  if p_action='create' then
    if not atc_private.take_limit('suite-create',12,3600) then return '{"error":"Too many rooms. Try later.","status":429}'::jsonb; end if;
    perform pg_advisory_xact_lock(470292);
    delete from atc_private.suite_rooms where expires_at<now();
    if (select count(*) from atc_private.suite_rooms where not closed)>=40 then return '{"error":"Online pilot capacity reached. Use This device or try later.","status":429}'::jsonb; end if;
    loop
      candidate:=lpad(floor(random()*1000000)::int::text,6,'0');
      exit when not exists(select 1 from atc_private.suite_rooms where pin=candidate);
    end loop;
    insert into atc_private.suite_rooms(owner_id,host_key,pin) values(who,(p_payload->>'hostKey')::uuid,candidate) returning * into r;
    return jsonb_build_object('id',r.id,'sessionId',r.id::text,'channelName','online-'||r.id::text,'pin',r.pin);
  elsif p_action='join' then
    if not atc_private.take_limit('suite-join',12,60) then return '{"error":"Too many PIN attempts. Wait a minute.","status":429}'::jsonb; end if;
    if coalesce(p_payload->>'pin','')!~'^[0-9]{6}$' then return '{"error":"Enter six digits.","status":400}'::jsonb; end if;
    select * into r from atc_private.suite_rooms where pin=p_payload->>'pin' and not closed and expires_at>now() and seen_at>now()-interval '15 seconds' for update;
    if not found then return '{"error":"Incorrect PIN or instructor offline. Select Online room on both devices.","status":403}'::jsonb; end if;
    if r.owner_id=who then return '{"error":"Use the controller position in another window.","status":409}'::jsonb; end if;
    if (select count(*) from atc_private.suite_members where room_id=r.id)>=24 and not exists(select 1 from atc_private.suite_members where room_id=r.id and user_id=who) then return '{"error":"Room request limit reached.","status":429}'::jsonb; end if;
    insert into atc_private.suite_members(room_id,user_id) values(r.id,who) on conflict do nothing;
    return jsonb_build_object('id',r.id,'sessionId',r.id::text,'channelName','online-'||r.id::text,'pin',r.pin);
  end if;
  select * into r from atc_private.suite_rooms where id=p_room for update;
  if not found or r.expires_at<now() then return '{"error":"Room expired. Request a new PIN.","status":410}'::jsonb; end if;
  host:=r.owner_id=who;
  select * into m from atc_private.suite_members where room_id=r.id and user_id=who;
  if not host and m.user_id is null then return '{"error":"This is not your room.","status":403}'::jsonb; end if;
  if host and (p_payload->>'hostKey')::uuid is distinct from r.host_key then return '{"error":"Instructor connection required.","status":403}'::jsonb; end if;
  if p_action='close' and host then
    update atc_private.suite_rooms set closed=true where id=r.id;
    return '{"closed":true}'::jsonb;
  end if;
  if p_action<>'exchange' then return '{"error":"Unsupported operation.","status":400}'::jsonb; end if;
  if not atc_private.take_limit('suite-exchange',180,60) then return '{"error":"Connection is sending too quickly.","status":429}'::jsonb; end if;
  if jsonb_typeof(p_payload->'messages') is distinct from 'array' or jsonb_array_length(p_payload->'messages')>32 then return '{"error":"Invalid message batch.","status":400}'::jsonb; end if;
  cursor_id:=greatest(0,coalesce((p_payload->>'cursor')::bigint,0));
  delete from atc_private.suite_messages where room_id=r.id and recipient=who and id<=cursor_id;
  delete from atc_private.suite_messages where room_id=r.id and created_at<now()-interval '10 minutes';
  if jsonb_array_length(p_payload->'messages')>0 and
    (select count(*) from atc_private.suite_messages where room_id=r.id)>1000 then
    return '{"error":"Waiting for the other display to catch up. Reconnect it before continuing.","status":429}'::jsonb;
  end if;
  -- Validate the whole batch before changing membership or consuming revisions.
  for item in select value from jsonb_array_elements(p_payload->'messages') loop
    kind:=item->>'type';
    if item->>'sessionId' is distinct from r.id::text or item->>'senderId' is distinct from who::text
      or item->>'senderRole' is distinct from (case when host then 'instructor' else 'student' end)
      or item->>'protocol' is distinct from '1' or jsonb_typeof(item->'payload') is distinct from 'object'
      or coalesce(item->>'revision','')!~'^[0-9]{1,15}$' or octet_length(item::text)>65536 then
      return '{"error":"Invalid session message.","status":403}'::jsonb;
    end if;
    if host then
      if kind not in ('admission-granted','admission-rejected','lifecycle','public-metadata','observation','caption','host-heartbeat','student-disconnected','terminated') or kind is null then return '{"error":"Unsupported instructor message.","status":403}'::jsonb; end if;
      -- Never accept a complete instructor simulation or a truth/history payload.
      if item->'payload' ?| array['aircraft','aircraftList','truth','events','history','simulation'] then return '{"error":"Share only controller observations.","status":403}'::jsonb; end if;
      if item->>'targetClientId' is not null and not exists(select 1 from atc_private.suite_members where room_id=r.id and user_id::text=item->>'targetClientId') then return '{"error":"Unknown controller.","status":403}'::jsonb; end if;
    else
      -- A final poll may carry an already-queued heartbeat. Ignore it after
      -- close, but still deliver the instructor's termination notice.
      if r.closed then continue; end if;
      if kind not in ('join-request','rejoin-request','ready','student-heartbeat','preferences','pilot-playback') or kind is null or item->'payload'->>'clientId' is distinct from who::text then return '{"error":"Controller operation unavailable.","status":403}'::jsonb; end if;
      if kind='join-request' then
        if item->'payload'->>'pin' is distinct from r.pin or item->'payload'->>'seat' is distinct from 'controller' then return '{"error":"Incorrect PIN.","status":403}'::jsonb; end if;
      elsif m.status<>'admitted' or item->'payload'->>'seatToken' is distinct from m.seat_token then return '{"error":"Wait for instructor admission.","status":403}'::jsonb;
      end if;
      if r.closed or r.seen_at<now()-interval '15 seconds' then return '{"error":"Instructor offline. Reconnect when available.","status":410}'::jsonb; end if;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(p_payload->'messages') loop
    kind:=item->>'type'; rev:=(item->>'revision')::bigint;
    if not host and r.closed then continue; end if;
    if rev<=(case when host then r.host_revision else m.revision end) then continue; end if;
    if host then
      if r.closed then return '{"error":"Room closed.","status":410}'::jsonb; end if;
      target:=(item->>'targetClientId')::uuid;
      if kind='admission-granted' then
        if target is null or length(coalesce(item->'payload'->>'seatToken','')) not between 16 and 64 then raise exception 'Invalid admission'; end if;
        if exists(select 1 from atc_private.suite_members where room_id=r.id and status='admitted' and user_id<>target) then raise exception 'Release the current controller first'; end if;
        update atc_private.suite_members set status='admitted',seat_token=item->'payload'->>'seatToken' where room_id=r.id and user_id=target;
      elsif kind in ('admission-rejected','terminated') then
        update atc_private.suite_members set status='rejected',seat_token=null where room_id=r.id and (target is null or user_id=target);
        delete from atc_private.suite_messages where room_id=r.id and (target is null or recipient=target) and recipient<>r.owner_id;
      end if;
      -- Only admission outcomes reach a waiting/rejected identity. Truth is never broadcast.
      for target in select user_id from atc_private.suite_members where room_id=r.id
        and (item->>'targetClientId' is null or user_id::text=item->>'targetClientId')
        and (status='admitted' or kind in ('admission-granted','admission-rejected','terminated')) loop
        if kind in ('observation','host-heartbeat') then delete from atc_private.suite_messages where room_id=r.id and recipient=target and body->>'type'=kind; end if;
        insert into atc_private.suite_messages(room_id,recipient,body) values(r.id,target,item);
      end loop;
      r.host_revision:=rev;
    else
      if kind='student-heartbeat' then delete from atc_private.suite_messages where room_id=r.id and recipient=r.owner_id and body->>'senderId'=who::text and body->>'type'=kind; end if;
      insert into atc_private.suite_messages(room_id,recipient,body) values(r.id,r.owner_id,item);
      m.revision:=rev;
    end if;
  end loop;
  if host and exists(select 1 from jsonb_array_elements(p_payload->'messages') x where x->>'type'='terminated' and coalesce(x->'payload'->>'reason','')<>'seat-released') then r.closed:=true; end if;
  if host then update atc_private.suite_rooms set host_revision=r.host_revision,seen_at=now(),closed=r.closed where id=r.id;
  else update atc_private.suite_members set revision=m.revision where room_id=r.id and user_id=who; end if;
  -- Remove acknowledged delivery records; retries are deduplicated by sender revision.
  delete from atc_private.suite_messages where room_id=r.id and recipient=who and id<=cursor_id;
  delete from atc_private.suite_messages where room_id=r.id and created_at<now()-interval '10 minutes';
  return jsonb_build_object('closed',r.closed,'messages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'body',body) order by id) from (select id,body from atc_private.suite_messages where room_id=r.id and recipient=who and id>cursor_id order by id limit 100) delivery),'[]'::jsonb));
end $$;
revoke all on function public.atc_suite_session(text,uuid,jsonb) from public,anon;
grant execute on function public.atc_suite_session(text,uuid,jsonb) to authenticated;
commit;
