/* The Board: mock backend.
 *
 * A complete in-memory implementation of docs/API.md. It runs two ways:
 *   1. In the browser (config mode "mock"): js/api.js calls MockServer.handle() directly.
 *   2. In Node (server/dev-server.js): the same class answers real HTTP requests.
 * Because both use this one class, the front end can be tested over real HTTP
 * before the real backend exists. The real backend replaces this file entirely.
 *
 * NOT secure: passwords use a toy hash and tokens are random strings. Mock only.
 */
(function (root) {
  const SEED = (typeof module !== 'undefined' && module.exports) ? require('./seed.js') : root.BOARD_SEED;

  const CATS = {
    services: ['Hair', 'Nails', 'Lashes', 'Food', 'Photography', 'Other'],
    socs: ['Culture', 'Sport', 'Tech', 'Arts', 'Faith', 'Academic', 'Other'],
    official: ['University', 'Students’ union']
  };
  /* Areas a business can pick, with a rough centre point. A real backend would geocode a postcode instead. */
  const AREAS = { 'City centre': [52.9540, -1.1550], 'Lenton': [52.9440, -1.1830], 'Radford': [52.9560, -1.1800], 'Beeston': [52.9260, -1.2150],
    'West Bridgford': [52.9300, -1.1300], 'Sneinton': [52.9530, -1.1300], 'Online': null };
  const km = (a, b) => { const r = x => x * Math.PI / 180, dLat = r(b[0] - a[0]), dLng = r(b[1] - a[1]); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const MAX_UPLOAD = 5 * 1024 * 1024;
  const DAY = 86400000;

  class HttpError extends Error {
    constructor(status, code, message, fields) { super(message); this.status = status; this.code = code; this.fields = fields; }
  }
  const bad = (msg, fields) => new HttpError(400, 'validation_failed', msg, fields);
  const need = (cond, status, code, msg) => { if (!cond) throw new HttpError(status, code, msg); };
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const rid = (p) => p + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
  const toyHash = (salt, pw) => { let h = 2166136261; const s = salt + pw; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };

  class MockServer {
    /** opts: state, onChange(state), demoActAsAnyOwner, autoReply, latency is handled by api.js */
    constructor(opts) {
      this.opts = Object.assign({ state: null, onChange: null, demoActAsAnyOwner: false, autoReply: true }, opts || {});
      this.s = this.opts.state || this._seed();
    }

    _seed() {
      const now = Date.now();
      const s = { seq: 1, users: [], sessions: {}, listings: [], reviews: [], threads: [], messages: [], appointments: [], uploads: {}, reports: [] };
      const mkUser = (id, name, email, type, pw) => s.users.push({ id, name, email, type, salt: 'x', hash: toyHash('x', pw || rid('seed')) });
      mkUser('u_owner', 'Demo Owner', 'owner@demo.test', 'business', 'demo1234');   // demo login for the business side
      mkUser('u_maya', 'Maya Q.', 'maya@demo.test', 'student');
      mkUser('u_jaden', 'Jaden M.', 'jaden@demo.test', 'student');
      mkUser('u_sam', 'Sam L.', 'sam@demo.test', 'student');
      let order = 0;
      for (const kind of ['services', 'socs', 'official']) {
        for (const x of SEED[kind]) {
          const l = Object.assign({ avatarId: null, photoIds: [], policy: null, menu: [], sections: [], sub: null }, x);
          l.kind = kind; l.status = 'live'; l.example = true; l.ownerId = x.name === 'Fade Theory' ? 'u_owner' : 'u_seed'; l.createdAt = new Date(now - (1000 - order++) * 1000).toISOString();
          const revs = l.reviews || []; delete l.reviews;
          revs.forEach((r, i) => s.reviews.push({ id: rid('r'), listingId: l.id, userId: null, rating: r.rating, text: r.text, author: r.author, createdAt: new Date(now - r.ageDays * DAY - i * 3600000).toISOString(), verified: true, example: true }));
          s.listings.push(l);
        }
      }
      const fade = 'svc_fade-theory', mins = (m) => new Date(now - m * 60000).toISOString();
      const th = (id, uid, msgs, unreadBiz) => {
        s.threads.push({ id, listingId: fade, clientId: uid, createdAt: msgs[0].at, unread: { client: 0, business: unreadBiz }, completed: false });
        msgs.forEach(m => s.messages.push({ id: rid('m'), threadId: id, from: m.f, type: 'text', text: m.t, createdAt: m.at, auto: false }));
      };
      th('th_seed1', 'u_maya', [{ f: 'client', t: 'Do you do fades on longer hair? Booking for my brother.', at: mins(95) }], 1);
      th('th_seed2', 'u_jaden', [{ f: 'client', t: 'Can I move my appointment to Sunday?', at: mins(1700) }, { f: 'business', t: 'Sunday 1pm works. See you then.', at: mins(1680) }], 0);
      th('th_seed3', 'u_sam', [{ f: 'client', t: 'What do you charge for a taper and beard trim?', at: mins(3000) }, { f: 'business', t: 'Taper £25 plus £5 for the beard trim, so £30.', at: mins(2988) }], 0);
      s.threads[1].completed = true;
      s.appointments.push({ userId: 'u_jaden', listingId: fade, at: mins(2000) });
      return s;
    }

    _changed() { if (this.opts.onChange) this.opts.onChange(this.s); }
    reset() { this.s = this._seed(); this._changed(); }

    /** Entry point. req: { method, path, query, body, token, upload }. Returns { status, body }. */
    async handle(req) {
      try {
        const out = await this._route(req);
        return { status: out.status || 200, body: out.body === undefined ? null : out.body };
      } catch (e) {
        if (e instanceof HttpError) return { status: e.status, body: { error: { code: e.code, message: e.message, fields: e.fields } } };
        console.error('[mock-backend]', e);
        return { status: 500, body: { error: { code: 'server_error', message: 'Something went wrong on our side. Try again.' } } };
      }
    }

    async _route(req) {
      const method = req.method.toUpperCase(), path = req.path.replace(/\/+$/, '') || '/', q = req.query || {}, b = req.body || {};
      const user = this._user(req.token);
      const m = (re) => { const r = re.exec(path); return r ? r.slice(1) : null; };
      let p;

      if (method === 'GET' && path === '/meta') return { body: { counts: this._counts() } };
      if (method === 'GET' && path === '/top') return { body: this._top() };
      if (method === 'GET' && path === '/recommended') return { body: this._recommended(q) };
      if (method === 'GET' && path === '/promoted') return { body: this._promoted(q) };
      if (method === 'GET' && path === '/areas') return { body: { items: Object.keys(AREAS) } };

      if (method === 'POST' && path === '/auth/signup') return this._signup(b);
      if (method === 'POST' && path === '/auth/login') return this._login(b);
      if (method === 'POST' && path === '/auth/logout') { if (req.token) { delete this.s.sessions[req.token]; this._changed(); } return { status: 204 }; }
      if (method === 'GET' && path === '/auth/me') { this._auth(user); return { body: { user: this._pubUser(user) } }; }

      if (method === 'GET' && path === '/listings') return this._list(q);
      if (method === 'POST' && path === '/listings') return this._create(this._auth(user), b);
      if (method === 'GET' && path === '/me/listings') {
        this._auth(user);
        return { body: { items: this._mine(user).map(l => Object.assign(this._summary(l), { mine: true, avgResponseSeconds: this._resp(l.id) })) } };
      }
      if (method === 'GET' && path === '/me/dashboard') return { body: this._dashboard(this._auth(user)) };
      if (method === 'POST' && path === '/auth/upgrade') { this._auth(user).type = 'business'; this._changed(); return { body: { user: this._pubUser(user) } }; }
      if (method === 'GET' && (p = m(/^\/listings\/([^/]+)$/))) return { body: { listing: this._detail(this._listing(p[0]), user) } };

      if (method === 'GET' && (p = m(/^\/listings\/([^/]+)\/reviews$/))) return { body: this._reviews(this._listing(p[0]), user) };
      if (method === 'POST' && (p = m(/^\/listings\/([^/]+)\/reviews$/))) return this._postReview(this._listing(p[0]), this._auth(user), b);

      if (method === 'POST' && path === '/uploads') return this._upload(this._auth(user), req.upload || b);

      if (method === 'GET' && path === '/unread') return { body: { count: this._unreadTotal(this._auth(user)) } };
      if (method === 'GET' && path === '/threads') return this._threads(this._auth(user), q);
      if (method === 'POST' && path === '/threads') return this._openThread(this._auth(user), b);
      if (method === 'GET' && (p = m(/^\/threads\/([^/]+)$/))) { const { t, role } = this._thread(p[0], this._auth(user), q.as); return { body: { thread: this._threadView(t, role), messages: this._msgs(t.id) } }; }
      if (method === 'GET' && (p = m(/^\/threads\/([^/]+)\/messages$/))) { const { t } = this._thread(p[0], this._auth(user), q.as); return { body: { items: this._msgs(t.id, q.after) } }; }
      if (method === 'POST' && (p = m(/^\/threads\/([^/]+)\/messages$/))) return this._send(this._auth(user), p[0], b, q.as || b.as);
      if (method === 'POST' && (p = m(/^\/threads\/([^/]+)\/read$/))) { const { t, role } = this._thread(p[0], this._auth(user), q.as); t.unread[role] = 0; this._changed(); return { status: 204 }; }
      if (method === 'POST' && (p = m(/^\/threads\/([^/]+)\/complete$/))) return this._complete(this._auth(user), p[0], q.as);
      if (method === 'POST' && (p = m(/^\/threads\/([^/]+)\/report$/))) { const { t } = this._thread(p[0], this._auth(user), q.as); this.s.reports.push({ threadId: t.id, by: user.id, reason: str(b.reason, 200), at: new Date().toISOString() }); this._changed(); return { status: 204 }; }

      if (method === 'POST' && path === '/demo/appointments') { // mock only
        const u = this._auth(user), l = this._listing(str(b.listingId, 80));
        if (!this._hasAppt(u.id, l.id)) this.s.appointments.push({ userId: u.id, listingId: l.id, at: new Date().toISOString() });
        this._changed(); return { status: 204 };
      }
      throw new HttpError(404, 'not_found', 'No such endpoint.');
    }

    /* ---------- auth ---------- */
    _user(token) { const id = token && this.s.sessions[token]; return id ? this.s.users.find(u => u.id === id) || null : null; }
    _auth(user) { need(user, 401, 'unauthenticated', 'Log in to continue.'); return user; }
    _pubUser(u) { return { id: u.id, name: u.name, email: u.email, type: u.type }; }
    _session(u) { const token = 'tok_' + rid('s') + rid('s'); this.s.sessions[token] = u.id; this._changed(); return { user: this._pubUser(u), token }; }
    _signup(b) {
      const name = str(b.name, 40), email = str(b.email, 120).toLowerCase(), pw = typeof b.password === 'string' ? b.password : '';
      const miss = [];
      if (!name) miss.push('your name');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) miss.push('a valid email address');
      if (pw.length < 8) miss.push('a password of at least 8 characters');
      if (miss.length) throw bad('Add ' + miss.join(', ') + '.');
      if (this.s.users.some(u => u.email === email)) throw new HttpError(409, 'conflict', 'That email already has an account. Log in instead.');
      const u = { id: 'u_' + (++this.s.seq) + rid('').slice(0, 5), name, email, type: b.type === 'business' ? 'business' : 'student', salt: rid('salt'), hash: '' };
      u.hash = toyHash(u.salt, pw); this.s.users.push(u);
      return { status: 201, body: this._session(u) };
    }
    _login(b) {
      const email = str(b.email, 120).toLowerCase(), pw = typeof b.password === 'string' ? b.password : '';
      const u = this.s.users.find(x => x.email === email);
      if (!u || u.hash !== toyHash(u.salt, pw)) throw new HttpError(401, 'unauthenticated', 'Email or password is wrong.');
      return { body: this._session(u) };
    }

    /* ---------- listings ---------- */
    _listing(id) { const l = this.s.listings.find(x => x.id === id); need(l, 404, 'not_found', 'That listing does not exist.'); return l; }
    _stats(l) { const rs = this.s.reviews.filter(r => r.listingId === l.id); return { count: rs.length, avg: rs.length ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : null, rs }; }
    _from(l) {
      const v = [].concat(...(l.menu || []).filter(g => g.group !== 'Add-ons').map(g => g.items.map(i => { const m = String(i.price).match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; }))).filter(x => !isNaN(x));
      return v.length ? 'From £' + Math.min(...v) : null;
    }
    _url(id) { return id && this.s.uploads[id] ? this.s.uploads[id].url : null; }
    _summary(l) {
      const st = this._stats(l);
      return { id: l.id, kind: l.kind, area: l.area || null, name: l.name, cat: l.cat, sub: l.sub || null, desc: l.desc, meta: l.meta || [], contact: l.contact,
        avatar: this._url(l.avatarId), banner: this._url(l.bannerId), photos: (l.photoIds || []).map(i => this._url(i)).filter(Boolean),
        from: l.kind === 'services' ? this._from(l) : null, rating: st.avg == null ? null : Math.round(st.avg * 10) / 10, reviewCount: st.count,
        status: l.status, example: !!l.example, promoted: !!l.promoted };
    }
    _detail(l) { return Object.assign(this._summary(l), { menu: l.menu || [], policy: l.policy || null, sections: l.sections || [], ownerId: l.ownerId, avgResponseSeconds: this._resp(l.id) }); }
    _mine(user) { return this.s.listings.filter(l => l.ownerId === user.id); }
    /* Average time the business took to answer a student, in seconds. Auto-replies don't count. null until there is data. */
    _resp(listingId) {
      const gaps = [];
      for (const t of this.s.threads.filter(x => x.listingId === listingId)) {
        const ms = this.s.messages.filter(m => m.threadId === t.id && m.type !== 'system');
        for (let i = 0; i < ms.length; i++) {
          if (ms[i].from !== 'client') continue;
          const reply = ms.slice(i + 1).find(m => m.from === 'business' && !m.auto);
          if (reply) gaps.push((Date.parse(reply.createdAt) - Date.parse(ms[i].createdAt)) / 1000);
          while (i + 1 < ms.length && ms[i + 1].from === 'client') i++;
        }
      }
      return gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
    }
    _counts() { const c = { services: 0, socs: 0, official: 0 }; this.s.listings.forEach(l => { if (l.status === 'live') c[l.kind]++; }); return c; }
    /* Recommended on the home page: rating (adjusted for how many reviews), number of reviews, and distance.
       q: lat+lng (from the browser) or area (picked by the student). Without either, rating and reviews only. */
    _recommended(q) {
      const lat = parseFloat(q.lat), lng = parseFloat(q.lng), limit = Math.max(1, Math.min(24, parseInt(q.limit, 10) || 6));
      const here = !isNaN(lat) && !isNaN(lng) ? [lat, lng] : (AREAS[q.area] || null);
      const basis = !isNaN(lat) && !isNaN(lng) ? 'location' : here ? 'area' : 'rating';
      const items = this.s.listings.filter(l => l.kind === 'services' && l.status === 'live').map(l => {
        const st = this._stats(l), prior = 4, w = 3;
        const rating = (st.avg == null ? prior : (st.avg * st.count + prior * w) / (st.count + w));
        const at = AREAS[l.area], d = here && at ? km(here, at) : null;
        const score = rating + 0.25 * Math.log1p(st.count) - (here ? (d == null ? 0.35 : Math.min(d, 8) * 0.12) : 0);
        return { l, d, score };
      }).sort((a, b) => b.score - a.score).slice(0, limit)
        .map(x => Object.assign(this._summary(x.l), { distanceKm: x.d == null ? null : Math.round(x.d * 10) / 10 }));
      return { basis, items };
    }
    /* Paid placements. Matches the student's category/type when they have picked one, nearest first if we know where they are. */
    _promoted(q) {
      const lat = parseFloat(q.lat), lng = parseFloat(q.lng), here = !isNaN(lat) && !isNaN(lng) ? [lat, lng] : null;
      const limit = Math.max(1, Math.min(10, parseInt(q.limit, 10) || 5));
      const dist = l => here && AREAS[l.area] ? km(here, AREAS[l.area]) : null;
      const items = this.s.listings.filter(l => l.kind === 'services' && l.status === 'live' && l.promoted && (!q.category || l.cat === q.category) && (!q.sub || l.sub === q.sub))
        .map(l => ({ l, d: dist(l), r: this._stats(l).avg || 0 }))
        .sort((a, b) => here ? ((a.d == null ? 1e9 : a.d) - (b.d == null ? 1e9 : b.d)) : (b.r - a.r))
        .slice(0, limit).map(x => Object.assign(this._summary(x.l), { distanceKm: x.d == null ? null : Math.round(x.d * 10) / 10 }));
      return { items };
    }
    _top() {
      const items = this.s.listings.filter(l => l.kind === 'services' && l.status === 'live').map(l => ({ l, st: this._stats(l) }))
        .sort((a, b) => (b.st.avg || 0) - (a.st.avg || 0) || b.st.count - a.st.count).slice(0, 8).map(x => ({ id: x.l.id, name: x.l.name }));
      return { items };
    }
    _list(q) {
      need(CATS[q.kind], 400, 'validation_failed', 'kind must be services, socs or official.');
      const term = str(q.q, 100).toLowerCase(), limit = Math.max(1, Math.min(100, parseInt(q.limit, 10) || 24)), offset = Math.max(0, parseInt(q.offset, 10) || 0);
      const hay = l => [l.name, l.cat, l.sub || '', l.desc, ...(l.meta || []), ...[].concat(...(l.menu || []).map(g => [g.group || '', ...g.items.map(i => i.name)]))].join(' ').toLowerCase();
      const minRating = parseFloat(q.minRating) || 0;
      const base = this.s.listings.filter(l => l.kind === q.kind && l.status === 'live' && (!q.category || l.cat === q.category) && (!term || hay(l).includes(term))
        && (!minRating || ((this._stats(l).avg || 0) >= minRating)));
      /* facets: how many listings of each type, before the type filter is applied, so the chips can show counts */
      const subs = {}; base.forEach(l => { if (l.sub) subs[l.sub] = (subs[l.sub] || 0) + 1; });
      let rows = base.filter(l => !q.sub || l.sub === q.sub);
      const price = l => { const f = this._from(l); return f ? parseFloat(f.replace(/[^\d.]/g, '')) : Infinity; };
      const rate = l => this._stats(l).avg || 0, cnt = l => this._stats(l).count, reply = l => { const r = this._resp(l.id); return r == null ? Infinity : r; };
      const here = !isNaN(parseFloat(q.lat)) && !isNaN(parseFloat(q.lng)) ? [parseFloat(q.lat), parseFloat(q.lng)] : null;
      const dist = l => here && AREAS[l.area] ? km(here, AREAS[l.area]) : null;
      const sorts = { near: (a, b) => (dist(a) == null ? 1e9 : dist(a)) - (dist(b) == null ? 1e9 : dist(b)), top: (a, b) => rate(b) - rate(a) || cnt(b) - cnt(a), price: (a, b) => price(a) - price(b), reviews: (a, b) => cnt(b) - cnt(a), reply: (a, b) => reply(a) - reply(b) };
      if (sorts[q.sort]) rows = rows.slice().sort(sorts[q.sort]);
      return { body: { items: rows.slice(offset, offset + limit).map(l => Object.assign(this._summary(l), { distanceKm: dist(l) == null ? null : Math.round(dist(l) * 10) / 10 })), total: rows.length, facets: { subs } } };
    }
    _create(user, b) {
      const kind = b.kind;
      need(user.type === 'business', 403, 'forbidden', 'Listing is for business accounts. Switch your account to a business account first.');
      need(CATS[kind], 400, 'validation_failed', 'Choose what you are registering.');
      const name = str(b.name, 80), cat = str(b.cat, 40), desc = str(b.desc, 200), contact = str(b.contact, 120);
      const miss = [!name && 'a name', !cat && 'a category', !desc && 'a short description', !contact && 'a way to contact you'].filter(Boolean);
      if (miss.length) throw bad('Add ' + miss.join(', ') + ' to continue.');
      if (!CATS[kind].includes(cat)) throw bad('That category is not available.');
      const meta = (Array.isArray(b.meta) ? b.meta : []).map(x => str(x, 60)).filter(Boolean).slice(0, 6);
      const menu = (Array.isArray(b.menu) ? b.menu : []).slice(0, 6).map(g => ({ group: g && g.group ? str(g.group, 40) : null, items: ((g && g.items) || []).slice(0, 30).map(i => ({ name: str(i && i.name, 80), price: str(i && i.price, 30) })).filter(i => i.name) })).filter(g => g.items.length);
      const photoIds = Array.isArray(b.photoIds) ? b.photoIds.slice(0, 4) : [];
      const own = id => { const u = this.s.uploads[id]; return u && u.ownerId === user.id; };
      if (photoIds.some(id => !own(id)) || (b.avatarId && !own(b.avatarId)) || (b.bannerId && !own(b.bannerId))) throw bad('One of your pictures is missing. Upload it again.');
      const area = str(b.area, 40);
      if (kind === 'services' && !(area in AREAS)) throw bad('Choose your area, or Online.');
      const l = { id: 'lst_' + rid('').slice(1), area: kind === 'services' ? area : null, bannerId: b.bannerId || null, kind, name, cat, sub: kind === 'services' ? str(b.sub, 40) || null : null, desc, meta, contact, menu, policy: str(b.policy, 400) || null,
        sections: [], avatarId: b.avatarId || null, photoIds, ownerId: user.id, status: 'live', example: false, createdAt: new Date().toISOString() };
      this.s.listings.unshift(l); this._changed();
      return { status: 201, body: { listing: this._detail(l) } };
    }
    _upload(user, u) {
      const type = str(u.type, 40);
      need(IMG_TYPES.includes(type), 415, 'unsupported_type', 'Only JPG, PNG, WebP or GIF images.');
      need(typeof u.dataUrl === 'string' && u.dataUrl.startsWith('data:image/'), 400, 'validation_failed', 'That file could not be read.');
      need((u.size || u.dataUrl.length * 0.75) <= MAX_UPLOAD, 413, 'too_large', 'That image is over 5MB.');
      if (['avatar', 'banner'].includes(str(u.purpose, 10))) need(type !== 'image/gif', 415, 'unsupported_type', 'Profile and cover pictures must be JPG, PNG or WebP.');
      const id = rid('up'); this.s.uploads[id] = { url: u.dataUrl, ownerId: user.id, purpose: u.purpose || 'photo' };
      this._changed();
      return { status: 201, body: { id, url: u.dataUrl } };
    }

    /* ---------- reviews ---------- */
    _hasAppt(uid, lid) { return this.s.appointments.some(a => a.userId === uid && a.listingId === lid); }
    _viewer(l, user) {
      if (!user) return { canReview: false, reason: 'login' };
      if (this.s.reviews.some(r => r.listingId === l.id && r.userId === user.id)) return { canReview: false, reason: 'already_reviewed' };
      if (!this._hasAppt(user.id, l.id)) return { canReview: false, reason: 'no_appointment' };
      return { canReview: true, reason: null };
    }
    _reviewView(r, user) { return { id: r.id, rating: r.rating, text: r.text, author: r.author, createdAt: r.createdAt, mine: !!user && r.userId === user.id, verified: !!r.verified, example: !!r.example }; }
    _reviews(l, user) {
      const st = this._stats(l), counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      st.rs.forEach(r => counts[r.rating]++);
      const items = st.rs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(r => this._reviewView(r, user));
      return { items, summary: { avg: st.avg == null ? null : Math.round(st.avg * 10) / 10, count: st.count, counts }, viewer: this._viewer(l, user) };
    }
    _postReview(l, user, b) {
      const v = this._viewer(l, user);
      if (!v.canReview) {
        if (v.reason === 'already_reviewed') throw new HttpError(409, 'conflict', 'You have already reviewed this business.');
        throw new HttpError(403, 'not_eligible', 'You can review once your appointment has been marked complete.');
      }
      const rating = parseInt(b.rating, 10), text = str(b.text, 300);
      if (!(rating >= 1 && rating <= 5) || !text) throw bad('Add ' + [!(rating >= 1 && rating <= 5) && 'a rating', !text && 'a few words'].filter(Boolean).join(', ') + ' to post.');
      const r = { id: rid('r'), listingId: l.id, userId: user.id, rating, text, author: user.name, createdAt: new Date().toISOString(), verified: true, example: false };
      this.s.reviews.push(r); this._changed();
      return { status: 201, body: { review: this._reviewView(r, user) } };
    }

    /* ---------- messages ---------- */
    _owns(user, l) { return l.ownerId === user.id || (this.opts.demoActAsAnyOwner && l.kind === 'services'); }   // demo flag is off by default
    _thread(id, user, as) {
      const t = this.s.threads.find(x => x.id === id); need(t, 404, 'not_found', 'That conversation does not exist.');
      const l = this._listing(t.listingId), isClient = t.clientId === user.id, owns = this._owns(user, l);
      need(isClient || owns, 403, 'forbidden', 'That conversation is not yours.');
      let role = isClient && !owns ? 'client' : owns && !isClient ? 'business' : (as === 'business' ? 'business' : 'client');
      return { t, l, role };
    }
    _msgs(tid, after) {
      let list = this.s.messages.filter(m => m.threadId === tid);
      if (after) { const i = list.findIndex(m => m.id === after); if (i >= 0) list = list.slice(i + 1); }
      return list;
    }
    _threadView(t, role) {
      const l = this._listing(t.listingId), c = this.s.users.find(u => u.id === t.clientId), ms = this._msgs(t.id), last = ms.filter(m => m.type !== 'system').slice(-1)[0] || ms[ms.length - 1] || null;
      const st = this._stats(l);
      return { id: t.id, listingId: l.id, listingName: l.name, listingCat: l.cat, listingSub: l.sub || null, listingAvatar: this._url(l.avatarId), listingRating: st.avg == null ? null : Math.round(st.avg * 10) / 10, listingReviewCount: st.count, avgResponseSeconds: this._resp(l.id), clientId: t.clientId, clientName: c ? c.name : 'Student',
        lastMessage: last ? { id: last.id, from: last.from, text: last.text, createdAt: last.createdAt } : null, unread: t.unread[role] || 0, appointmentCompleted: !!t.completed || this._hasAppt(t.clientId, l.id) };
    }
    _threads(user, q) {
      const as = q.as === 'business' ? 'business' : 'client';
      if (as === 'business') need(user.type === 'business', 403, 'forbidden', 'This is only for business accounts.');
      let rows = this.s.threads.filter(t => as === 'client' ? t.clientId === user.id : this._owns(user, this._listing(t.listingId)) && (!q.listingId || t.listingId === q.listingId));
      const items = rows.map(t => this._threadView(t, as)).sort((a, b) => ((b.lastMessage || {}).createdAt || '').localeCompare((a.lastMessage || {}).createdAt || ''));
      return { body: { items } };
    }
    _unreadTotal(user) {
      return this.s.threads.reduce((n, t) => {
        const l = this._listing(t.listingId);
        return n + (t.clientId === user.id ? t.unread.client : 0) + (l.ownerId === user.id ? t.unread.business : 0);
      }, 0);
    }
    _addMsg(t, from, text, extra) {
      const m = Object.assign({ id: rid('m'), threadId: t.id, from, type: from === 'system' ? 'system' : 'text', text, createdAt: new Date().toISOString(), auto: false }, extra || {});
      this.s.messages.push(m); return m;
    }
    _openThread(user, b) {
      const l = this._listing(str(b.listingId, 80));
      need(l.kind === 'services', 400, 'validation_failed', 'You can only message businesses.');
      need(l.ownerId !== user.id, 400, 'validation_failed', 'That is your own listing.');
      let t = this.s.threads.find(x => x.clientId === user.id && x.listingId === l.id), created = false;
      if (!t) { t = { id: rid('th'), listingId: l.id, clientId: user.id, createdAt: new Date().toISOString(), unread: { client: 0, business: 0 }, completed: false }; this.s.threads.unshift(t); created = true; }
      const text = str(b.text, 500);
      if (text) { this._addMsg(t, 'client', text); t.unread.business++; this._autoReply(t); }
      this._changed();
      return { status: created ? 201 : 200, body: { thread: this._threadView(t, 'client') } };
    }
    _send(user, id, b, as) {
      const { t, role } = this._thread(id, user, as), text = str(b.text, 500);
      if (!text) throw bad('Write a message first.');
      const from = role === 'business' ? 'business' : 'client', m = this._addMsg(t, from, text);
      if (from === 'business') t.unread.client++; else { t.unread.business++; this._autoReply(t); }
      this._changed();
      return { status: 201, body: { message: m } };
    }
    _autoReply(t) {
      if (!this.opts.autoReply) return;
      setTimeout(() => {
        this._addMsg(t, 'business', 'Thanks for your message! I will get back to you shortly.', { auto: true });
        t.unread.client++; this._changed();
      }, 1400);
    }
    _dashboard(user) {
      const lastFrom = t => { const ms = this._msgs(t.id).filter(m => m.type !== 'system'); return ms.length ? ms[ms.length - 1].from : null; };
      if (user.type !== 'business') {
        const mine = this.s.threads.filter(t => t.clientId === user.id), appts = this.s.appointments.filter(a => a.userId === user.id);
        const myReviews = this.s.reviews.filter(r => r.userId === user.id);
        const toReview = appts.filter(a => !myReviews.some(r => r.listingId === a.listingId)).map(a => { const l = this._listing(a.listingId); return { listingId: l.id, name: l.name, cat: l.cat, avatar: this._url(l.avatarId), at: a.at }; });
        return { role: 'student', stats: { conversations: mine.length, unread: mine.reduce((n, t) => n + t.unread.client, 0), appointments: appts.length, reviews: myReviews.length },
          toReview, threads: mine.map(t => this._threadView(t, 'client')).sort((a, b) => ((b.lastMessage || {}).createdAt || '').localeCompare((a.lastMessage || {}).createdAt || '')).slice(0, 6),
          reviews: myReviews.map(r => ({ id: r.id, listingId: r.listingId, listingName: this._listing(r.listingId).name, rating: r.rating, text: r.text, createdAt: r.createdAt })) };
      }
      const ls = this._mine(user), ids = ls.map(l => l.id), ts = this.s.threads.filter(t => ids.includes(t.listingId));
      const revs = this.s.reviews.filter(r => ids.includes(r.listingId)), appts = this.s.appointments.filter(a => ids.includes(a.listingId));
      const gaps = ids.map(i => this._resp(i)).filter(x => x != null);
      return { role: 'business',
        stats: { rating: revs.length ? Math.round(revs.reduce((a, r) => a + r.rating, 0) / revs.length * 10) / 10 : null, reviewCount: revs.length,
          avgResponseSeconds: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null, unread: ts.reduce((n, t) => n + t.unread.business, 0), openChats: ts.length, appointments: appts.length },
        needsReply: ts.filter(t => t.unread.business > 0 || lastFrom(t) === 'client').map(t => this._threadView(t, 'business')).slice(0, 8),
        listings: ls.map(l => Object.assign(this._summary(l), { avgResponseSeconds: this._resp(l.id) })),
        reviews: revs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map(r => ({ id: r.id, listingId: r.listingId, listingName: this._listing(r.listingId).name, rating: r.rating, text: r.text, author: r.author, createdAt: r.createdAt })) };
    }
    _complete(user, id, as) {
      const { t, l, role } = this._thread(id, user, as);
      need(role === 'business' && this._owns(user, l), 403, 'forbidden', 'Only the business can mark an appointment complete.');
      if (!this._hasAppt(t.clientId, l.id)) {
        this.s.appointments.push({ userId: t.clientId, listingId: l.id, at: new Date().toISOString() });
        t.completed = true;
        this._addMsg(t, 'system', l.name + ' marked this appointment complete. You can now leave one review.');
        t.unread.client++;
      }
      this._changed();
      return { body: { thread: this._threadView(t, 'business') } };
    }
  }

  MockServer.HttpError = HttpError;
  if (typeof module !== 'undefined' && module.exports) module.exports = MockServer;
  else root.MockServer = MockServer;
})(typeof window !== 'undefined' ? window : globalThis);
