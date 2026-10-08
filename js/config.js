/* The Board: front-end settings. This is the only file you edit to connect a backend.
 *
 *   mode: "mock"  Runs entirely in the browser with example data (js/mock-backend.js). No server needed.
 *   mode: "http"  Talks to a real server that implements docs/API.md.
 *
 * To go live: set mode to "http" and apiBase to your API address. Nothing else changes.
 */
window.BOARD_CONFIG = {
  mode: 'mock',
  apiBase: '/api/v1',          // used when mode is "http". Can be a full URL like https://api.example.com/api/v1
  useCookies: false,           // true = send cookies (HttpOnly session) instead of a Bearer token
  pollMs: null,                // how often to check for new messages. null = 4000 (1500 in mock mode)
  mockLatency: [120, 320],     // fake network delay in mock mode, in ms [min, max]
  mockPersist: true            // keep mock data in this browser between refreshes
};
