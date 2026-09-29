// Small REST client: no cloud key with elevated privileges and no dependency/CDN at runtime.
export function validRemoteConfig(config) {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config?.url || '') && /^sb_publishable_[A-Za-z0-9_-]+$/.test(config?.publishableKey || '');
}
export function createRemoteService(config, clientId, { fetcher = fetch, storage = sessionStorage, now = Date.now } = {}) {
  if (!validRemoteConfig(config)) throw new Error('Online sessions are not configured yet. Use this-device mode.');
  const key = `atc-cloud-auth:${clientId}`;
  let auth, authenticating;
  try { auth = JSON.parse(storage.getItem(key) || 'null'); } catch { /* Recover corrupt local auth without leaking it. */ }
  async function read(response) {
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.msg || data.message || data.error_description || data.error || 'Online connection unavailable.'), { status: response.status });
    return data;
  }
  async function authenticate(force = false) {
    if (auth?.access_token && !force && auth.expires_at * 1000 > now() + 60000) return auth;
    if (authenticating) return authenticating;
    authenticating = (async () => {
      const refresh = !!auth?.refresh_token;
      const response = await fetcher(`${config.url}/auth/v1/${refresh ? 'token?grant_type=refresh_token' : 'signup'}`, {
        method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(refresh ? { refresh_token: auth.refresh_token } : {}), signal: AbortSignal.timeout(15000),
      });
      const next = await read(response);
      if (!next.access_token || !next.refresh_token) throw new Error('Enable anonymous sign-ins for the online training project.');
      auth = { access_token: next.access_token, refresh_token: next.refresh_token, expires_at: next.expires_at || Math.floor(now()/1000) + next.expires_in, user: {id: next.user.id} };
      storage.setItem(key, JSON.stringify(auth));
      return auth;
    })();
    try { return await authenticating; } finally { authenticating = null; }
  }
  async function call(action, roomId = null, payload = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const identity = await authenticate(attempt === 1);
      const response = await fetcher(`${config.url}/rest/v1/rpc/atc_session`, {
        method: 'POST', headers: { apikey: config.publishableKey, Authorization: `Bearer ${identity.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_action: action, p_room: roomId, p_payload: payload }), signal: AbortSignal.timeout(15000),
      });
      if (response.status === 401 && attempt === 0) continue;
      const data = await read(response);
      if (data?.error) throw Object.assign(new Error(data.error), { status: data.status || 400 });
      return data;
    }
  }
  return { call, authenticate };
}
