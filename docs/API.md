# The Board: REST API contract

This is everything the front end expects from a backend. Build to this and the site works with no front-end changes.

- Base URL: set `apiBase` in `js/config.js` (for example `https://api.example.com/api/v1`).
- Format: JSON in, JSON out (`Content-Type: application/json`), except uploads (multipart).
- Auth: `Authorization: Bearer <token>`. The token comes from `signup` or `login`. The front end keeps it in `localStorage`. If you prefer an HttpOnly cookie, set `useCookies: true` in config and the client sends `credentials: "include"`; you must then allow that origin with CORS credentials.
- Times: ISO 8601 UTC strings (`2026-10-08T14:03:00Z`). The front end formats them.
- IDs: opaque strings. The front end never parses them.
- CORS: allow the front-end origin, methods `GET POST DELETE OPTIONS`, headers `Authorization, Content-Type`.

A working reference implementation of this whole contract lives in `js/mock-backend.js` and runs in Node via `server/dev-server.js`. When this document and the behaviour are unclear, read that file.

## Two kinds of account

Every user has `type`: `student` or `business`. The front end shows a different dashboard and inbox for each, but the **server must enforce it**:

| | student | business |
|---|---|---|
| Browse, search, view profiles | yes | yes |
| Message a business, leave a review (after an appointment) | yes | yes |
| `GET /threads?as=business`, `POST /threads/:id/complete` | 403 | yes, for own listings only |
| `POST /listings`, `GET /me/listings` | 403 / empty | yes |
| `GET /me/dashboard` | student dashboard | business dashboard |

A student can switch with `POST /auth/upgrade`. Signing up as `business` does it from the start.

## Errors

Every non-2xx response has this body:

```json
{ "error": { "code": "validation_failed", "message": "Add a name to continue.", "fields": { "name": "Required" } } }
```

`message` is shown to the student as is, so write it in plain English. `fields` is optional.

| HTTP | `code` | When |
|---|---|---|
| 400 | `validation_failed` | Bad or missing input |
| 401 | `unauthenticated` | No token, bad token, expired session. The front end logs the user out and asks them to sign in again |
| 403 | `forbidden` | Signed in but not allowed (not your listing, not your thread) |
| 403 | `not_eligible` | Review rules not met |
| 404 | `not_found` | Missing resource |
| 409 | `conflict` | Email already registered, already reviewed |
| 413 | `too_large` | Upload too big |
| 415 | `unsupported_type` | Upload is not an allowed image type |
| 429 | `rate_limited` | Too many requests (send `Retry-After`) |

## Objects

**User**
```json
{ "id": "u_1", "name": "Ayuba", "email": "a@example.com", "type": "student" }
```
`type` is `student` or `business`. Never return the password or hash.

**ListingSummary** (cards)
```json
{
  "id": "svc_fade-theory", "kind": "services", "area": "Lenton", "name": "Fade Theory",
  "cat": "Hair", "sub": "Barbers", "desc": "Clean fades...",
  "meta": ["Lenton", "Evenings and weekends"],
  "contact": "@fade.theory",
  "avatar": "https://.../a.jpg", "banner": "https://.../cover.jpg",
  "photos": ["https://.../1.jpg"],
  "from": "From £15",
  "rating": 4.7, "reviewCount": 3,
  "status": "live", "example": false
}
```
`banner` is the wide cover image shown at the top of a profile (like X/Twitter); the avatar overlaps it. `kind` is `services` or `official` (`socs` is reserved for later). `area` is where a business is based (one of `GET /areas`, or `Online`); it drives "Recommended for you". `sub`, `from`, `avatar`, `rating` may be null/absent (societies and notices have no `sub`, `from`, `rating`). `from` is the lowest price in the menu, ignoring the group called `Add-ons`. `example` is only true for seeded demo rows.

**Listing** (detail) = ListingSummary plus:
```json
{
  "menu": [ { "group": null, "items": [ { "name": "Fade", "price": "£25" } ] },
            { "group": "Add-ons", "items": [ { "name": "Beard trim", "price": "+£5" } ] } ],
  "policy": "Late policy: ...",
  "sections": [
    { "title": "Late fees", "type": "fees", "rows": [ { "label": "Up to 10 minutes", "value": "Grace period, no fee" } ] },
    { "title": "Late policy", "type": "list", "items": ["There is a 10 minute grace period."] }
  ],
  "ownerId": "u_9",
  "avgResponseSeconds": 960
}
```
`avgResponseSeconds` is the average time the business took to answer a student message (ignore auto-replies; `null` until there is data). The profile shows "Replies in about 16 min". `sections` become the full-screen "highlights" on a profile. `type: "fees"` renders rows, `type: "list"` renders one slide per item. Prices are display strings, not numbers.

**Review**
```json
{ "id": "r_1", "rating": 5, "text": "...", "author": "Jaden M.", "createdAt": "...", "mine": false, "verified": true, "example": false }
```
`mine` is true when the token's user wrote it. `verified` means it came from a completed appointment.

