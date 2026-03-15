# Auth Setup Guide

Quick reference for configuring authentication on this project.

## Prerequisites

- Neon database with auth tables created (run `scripts/auth-schema.sql`)
- `AUTH_SECRET` generated via `npx auth secret`

## Email magic links (Resend)

1. Create a [Resend](https://resend.com) account and generate an API key.
2. Verify a sender domain in the Resend dashboard.
3. Set env vars:
   - `AUTH_RESEND_KEY` — your Resend API key
   - `AUTH_EMAIL_FROM` — e.g. `Finpath <noreply@yourdomain.com>`
4. Without a verified domain, Resend only delivers to your own account email.

## Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com), create an OAuth 2.0 client (Web application type).
2. Add authorized redirect URIs:
   - `https://<your-domain>/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`
3. Set env vars:
   - `AUTH_GOOGLE_ID` — Client ID
   - `AUTH_GOOGLE_SECRET` — Client Secret
4. If the OAuth consent screen is in **Testing** mode, add your email as a test user.

## Common issues

| Symptom | Likely cause |
|---|---|
| `invalid_client` from Google | Wrong/duplicated Client Secret, or ID and Secret from different OAuth clients |
| Resend 403 "testing domain restriction" | `AUTH_EMAIL_FROM` uses an unverified domain, or value has extra quotes |
| `OAuthAccountNotLinked` | User signed up via email then tried Google (or vice versa). Fixed in this project with `allowDangerousEmailAccountLinking`. |
| Vercel env var includes literal `"` | Vercel UI does not strip quotes — paste raw values only |
| Auth tables missing after DB change | `DATABASE_URL` changed (e.g. new Neon project). Re-run `scripts/auth-schema.sql`. |

## Vercel deployment

After setting env vars in Vercel, trigger a fresh deploy so the runtime picks up new values. Env vars can differ per environment (Production / Preview / Development).
