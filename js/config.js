/* The Board: front-end settings.
 *
 *   mode: "mock" + supabase   (this site) Listings come from Supabase. Accounts, messages and reviews are a demo
 *                             kept only in the visitor's browser.
 *   mode: "mock", no supabase Everything is example data in the browser (for working on the design).
 *   mode: "http"              Talks to the full backend on the ui-rework branch (backend/, /api/v1).
 */
window.BOARD_CONFIG = {
  mode: 'mock',
  supabase: {
    url: 'https://xvenwgfvgkdauxfkcgcg.supabase.co',
    key: 'sb_publishable_BgpvbiU9CkH2y1WSS3ZPWw_6yTCivS0'   // public by design; the rules in supabase/security.sql protect the data
  },
  apiBase: '/api/v1',
  useCookies: false,
  pollMs: null,
  mockLatency: [60, 160],
  mockPersist: true,
  demoLogins: false
};
