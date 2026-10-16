/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

// Small REST client: no cloud key with elevated privileges and no dependency/CDN at runtime.
export function validRemoteConfig(config) {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config?.url || '') && /^sb_publishable_[A-Za-z0-9_-]+$/.test(config?.publishableKey || '');
}
export function createRemoteService(config, clientId, { fetcher = fetch, storage = sessionStorage, now = Date.now, rpc = 'atc_session' } = {}) {
  if (!validRemoteConfig(config)) throw new Error('Online sessions are not configured yet. Use this-device mode.');
  if (!['atc_session', 'atc_suite_session'].includes(rpc)) throw new Error('Unsupported session service.');
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
      const response = await fetcher(`${config.url}/rest/v1/rpc/${rpc}`, {
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
