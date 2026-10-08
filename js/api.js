/* The Board: API client. Every network call in the UI goes through the `API` object below.
 * Same methods in both modes; only the transport differs (see js/config.js and docs/API.md). */
class ApiError extends Error {
  constructor(status, code, message, fields) { super(message); this.status = status; this.code = code; this.fields = fields || null; }
}

const API = (() => {
  const cfg = Object.assign({ mode: 'mock', apiBase: '/api/v1', useCookies: false, pollMs: null, mockLatency: [120, 320], mockPersist: true, demoLogins: false }, window.BOARD_CONFIG || {});
  const isMock = cfg.mode === 'mock';
  const TOKEN_KEY = 'board.token', MOCK_KEY = 'board.mock.v3';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} }
  };
  let token = store.get(TOKEN_KEY), onUnauth = () => {}, mock = null, saveT = null;

  if (isMock) {
    if (/[?&]resetmock\b/.test(location.search)) store.set(MOCK_KEY, null);
    let state = null;
    if (cfg.mockPersist) { try { state = JSON.parse(store.get(MOCK_KEY)); } catch (_) {} }
    mock = new MockServer({
      state: state && state.listings ? state : null,
      onChange: s => { if (!cfg.mockPersist) return; clearTimeout(saveT); saveT = setTimeout(() => store.set(MOCK_KEY, JSON.stringify(s)), 200); }
    });
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
    if (status === 401 && token) { token = null; store.set(TOKEN_KEY, null); onUnauth(); }
    throw new ApiError(status, e.code || 'error', e.message || 'Something went wrong. Try again.', e.fields);
  }

  async function request(method, path, o) {
    o = o || {};
    const query = {}; Object.keys(o.query || {}).forEach(k => { if (o.query[k] != null && o.query[k] !== '') query[k] = o.query[k]; });
    if (isMock) {
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
  const setToken = t => { token = t; store.set(TOKEN_KEY, t); };

  return {
    isMock, cfg,
    pollMs: cfg.pollMs || (isMock ? 1500 : 4000),
    onUnauthenticated(fn) { onUnauth = fn; },
    hasToken: () => !!token,
    resetMock() { if (mock) { mock.reset(); store.set(MOCK_KEY, null); } },

    meta: () => get('/meta'),
    top: () => get('/top'),
    recommended: params => get('/recommended', params),
    areas: async () => (await get('/areas')).items,

    async signup(b) { const r = await post('/auth/signup', b); setToken(r.token); return r.user; },
    async login(b) { const r = await post('/auth/login', b); setToken(r.token); return r.user; },
    async logout() { try { await post('/auth/logout'); } catch (_) {} setToken(null); },
    async me() { const r = await get('/auth/me'); return r.user; },

    listings: (params, o) => get('/listings', params, o),
    listing: async (id, o) => (await get('/listings/' + encodeURIComponent(id), null, o)).listing,
    createListing: async b => (await post('/listings', b)).listing,
    myListings: async () => (await get('/me/listings')).items,
    dashboard: () => get('/me/dashboard'),
    async upgrade() { return (await post('/auth/upgrade')).user; },
    upload: (file, purpose) => request('POST', '/uploads', { file, purpose }),

    reviews: (id, o) => get('/listings/' + encodeURIComponent(id) + '/reviews', null, o),
    postReview: async (id, b) => (await post('/listings/' + encodeURIComponent(id) + '/reviews', b)).review,

    unread: async () => (await get('/unread')).count,
    threads: async (as, listingId) => (await get('/threads', { as, listingId })).items,
    openThread: async (listingId, text) => (await post('/threads', { listingId, text })).thread,
    thread: (id, as) => get('/threads/' + encodeURIComponent(id), { as }),
    newMessages: async (id, after, as) => (await get('/threads/' + encodeURIComponent(id) + '/messages', { after, as })).items,
    sendMessage: async (id, text, as) => (await post('/threads/' + encodeURIComponent(id) + '/messages', { text }, { as })).message,
    markRead: (id, as) => post('/threads/' + encodeURIComponent(id) + '/read', null, { as }),
    completeAppointment: async (id, as) => (await post('/threads/' + encodeURIComponent(id) + '/complete', null, { as })).thread,
    report: (id, reason, as) => post('/threads/' + encodeURIComponent(id) + '/report', { reason }, { as }),

    demoAppointment: listingId => post('/demo/appointments', { listingId })   // mock only
  };
})();
