# Security (main branch)

The main branch is a static website. The home page reads listings from Supabase, and sends new ones to it, using Supabase's public ("publishable") key. That key is meant to be public, so **all protection lives in Supabase's Row Level Security rules**, set by `supabase/security.sql`. Accounts, messages and reviews on the other pages are a demo that is stored only in the visitor's browser.

## What is in place

| Area | How |
|---|---|
| Database rules | `supabase/security.sql`: the public can read **approved** listings and submit new ones (not approved, only the form's own fields). Nobody can edit, delete or approve through the public key. Field lengths are capped. At most 30 submissions an hour across the site. Tested against Postgres with the `anon` role. |
| Moderation | New listings are hidden until you set `approved = true`. The Featured spotlight only shows businesses where you set `promoted = true`. |
| Demo features | Accounts, messages and reviews are kept only in the visitor's browser and say so. Messaging a real listing shows its contact details instead of pretending to send. |
| Browser | `vercel.json` sets a strict Content-Security-Policy (scripts only from this site, connections only to this site and your Supabase project), HSTS, no framing, `nosniff`, `Referrer-Policy` and `Permissions-Policy`. All scripts are files; there are no inline scripts. |
| Third parties | No outside scripts at all: the site talks to Supabase with plain `fetch` (`js/api.js`), and fonts are self-hosted. No analytics. |
| Escaping | Every listing field is escaped before it's shown, so a listing can't inject code. |
| Published files | `.vercelignore` keeps `server/`, `docs/`, `supabase/` and Markdown files off the website. |
| Legal | `privacy.html` and `terms.html`, linked from the footer and both forms. |

## Owner set-up

1. **Supabase → SQL Editor:** paste and run `supabase/security.sql`, then run the two check queries at the bottom. RLS should be on, with only the four policies.
   This hides the 8 example listings, which aren't real businesses. Approve only real listings.
2. **Supabase → Settings → API:** never put the `service_role` or `sb_secret_…` key in the website or GitHub. If one ever was, rotate it.
3. **Supabase → Authentication → Providers:** turn off sign-ups, since the site doesn't use Supabase accounts.
4. **Supabase → Database → Backups:** automatic daily backups need the Pro plan. Either upgrade, or export the two tables regularly (Table Editor → Export to CSV).
5. **Supabase → Settings → General:** note your region and put it in `privacy.html` (the one yellow placeholder).
6. **Supabase → Reports / Logs:** check for unusual numbers of inserts. Set a spend cap (Billing → Spend cap on).
7. **Vercel:** keep Deployment Protection on for Preview deployments. Set a spend limit if you're on Pro.

## Approving and removing listings

```sql
select id, name, what, contact, created_at from public.businesses where not approved order by created_at desc;
update public.businesses set approved = true where id = 123;
delete from public.businesses where id = 123;   -- spam, or the owner asked
```

The same queries work for `public.societies`.

## If something goes wrong

1. **Spam or a bad listing is showing:** `update … set approved = false where id = …` hides it at once.
2. **Being flooded:** in Supabase → Table Editor, temporarily remove the "anyone can submit" policies, or lower the 30 in the throttle function.
3. **A secret key leaked:** Supabase → Settings → API → roll the key, then check the logs.
4. **Take the site down:** Vercel → Deployments → Instant Rollback, or a Firewall rule that blocks all traffic.
5. **Personal data exposed:** if it's likely to harm people, report it to the ICO within 72 hours (ico.org.uk) and tell those affected.

## Monthly

- Review waiting and approved listings.
- Check Supabase usage and logs.
- Export a backup.

## Not yet possible on this branch

There's no server, so there's no bot check (CAPTCHA) and no per-person rate limit on submissions. The approval step and the 30-an-hour cap are what stop spam. Real accounts, messaging and reviews need a backend. The `ui-rework` branch has one, with secure sessions, email confirmation, password reset and rate limits.
