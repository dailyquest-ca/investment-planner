# Investment Planner

A simple web app to project net worth over time, with customizable interest rates, contributions, and retirement assumptions. You get forecasts of net worth (in today’s dollars), when you can retire (4% rule), and when you can wind down contributions.

## Features

- **Custom inputs**: Current savings, monthly contribution, expected return %, inflation %, current/target age, annual spending in retirement, and projection length.
- **Net worth chart**: Year-by-year balance in inflation-adjusted (real) dollars.
- **Insights**: Balance at retirement, year you reach 25× spending (4% rule), and year when growth covers contributions (wind-down).

## Run locally

```bash
cd investment-planner
npm install
npm run dev
```

Then open http://localhost:5173.

## Build

```bash
npm run build
npm run preview   # optional: preview production build
```

## Deploy to Cloudflare Pages (recommended: GitHub Actions + Direct Upload)

Cloudflare’s “Connect to Git” build injects `@cloudflare/vite-plugin`, which breaks with Vite 5. This repo uses **Direct Upload**: the app is built in GitHub Actions and only the built `dist` folder is uploaded to Pages.

### One-time setup

1. **Create a Pages project for Direct Upload**
   - In Cloudflare: **Workers & Pages > Create > Pages > Direct Upload**.
   - Project name: `investment-planner` (or change `--project-name` in `.github/workflows/deploy-pages.yml`).

2. **Create a Cloudflare API token**
   - [API Tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → use “Edit Cloudflare Workers” template or custom with **Account > Cloudflare Pages > Edit**.
   - Copy the token.

3. **Add GitHub secrets**
   - Repo **Settings > Secrets and variables > Actions** → New repository secret:
   - `CLOUDFLARE_API_TOKEN`: the token from step 2.
   - `CLOUDFLARE_ACCOUNT_ID`: your Account ID (Cloudflare dashboard, right-hand side).

After that, every push to `main` runs the workflow: build in GitHub Actions, then deploy `dist` to Cloudflare Pages. No build runs on Cloudflare’s side.

## Tech stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Recharts (area chart)

## Aligning with your Google Sheets

The projection logic in `src/lib/projection.ts` uses:

- Compound growth: balance grows by `(1 + annualReturn)^(1/12)` each month.
- Monthly contributions added before retirement age.
- Inflation: all “real” numbers are in today’s dollars using your inflation assumption.
- Retirement: contributions stop at target age; withdrawals equal annual spending (inflation-adjusted each year).
- **Retirement ready**: first year when balance (real) ≥ 25 × annual spending (4% rule).
- **Wind-down**: first year when portfolio growth exceeds your annual contributions.

You can change formulas in `projection.ts` to match your spreadsheet (e.g. different withdrawal rule, extra income, or one-off events).
