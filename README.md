# Investment Planner

A web app to project net worth over time, with customizable Canadian tax rules, mortgage calculations, HELOC strategies, and retirement assumptions.

## Features

- **Custom inputs**: Household income, expenses, property details, HELOC strategy, registered accounts (TFSA, RRSP, FHSA).
- **Net worth chart**: Year-by-year balance projections with cash flow breakdown.
- **Canadian rules**: Federal + BC tax brackets, CMHC mortgage insurance, semi-annual compounding, RRSP/TFSA limits.
- **Insights**: Balance at retirement, investment withdrawal projections, and optimization suggestions.

## Run locally

```bash
cd investment-planner
npm install
npm run dev
```

Then open http://localhost:5173.

## Test

```bash
npm test            # run once
npm run test:watch  # watch mode
```

## Build

```bash
npm run build
npm run preview   # optional: preview production build
```

## Deploy to Vercel

The app is hosted on [Vercel](https://vercel.com) with the project name `investment-planner`.

1. Install the Vercel CLI: `npm i -g vercel`
2. Link the project: `vercel link`
3. Deploy to production: `vercel --prod`

Or connect the GitHub repo via the Vercel dashboard for automatic deploys on every push to `main`.

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Production URL:** [invest.dailyquest.ca](https://invest.dailyquest.ca)

### Auto-push after commit

To have every `git commit` automatically push to `main` (so Vercel deploys without running `git push` yourself):

```bash
npm run setup:auto-push
```

Then just stage and commit in Cursor; push happens after each commit.

## Tech stack

- React 18 + TypeScript
- Vite 5
- Tailwind CSS
- Recharts
- Vitest (testing)
- Neon Postgres (user data persistence)
- Vercel (hosting + serverless functions)

## Project structure

```
src/
  lib/
    domain/          # Pure finance domain modules (tax, mortgage, accounts, heloc)
    __tests__/       # Vitest test suites
    buyingProjection.ts   # Projection orchestrator
    canadianTax.ts        # Re-exports from domain/tax
    canadianMortgageInsurance.ts
  components/        # React UI components
  types/             # TypeScript type definitions
  api/               # Vercel serverless functions (auth, scenarios)
```
