# Scale & Cost Assumptions

Recorded assumptions for hosting costs as the product scales. These estimates
are based on the current architecture (Vercel + Neon) and usage patterns as of
March 2026.

## Architecture summary

| Component       | Service     | Current tier |
|-----------------|-------------|-------------|
| Frontend / SSR  | Vercel      | Hobby (free) or Pro ($20/mo) |
| Database        | Neon        | Free or Launch ($19/mo) |
| Email (auth)    | Resend      | Free tier (3,000 emails/mo) |
| Domain / DNS    | Cloudflare  | Free |

## Usage model assumptions

- Each user has 1–5 scenarios (JSONB documents, ~5–20 KB each)
- Authenticated users hit the API on page load + debounced saves (~5–15 req/session)
- Average session duration: 5–15 minutes
- Monthly active users (MAU) visit ~2–4 times per month
- Future tracking layer: ~5 accounts × 12 snapshots/year per user

## Cost estimates

### 10,000 monthly active users

| Item | Estimate |
|------|----------|
| Vercel Pro | $20/mo base + ~$0–50 bandwidth overage |
| Neon Launch | $19/mo (0.5 GB compute, 10 GB storage) |
| Resend | Free tier likely sufficient (~30k emails/mo for magic links) |
| **Total** | **~$40–100/mo** |

Notes:
- 10k MAU × 3 visits × 10 API calls = ~300k API invocations/mo (well within Vercel Pro)
- DB storage: 10k users × 3 scenarios × 15 KB = ~450 MB (within Neon Launch 10 GB)
- Future tracking: 10k × 5 accounts × 12 months/yr × 5 yrs = 3M rows (~1–2 GB)

### 100,000 monthly active users

| Item | Estimate |
|------|----------|
| Vercel Pro | $20/mo base + $100–300 bandwidth/function overage |
| Neon Scale | $69/mo (autoscaling compute, 50 GB storage) |
| Resend Pro | $20/mo (50k emails/mo) or Growth ($80/mo) |
| **Total** | **~$200–500/mo** |

Notes:
- 100k MAU × 3 visits × 10 calls = ~3M API invocations/mo
- DB storage: 100k users × 3 scenarios × 15 KB = ~4.5 GB
- Future tracking at 5 yrs: ~30M rows (~10–15 GB — still comfortable on Neon Scale)
- If bandwidth spikes, Vercel Enterprise or CDN caching reduces per-request cost

### Scaling triggers

| Signal | Action |
|--------|--------|
| API latency > 500ms p95 | Check Neon compute scaling; add read replicas |
| DB storage > 80% tier limit | Upgrade Neon tier |
| Vercel function duration > 10s | Optimize queries, add caching |
| Rate-limit hits > 5% of requests | Consider Upstash Redis for distributed rate limiting |
| Email sends > tier limit | Upgrade Resend plan |

## Key risks

1. **Schema shape**: Full-document overwrites are fine for planning but will
   not scale for tracking. The append-only snapshot model documented in
   `data-model-target.md` must be implemented before adding historical tracking.

2. **Query fan-out**: Dashboard queries that aggregate across many accounts
   should be indexed and bounded. Never scan all users.

3. **Rate limiting**: The current in-memory rate limiter works per-instance.
   At scale (multiple Vercel instances), switch to Upstash Redis or Vercel KV
   for distributed enforcement.
