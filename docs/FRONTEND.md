# the Board: front end

Plain HTML, CSS and JavaScript. No build step, no dependencies. Open `index.html`, or run the dev server below.

## Run it

```
node --watch server/dev-server.js   # http://localhost:8787. Pages reload themselves when files change; --watch restarts the server when its code changes
```
Or just open `index.html` in a browser: it starts in **mock mode** with example data kept in that browser. Add `?resetmock` to the address to wipe it.

Demo logins: sign up with any email for a **student** account. For the **business** side, press Log in and use the demo business account link (owner@demo.test / demo1234, owns Fade Theory), or sign up and choose "A student running a business". Students and businesses get different dashboards and inboxes.

## Connect the real backend

1. Build the endpoints in [`API.md`](API.md).
2. Edit `js/config.js`: set `mode: 'http'` and `apiBase` to your API address.
3. Delete the `seed.js` and `mock-backend.js` script tags from `index.html` (optional, they are only used by mock mode).

Nothing else changes. Every network call goes through one object, `API` in `js/api.js`.

`server/dev-server.js` is a working reference of the whole contract (same code as the mock). Run it and watch the network tab to see exactly what the front end sends and expects.

## Files

| File | What it does |
|---|---|
| `index.html` | Home: hero, top strip, browse (categories, types, filters) |
| `how-it-works.html` | How it works, safety, questions |
| `messages.html` | Messages page (inbox and chat) |
| `js/ui-shell.js` | Header, footer and mobile menu shared by every page |
| `css/styles.css` | All styling (dark and light follow the system) |
| `js/config.js` | **The one place to switch mock / http and set the API address** |
| `js/api.js` | API client: requests, tokens, errors, uploads. Same methods in both modes |
| `js/mock-backend.js`, `js/seed.js` | In-browser fake server and example data. Also used by the dev server |
| `js/ui-core.js` | Icons, categories, small helpers |
| `js/ui-auth.js` | Sign up, log in, session |
| `js/ui-browse.js` | Search, filters, tabs, cards, top strip |
| `js/ui-register.js` | Register a business, society or notice (uploads + create) |
| `js/ui-detail.js` | Business profile, reviews, photos, full-screen highlights |
| `js/ui-messages.js` | Messages, unread badge, polling |
| `js/ui-dashboard.js` | Student dashboard and business dashboard |
| `js/main.js` | Start-up |
| `server/dev-server.js` | Zero-dependency Node server for local testing |
| `API.md` | The contract |

## What the UI already handles

Loading skeletons, error messages with retry, empty states, busy buttons, stale-response protection on search, "show more" paging, session restore on reload, automatic logout when the server returns 401, optimistic message sending that rolls back on failure, image resizing before upload.

## Things the backend must enforce

The UI only hides things. See "Rules the server must enforce" in `API.md`: reviews need a completed appointment (one per student per business), only thread participants can read a thread, only the business can mark an appointment complete, uploads are validated server-side, passwords are hashed.

## Still to build (not front-end)

Email verification, password reset, moderation queue for new listings, editing and deleting a listing, a real booking system (today an appointment is "complete" when the owner marks it in Messages), push or email notifications.
