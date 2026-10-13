/* The Board: API client. Every network call in the UI goes through the `API` object below.
 * Same methods in both modes; only the transport differs (see js/config.js and docs/API.md). */
class ApiError extends Error {
  constructor(status, code, message, fields) { super(message); this.status = status; this.code = code; this.fields = fields || null; }
}

const API = (() => {
  const cfg = Object.assign({ mode: 'mock', apiBase: '/api/v1', useCookies: false, pollMs: null, mockLatency: [120, 320], mockPersist: true, demoLogins: false }, window.BOARD_CONFIG || {});
  const isMock = cfg.mode === 'mock';
  /* Supabase: real listings are read from (and new ones sent to) Supabase; the rest is the in-browser demo. */
  const SB = isMock && cfg.supabase && cfg.supabase.url && cfg.supabase.key ? cfg.supabase : null;
  const TOKEN_KEY = 'board.token', MOCK_KEY = SB ? 'board.demo.sb1' : 'board.mock.v3', AUTHED_KEY = 'board.authed';
  /* With cookies (the real backend) the session lives in an HttpOnly cookie that scripts cannot read.
     We only keep a "probably logged in" hint here, so the page knows to ask the server who you are. */
  const cookieMode = !isMock && cfg.useCookies;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} }
  };
  let token = cookieMode ? null : store.get(TOKEN_KEY), authed = cookieMode ? store.get(AUTHED_KEY) === '1' : !!token, onUnauth = () => {}, mock = null, saveT = null;
  if (cookieMode) store.set(TOKEN_KEY, null); // never keep an old bearer token around

  if (isMock) {
    if (/[?&]resetmock\b/.test(location.search)) store.set(MOCK_KEY, null);
    let state = null;
    if (cfg.mockPersist) { try { state = JSON.parse(store.get(MOCK_KEY)); } catch (_) {} }
    mock = new MockServer({
      state: state && state.listings ? state : null, external: !!SB, autoReply: !SB,
      onChange: s => { if (!cfg.mockPersist) return; clearTimeout(saveT); saveT = setTimeout(() => store.set(MOCK_KEY, JSON.stringify(s)), 200); }
    });
  }

  /* ---------- Supabase listings ---------- */
  const SB_SUBS = { Hair: ['Barbers', 'Braids'], Nails: ['Gel & BIAB', 'Acrylics', 'Nail art'], Lashes: [], Food: ['Cakes & bakes', 'Meal prep', 'Hot meals', 'Snacks'], Photography: ['Grad shoots', 'Portraits', 'Events'] };
  const SUB_TO_CAT = {}; Object.keys(SB_SUBS).forEach(c => SB_SUBS[c].forEach(s => { SUB_TO_CAT[s] = c; }));
  const SB_AREAS = ['City centre', 'Lenton', 'Radford', 'Beeston', 'West Bridgford', 'Sneinton', 'Online'];
  const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  function rowToListing(kind, r) {
    const base = { id: (kind === 'services' ? 'sb_b_' : 'sb_s_') + r.id, kind, status: 'live', external: true, example: false, ownerId: 'u_supabase',
      name: txt(r.name, 80) || 'Untitled', desc: txt(r.description, 300), contact: txt(r.contact, 120), avatarId: null, bannerId: null, photoIds: [],
      policy: null, sections: [], promoted: r.promoted === true, createdAt: r.created_at || new Date().toISOString() };
    if (kind === 'services') {
      const what = txt(r.what, 40), price = txt(r.price, 30).replace(/^from\s*/i, ''), loc = txt(r.location, 60);
      const area = SB_AREAS.find(a => a.toLowerCase() === loc.toLowerCase()) || null;
      return Object.assign(base, { cat: SUB_TO_CAT[what] || (SB_SUBS[what] ? what : 'Other'), sub: what || null, area,
        meta: [loc].filter(Boolean), menu: price ? [{ group: null, items: [{ name: what || 'Price', price }] }] : [] });
    }
    return Object.assign(base, { cat: txt(r.what, 40) || 'Other', sub: null, area: null, menu: [], meta: txt(r.meet, 120).split(',').map(s => s.trim()).filter(Boolean) });
  }
  async function sbGet(table) {
    const res = await fetch(SB.url + '/rest/v1/' + table + '?select=*&order=created_at.desc', { headers: { apikey: SB.key, Accept: 'application/json' } });
    if (!res.ok) throw new Error(table + ' ' + res.status);
    return res.json();
  }
  let sbLoaded = null;
  const sbReady = () => {
    if (!SB) return Promise.resolve();
    if (!sbLoaded) sbLoaded = Promise.all([sbGet('businesses'), sbGet('societies')])
      .then(([b, s]) => mock.setExternal(b.map(r => rowToListing('services', r)).concat(s.map(r => rowToListing('socs', r)))))
      .catch(e => { console.warn('[board] could not load listings from Supabase', e); mock.setExternal([]); sbLoaded = null; });
    return sbLoaded;
  };
  /* A new listing goes to Supabase and waits there until it's approved. Pictures stay in this browser. */
  async function sbCreate(b) {
    const priceOf = () => { const v = [].concat(...(b.menu || []).filter(g => g.group !== 'Add-ons').map(g => (g.items || []).map(i => { const m = String(i.price).match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; }))).filter(x => !isNaN(x)); return v.length ? 'From £' + Math.min(...v) : ''; };
    const table = b.kind === 'services' ? 'businesses' : 'societies';
    const row = b.kind === 'services'
      ? { name: txt(b.name, 80), what: txt(b.sub || b.cat, 40), price: txt(priceOf(), 30), location: txt(b.area || (b.meta || [])[0], 60), description: txt(b.desc, 300), contact: txt(b.contact, 120) }
      : { name: txt(b.name, 80), what: txt(b.cat, 40), meet: txt((b.meta || []).join(', '), 120), description: txt(b.desc, 300), contact: txt(b.contact, 120) };
    if (!row.name || !row.contact) throw new ApiError(400, 'validation_failed', 'Add a name and a way to contact you.');
    let res;
    try { res = await fetch(SB.url + '/rest/v1/' + table, { method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(row) }); }
    catch (_) { throw new ApiError(0, 'network', 'Can’t reach the Board right now. Check your connection and try again.'); }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new ApiError(res.status, 'error', /too many/i.test(t) ? 'Lots of listings are being sent right now. Try again in an hour.' : 'We couldn’t send your listing. Check the details and try again.');
    }
    return { id: 'pending', kind: b.kind, name: row.name, status: 'pending' };
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const fileToUpload = (blob, purpose) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res({ type: blob.type, size: blob.size, dataUrl: fr.result, purpose });
    fr.onerror = () => rej(new ApiError(400, 'validation_failed', 'That file could not be read.'));
    fr.readAsDataURL(blob);
  });

  function fail(status, body) {
    const e = (body && body.error) || {};
    if (status === 401 && authed && !(body && body.error && body.error.code === 'invalid_credentials')) { setAuthed(null); onUnauth(); }
    throw new ApiError(status, e.code || 'error', e.message || 'Something went wrong. Try again.', e.fields);
  }

  async function request(method, path, o) {
    o = o || {};
    const query = {}; Object.keys(o.query || {}).forEach(k => { if (o.query[k] != null && o.query[k] !== '') query[k] = o.query[k]; });
    if (isMock) {
      await sbReady();
      const [a, b] = cfg.mockLatency || [0, 0];
      await sleep(a + Math.random() * (b - a));
      const upload = o.file ? await fileToUpload(o.file, o.purpose) : null;
      const r = await mock.handle({ method, path, query, body: clone(o.body), token, upload });
      if (r.status >= 400) fail(r.status, r.body);
      return clone(r.body);
    }
    const qs = new URLSearchParams(query).toString();
    const headers = { Accept: 'application/json' };
    let body;
    if (o.file) { body = new FormData(); body.append('file', o.file, o.file.name || 'upload'); body.append('purpose', o.purpose || 'photo'); }
    else if (o.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(o.body); }
    if (token && !cfg.useCookies) headers.Authorization = 'Bearer ' + token;
    let res;
    try {
      res = await fetch(cfg.apiBase.replace(/\/$/, '') + path + (qs ? '?' + qs : ''), { method, headers, body, signal: o.signal, credentials: cfg.useCookies ? 'include' : 'same-origin' });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new ApiError(0, 'network', 'Can’t reach the server. Check your connection and try again.');
    }
    let data = null;
    if (res.status !== 204) { try { data = await res.json(); } catch (_) {} }
    if (!res.ok) fail(res.status, data);
    return data;
  }

  const get = (p, query, o) => request('GET', p, Object.assign({ query }, o));
  const post = (p, body, query, o) => request('POST', p, Object.assign({ body: body || {}, query }, o));
  /* t: the bearer token (demo / token mode), true (cookie mode), or null (logged out). */
  const setAuthed = t => {
    authed = !!t;
    if (cookieMode) store.set(AUTHED_KEY, authed ? '1' : null);
    else { token = typeof t === 'string' ? t : null; store.set(TOKEN_KEY, token); }
  };
  const loggedIn = r => { setAuthed(cookieMode ? true : r.token); return r.user; };

  return {
    isMock, cfg,
    pollMs: cfg.pollMs || (isMock ? 1500 : 4000),
    onUnauthenticated(fn) { onUnauth = fn; },
    hasToken: () => authed,
    resetMock() { if (mock) { mock.reset(); store.set(MOCK_KEY, null); } },

    meta: () => get('/meta'),
    top: () => get('/top'),
    recommended: params => get('/recommended', params),
    promoted: params => get('/promoted', params),
    areas: async () => (await get('/areas')).items,

    /* Returns { pending: true, email } when the server wants the email confirmed first (the real backend),
       or { user } when the account is ready straight away (demo mode). */
    async signup(b) { const r = await post('/auth/signup', b); if (r && r.user) return { user: loggedIn(r) }; return { pending: true, email: (r && r.email) || b.email }; },
    async login(b) { return loggedIn(await post('/auth/login', b)); },
    async logout() { try { await post('/auth/logout'); } catch (_) {} setAuthed(null); },
    async verifyEmail(t) { return loggedIn(await post('/auth/verify', { token: t })); },
    resendVerification: email => post('/auth/resend-verification', { email }),
    forgotPassword: (email, turnstileToken) => post('/auth/forgot', { email, turnstileToken }),
    async resetPassword(t, password) { return loggedIn(await post('/auth/reset', { token: t, password })); },
    async me() { const r = await get('/auth/me'); return r.user; },

    listings: (params, o) => get('/listings', params, o),
    listing: async (id, o) => (await get('/listings/' + encodeURIComponent(id), null, o)).listing,
    createListing: async b => (SB ? sbCreate(b) : (await post('/listings', b)).listing),
    isSupabase: !!SB,
    myListings: async () => (await get('/me/listings')).items,
    myProfile: () => get('/me/profile'),
    saveProfile: b => post('/me/profile', b),
    userProfile: id => get('/users/' + encodeURIComponent(id)),
    addLateFee: async (threadId, amount, minutes, as) => (await post('/threads/' + encodeURIComponent(threadId) + '/late-fee', { amount, minutes }, { as })).lateFee,
    setLateFee: async (id, status) => (await post('/late-fees/' + encodeURIComponent(id), { status })).lateFee,
    dashboard: () => get('/me/dashboard'),
    authConfig: () => get('/auth/config'),
    exportUrl: () => cfg.apiBase.replace(/\/$/, '') + '/me/export',
    async deleteAccount(password) { await post('/me/delete', { password }); setAuthed(null); },
    async upgrade() { return (await post('/auth/upgrade')).user; },
    upload: (file, purpose) => request('POST', '/uploads', { file, purpose }),

    reviews: (id, o) => get('/listings/' + encodeURIComponent(id) + '/reviews', null, o),
    postReview: async (id, b) => (await post('/listings/' + encodeURIComponent(id) + '/reviews', b)).review,

    unread: async () => (await get('/unread')).count,
    threads: async (as, listingId) => (await get('/threads', { as, listingId })).items,
    openThread: async (listingId, text) => (await post('/threads', { listingId, text })).thread,
    thread: (id, as) => get('/threads/' + encodeURIComponent(id), { as }),
    /* { items, otherReadAt, otherTyping }: new messages plus read receipts and "typing…" for the open chat */
    chatPoll: (id, after, as) => get('/threads/' + encodeURIComponent(id) + '/messages', { after, as }),
    typing: (id, as) => post('/threads/' + encodeURIComponent(id) + '/typing', null, { as }),
    newMessages: async (id, after, as) => (await get('/threads/' + encodeURIComponent(id) + '/messages', { after, as })).items,
    sendMessage: async (id, text, as) => (await post('/threads/' + encodeURIComponent(id) + '/messages', { text }, { as })).message,
    markRead: (id, as) => post('/threads/' + encodeURIComponent(id) + '/read', null, { as }),
    completeAppointment: async (id, as) => (await post('/threads/' + encodeURIComponent(id) + '/complete', null, { as })).thread,
    report: (id, reason, as) => post('/threads/' + encodeURIComponent(id) + '/report', { reason }, { as }),

    demoAppointment: listingId => post('/demo/appointments', { listingId })   // mock only
  };
})();
