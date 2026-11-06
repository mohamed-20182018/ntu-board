# Security: how the live site is protected

The site is static (Vercel / GitHub Pages). The home page talks to Supabase with the public ("publishable") key. That key is meant to be public, so **all protection lives in Supabase**: the Row Level Security rules in `supabase/security.sql`, the `submit-post` and `delete-account` Edge Functions, and Supabase Auth.

| Area | What protects it |
|---|---|
| Reading | Anyone can read only `live` listings and reviews. You also see your own pending ones. Admins (emails in `admins`) see everything. The page also only asks for live rows. |
| Posting | Goes through the `submit-post` Edge Function, which checks the text and decides `live` or `pending`. Anything inserted straight into the database by a normal user is forced to `pending` and owned by that user. |
| Editing | Owners can only change `menu`, `policy`, `photos` and `avatar`. New pictures send the listing back to `pending`. Name, description, contact, status and `promoted` can only be changed by an admin or the service role. |
| Pictures | Bucket `listing-photos`: JPG/PNG/WebP, 2 MB max, each user can only upload into a folder named after their own user id. The site only shows pictures from this bucket. Admins see every picture before it goes live. |
| Reviews | Logged-in users only, one per business, never your own business. |
| Reports | Any logged-in user can send one. Only admins can read or clear them. |
| Accounts | Supabase Auth with an emailed code to confirm the address and to reset the password. Users can delete their account (Edge Function `delete-account`). |
| Browser | `vercel.json` sends a strict Content-Security-Policy: scripts only from this site (Supabase's library is copied into `js/vendor/`, pinned to 2.119.0), fonts from this site, pictures from this site or our Supabase bucket, no framing. No third-party trackers. |

## Setup checklist

1. **Supabase → SQL Editor:** run `supabase/security.sql` and the quick checks at the bottom of it.
2. **Supabase → Authentication → Emails → SMTP settings:** add your own SMTP (for example Resend, Brevo or Postmark). Supabase's built-in email is only for testing and sends very few emails an hour.
3. **Supabase → Authentication → Email templates:** "Confirm signup" and "Reset password" must contain `{{ .Token }}` (the 6-digit code), because the site asks for the code rather than a link.
4. **Supabase → Edge Functions → submit-post:** check it uses the service role key. If it doesn't, posting still works but everything lands as `pending`.
5. Fill in the Supabase region in `privacy.html` (the yellow placeholder).

## Admin jobs

```sql
-- see what is waiting (also shown in the site's Admin panel)
select id, name, what, flag_reason, created_at from public.businesses where status = 'pending' order by created_at;
-- approve / hide
update public.businesses set status = 'live', flag_reason = null where id = 123;
update public.businesses set status = 'pending' where id = 123;
-- make a business Sponsored in the spotlight (always labelled "Sponsored")
update public.businesses set promoted = true where id = 123;
```

## If something goes wrong

1. **A bad listing is showing:** set its status to `pending` (above) or remove it in the Admin panel.
2. **Spam flood:** temporarily turn off new sign-ups in Supabase → Authentication → Providers → Email.
3. **A key leaked:** the publishable key is public anyway. If the service role key or a database password leaks, rotate it in Supabase → Settings → API, then update the Edge Function secrets.
