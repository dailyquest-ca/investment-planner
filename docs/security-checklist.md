# Security Checklist

Use this checklist when launching new auth-enabled apps, after secret rotation,
or during periodic security reviews.

## Authentication boundary

- [ ] Cloud data APIs require session-derived identity only — no client headers
- [ ] `allowDangerousEmailAccountLinking` is intentional and documented (both
      providers verify email ownership)
- [ ] Sign-in page handles errors gracefully (no secret leakage in UI)
- [ ] Session expiry is configured (Auth.js default: 30 days)

## Environment & secrets

- [ ] `AUTH_SECRET` is set and unique per environment (Dev / Preview / Production)
- [ ] `AUTH_SECRET` was generated with `npx auth secret` (≥ 32 bytes)
- [ ] `DATABASE_URL` points to the correct Neon project/branch per environment
- [ ] Vercel env vars have correct target scoping (Production / Preview / Development)
- [ ] No literal quotes wrap values in Vercel env UI
- [ ] `AUTH_EMAIL_FROM` domain is verified in Resend
- [ ] Google OAuth redirect URIs match each deployment URL exactly
- [ ] `/api/health` returns 200 with all checks passing

## Secret rotation procedure

1. **AUTH_SECRET**: Generate new value → set in Vercel → redeploy → existing
   sessions will expire (users re-authenticate). No data loss.
2. **AUTH_GOOGLE_SECRET**: Rotate in Google Cloud Console → update in Vercel →
   redeploy. Existing Google-linked accounts continue to work.
3. **AUTH_RESEND_KEY**: Rotate in Resend dashboard → update in Vercel → redeploy.
   Only affects new magic-link sends.
4. **DATABASE_URL**: If Neon endpoint changes, update in Vercel → redeploy → run
   `npm run db:migrate` against new endpoint.

## API hardening

- [ ] Scenario payloads are validated (JSONB, plain object, no arrays)
- [ ] Payload size limited to 256 KB
- [ ] Scenario count per user limited to 20
- [ ] Scenario name truncated to 100 characters
- [ ] Rate limiting active on `/api/*` routes (60 req/min per IP)
- [ ] DELETE requires explicit `id` query parameter

## Browser storage

- [ ] Authenticated users do NOT write financial data to localStorage
- [ ] Anonymous draft uses localStorage only — cleared on cloud sync
- [ ] No secrets, tokens, or session data stored in localStorage
- [ ] CSP headers set via `next.config.ts`

## Database

- [ ] Schema changes go through numbered migrations in `/migrations/`
- [ ] Runtime `ensureSchema()` is removed from request handlers
- [ ] `user_id` foreign keys reference Auth.js `users(id)`
- [ ] Migration script tested: `npm run db:status` and `npm run db:migrate`

## Deployment

- [ ] Vercel project connected to Git repo for automatic deploys
- [ ] Custom domain verified with TLS
- [ ] Build completes without errors: `npx next build`
- [ ] Health check after deploy: `curl https://your-domain/api/health`
