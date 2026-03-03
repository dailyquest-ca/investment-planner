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

## Deploy to Cloudflare Pages

1. **Workers & Pages > Create > Pages > Connect to Git** and select this repo.
2. Set **Framework preset** to **None** (do not use the Vite preset, or the build will fail).
3. **Build command:** `npm run build`
4. **Build output directory:** `dist`
5. Optional: set **NODE_VERSION** = `20` in the build environment variables, or rely on the repo’s `.nvmrc`.

Each push to `main` triggers a build and deploy on Cloudflare.

### Auto-push after commit

To have every `git commit` automatically push to `main` (so Cloudflare deploys without running `git push` yourself):

```bash
npm run setup:auto-push
```

Then just stage and commit in Cursor (Source Control or terminal); push happens after each commit.

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
