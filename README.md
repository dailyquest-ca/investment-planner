# Finpath

A web app to plan your financial path — project net worth over time with customizable Canadian tax rules, mortgage calculations, HELOC strategies, and retirement assumptions.

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

Then open http://localhost:3000.

## Test

```bash
npm test            # run once
npm run test:watch  # watch mode
```

## Build

```bash
npm run build
npm start           # serve production build locally
```

## Deploy

The app auto-deploys to [Vercel](https://vercel.com) on every push to `main`.

- **Vercel project**: `investment-planner` (under `dailyquest-ca`)
- **GitHub repo**: [dailyquest-ca/investment-planner](https://github.com/dailyquest-ca/investment-planner)
- **Production URL**: [investment-planner.dailyquest.ca](https://investment-planner.dailyquest.ca)
- **Database**: Neon Postgres (`investment_planner` database)

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Vercel (Production) | Neon Postgres connection string |

### Auto-push after commit

To have every `git commit` automatically push to `main` (so Vercel deploys without running `git push` yourself):

```bash
npm run setup:auto-push
```

## Tech stack

- Next.js 15 (App Router)
- React 18 + TypeScript
- Tailwind CSS
- Recharts
- Vitest (testing)
- Neon Postgres (user data persistence)
- Vercel (hosting + serverless)

## Project structure

```
app/
  layout.tsx              Root layout (HTML shell, metadata, global CSS)
  page.tsx                Single page, imports the client-side planner
  api/
    scenarios/
      route.ts            GET/POST/DELETE for scenario persistence
src/
  components/             React UI components (client-side)
    Planner.tsx           Main planner component
    SyncPanel.tsx         Cloud sync status and sync code UI
    BuyingInputPanel.tsx  Input sidebar
    BuyingNetWorthChart.tsx
    BuyingForecastTable.tsx
  lib/
    domain/               Pure finance domain modules (tax, mortgage, accounts, heloc)
    __tests__/            Vitest test suites (127 tests)
    buyingProjection.ts   Projection orchestrator
    sync.ts               Cloud sync client
  types/                  TypeScript type definitions
```