**Thread / Message**
```json
{
  "id": "th_1", "listingId": "svc_fade-theory", "listingName": "Fade Theory", "listingCat": "Hair", "listingSub": "Barbers",
  "clientId": "u_2", "clientName": "Maya Q.",
  "listingAvatar": "https://.../a.jpg", "listingRating": 4.7, "listingReviewCount": 3, "avgResponseSeconds": 960,
  "lastMessage": { "id": "m_9", "from": "client", "text": "Do you do fades...", "createdAt": "..." },
  "unread": 1, "appointmentCompleted": false
}
{ "id": "m_9", "threadId": "th_1", "from": "client", "type": "text", "text": "Hi", "createdAt": "...", "auto": false }
```
`from` is `client` or `business`, or `system` with `type: "system"` for notices such as "appointment complete". `unread` is the number of messages the *viewer* has not read. `auto` marks demo auto-replies and is never true on a real backend.

## Endpoints

### Meta
`GET /meta` returns `{ "counts": { "services": 19, "socs": 5, "official": 3 } }`. Counts of live listings.

`GET /areas` returns `{ "items": ["City centre", "Lenton", ..., "Online"] }`, the areas a business can pick.

`GET /recommended?lat=&lng=&area=&limit=6` returns `{ "basis": "location"|"area"|"rating", "items": [ListingSummary + distanceKm] }`. The home page sends `lat`/`lng` (rounded to about 1 km) if the student shares their location, or an `area` they picked, or nothing. Rank by rating adjusted for review count (so one 5-star review doesn't beat thirty 4.8s), number of reviews, and distance. `distanceKm` is null for Online businesses or when there is no location.

`GET /top` returns `{ "items": [ { "id": "...", "name": "..." } ] }`. The "Top businesses this week" strip, up to 8, best first. Rank however you like (reviews in the last 7 days, views, ratings).

### Auth
| | |
|---|---|
| `POST /auth/signup` | body `{ name, email, password, type }`. Any valid email. Password min 8. `type` is `student` or `business`. Returns `201 { user, token }`. 409 if the email exists. Hash passwords with argon2 or bcrypt. Send a verification email; the account can work meanwhile. |
| `POST /auth/login` | body `{ email, password }`. Returns `{ user, token }`. Use one generic 401 message for wrong email or wrong password. |
| `POST /auth/logout` | Revokes the token. `204`. |
| `GET /auth/me` | Returns `{ user }` for the token, or 401. The front end calls this on page load. |

### Listings
`GET /listings` query: `kind` (required), `category`, `sub`, `q` (search words), `sort` (`top`, `near`, `price`, `reviews`, `reply`; empty = your default order), `lat`/`lng` (optional, the student's rough location; when sent, add `distanceKm` to each item so cards can show "0.4 mi away"), `minRating` (1 to 5), `limit` (default 24, max 100), `offset`.
Returns `{ "items": [ListingSummary], "total": 19, "facets": { "subs": { "Barbers": 2, "Braids": 2 } } }`. `facets.subs` counts listings per type with every filter applied **except** `sub`, so the type buttons can show counts. Search should match name, category, sub, description, meta and menu item names. Only `status: "live"` rows.

`GET /listings/:id` returns `{ "listing": Listing }`. 404 if missing.

`POST /listings` (auth, **business accounts only**, else 403). body:
```json
{ "kind": "services", "name": "...", "cat": "Hair", "sub": "Barbers", "desc": "...", "meta": ["City centre"],
  "contact": "@x", "area": "Lenton", "menu": [ { "group": null, "items": [ { "name": "Fade", "price": "£25" } ] } ],
  "policy": "...", "avatarId": "up_1", "bannerId": "up_4", "photoIds": ["up_2", "up_3"] }
```
Required: `kind`, `name`, `cat`, `desc`, `contact`, and `area` for services. `kind: "official"` should be limited to staff accounts (your call; the demo allows anyone). Max 4 photos. `avatarId`/`bannerId`/`photoIds` are ids from `/uploads` owned by the caller. Returns `201 { listing }` with `status: "pending"` if you moderate, or `"live"`. The front end shows "submitted for review" for `pending`.

`GET /me/listings` (auth) returns `{ "items": [ListingSummary + avgResponseSeconds] }`, the listings the user owns including pending ones.

### Dashboards and account
`GET /me/dashboard` (auth). The shape depends on the account type.

Student:
```json
{ "role": "student",
  "stats": { "conversations": 2, "unread": 1, "appointments": 1, "reviews": 0 },
  "toReview": [ { "listingId": "...", "name": "Fade Theory", "cat": "Hair", "avatar": null, "at": "..." } ],
  "threads": [Thread], "reviews": [ { "id": "..", "listingId": "..", "listingName": "..", "rating": 5, "text": "..", "createdAt": ".." } ] }
```
`toReview` = completed appointments the student has not reviewed yet.

Business:
```json
{ "role": "business",
  "stats": { "rating": 4.7, "reviewCount": 3, "avgResponseSeconds": 960, "unread": 2, "openChats": 4, "appointments": 2 },
  "needsReply": [Thread], "listings": [ListingSummary + avgResponseSeconds],
  "reviews": [ { "id": "..", "listingId": "..", "listingName": "..", "rating": 5, "text": "..", "author": "..", "createdAt": ".." } ] }
```
`needsReply` = chats on the business's listings where the last message is from the customer or has unread messages.

`POST /auth/upgrade` (auth) switches the account to `business`. Returns `{ user }`.

### Uploads
`POST /uploads` (auth), `multipart/form-data` with fields `file` and `purpose` (`avatar`, `banner` or `photo`; no GIF for avatar or banner). Allowed: JPEG, PNG, WebP (GIF for photos). Max 5 MB (the front end resizes before sending, but never trust that: check type by content, re-encode, strip EXIF, serve from a separate domain or with `Content-Disposition`). Returns `201 { "id": "up_1", "url": "https://.../up_1.jpg" }`.

### Reviews
`GET /listings/:id/reviews` returns:
```json
{ "items": [Review], "summary": { "avg": 4.7, "count": 3, "counts": { "5": 2, "4": 1, "3": 0, "2": 0, "1": 0 } },
  "viewer": { "canReview": false, "reason": "no_appointment" } }
```
`viewer.reason` is `null` when `canReview` is true, otherwise `login` (no token), `no_appointment`, or `already_reviewed`. The front end only decides what to show from this, so the server must be the one that enforces it.

`POST /listings/:id/reviews` (auth) body `{ rating: 1-5, text: "max 300 chars" }`. Returns `201 { review }`. **Server rules:** the user must have a completed appointment with this listing (see below), and may post only one review per listing. Otherwise `403 not_eligible` or `409 conflict`. The author name comes from the account, not the request.

### Messages
All thread routes require auth. A user may touch a thread only if they are its client, or they own its listing. Otherwise 403.

`GET /threads?as=client|business&listingId=` returns `{ "items": [Thread] }` newest activity first. `as=client` is threads where the user is the client. `as=business` is threads on listings the user owns (optionally for one `listingId`), business accounts only. The chat header for a student shows `listingAvatar`, `listingRating`, `listingReviewCount` and `avgResponseSeconds`, so return them on every Thread.

`POST /threads` body `{ listingId, text? }`. Gets or creates the thread between this user and that listing. Returns `{ thread }` (201 if new). A user cannot message their own listing.

`GET /threads/:id` returns `{ thread, messages: [Message] }` (oldest first).

`GET /threads/:id/messages?after=<messageId>` returns `{ items: [Message] }` newer than that message. Used for polling.

`POST /threads/:id/messages` body `{ text: "1-500 chars" }`. Returns `201 { message }`. Rate limit this.

`POST /threads/:id/read` marks the viewer's side read. `204`.

`GET /unread` returns `{ "count": 3 }`, total unread messages for the user across both roles. Polled about every 4 seconds while the tab is visible; keep it cheap. (Swap polling for WebSocket/SSE later if you want; only `js/ui-messages.js` changes.)

`POST /threads/:id/complete` (listing owner only) marks the appointment between this client and this listing complete. Adds a system message, sets `appointmentCompleted: true`, and creates the appointment record that unlocks one review. Idempotent. `403` if the caller does not own the listing.

`POST /threads/:id/report` body `{ reason? }`. Flags the conversation for moderators. `204`.

## Rules the server must enforce

The front end hides buttons, but anyone can call the API directly.

1. Reviews: completed appointment required, one per student per listing, author from the account.
2. Thread access: only the client and the listing owner.
3. Only the listing owner can mark an appointment complete, and a student cannot complete their own.
4. Uploads: validate type by content, cap size, re-encode, strip EXIF, scope to the uploader.
5. Listings: sanitize text (the client escapes on output, but store clean data), cap lengths (name 80, desc 200, contact 120, menu 30 rows, 4 photos), approve before `live` if you moderate.
6. Passwords hashed, login rate limited, sessions revocable.
7. Never trust `mine`, `ownerId`, `author`, or `verified` from the request body.

## Notes for thread routes

Every thread route also receives `?as=client|business`. A real backend can ignore it, because a user is either the thread's client or its listing's owner, never both. The mock uses it because in demo mode one account may act as both.

## Mock-only extras (not part of the contract)

`POST /demo/appointments { listingId }` makes the signed-in student eligible to review, so the review flow can be tried without an owner. Only the mock backend has it.

The mock ships a demo business account that owns Fade Theory: `owner@demo.test` / `demo1234`. The login form shows a shortcut for it when `demoLogins` is true in `js/config.js` (turn that off in production).
