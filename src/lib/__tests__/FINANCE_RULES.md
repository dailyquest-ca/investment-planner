# Canadian Finance Rule Matrix

Source of truth for test assertions. Rules are from CRA, CMHC, OSFI, and BC provincial sources for the 2026 tax year.

## Federal Income Tax (2026)

| Bracket | Rate | Source |
|---------|------|--------|
| $0 - $58,523 | 14% | CRA |
| $58,523 - $117,045 | 20.5% | CRA |
| $117,045 - $181,440 | 26% | CRA |
| $181,440 - $258,482 | 29% | CRA |
| Over $258,482 | 33% | CRA |

- Basic Personal Amount (BPA): $16,452 (max), applied as a non-refundable credit at lowest bracket rate (14%).
- BPA phases out between $181,440 and $258,482 to a minimum of $14,829. **App currently ignores phase-out.**

## BC Provincial Income Tax (2026)

| Bracket | Rate | Source |
|---------|------|--------|
| $0 - $50,363 | 5.06% (proposed 5.60%) | BC Gov |
| $50,363 - $100,728 | 7.70% | BC Gov |
| $100,728 - $115,648 | 10.50% | BC Gov |
| $115,648 - $140,430 | 12.29% | BC Gov |
| $140,430 - $190,405 | 14.70% | BC Gov |
| $190,405 - $265,545 | 16.80% | BC Gov |
| Over $265,545 | 20.50% | BC Gov |

- BC BPA: **$13,216** (2026). App currently uses $12,932 which is **wrong**.
- BC BPA credit rate: 5.06% (or 5.60% if proposed rate passes). App uses 5.6%.

## Mortgage Payment Calculation

- **Canadian mortgages compound semi-annually by law**, not monthly.
- Effective monthly rate: `(1 + annual_rate/2)^(1/6) - 1`
- App currently uses `annual_rate / 12` which is **US-style monthly compounding and wrong for Canada**.

## CMHC Mortgage Insurance (2025-2026)

| Down Payment % | Premium (% of mortgage) | Source |
|----------------|-------------------------|--------|
| 5% - 9.99% | 4.00% | CMHC |
| 10% - 14.99% | 3.10% | CMHC |
| 15% - 19.99% | 2.80% | CMHC |
| 20%+ | Not required | CMHC |

- Purchase price must be < $1,000,000.
- Max insured amortization: 25 years (30 for first-time buyers on new builds).
- Minimum down payment: 5% on first $500K, 10% on portion above $500K.
- Premium rolled into mortgage principal. **App models this correctly.**

## RRSP Rules (2026)

- Annual contribution room: lesser of 18% of prior year earned income or $33,810.
- Unused room carries forward indefinitely.
- Withdrawals are fully taxable as ordinary income.
- Home Buyers' Plan (HBP): $60,000 per person max withdrawal for first home purchase.
- HBP repayment: 1/15th annually over 15 years. **App does not model HBP repayment.**

## TFSA Rules (2026)

- Annual contribution limit: $7,000 per person.
- Withdrawals are tax-free.
- Withdrawn amounts regain contribution room on January 1 of the **following** year.
- Unused room carries forward indefinitely.
- **App models regain timing correctly (pendingTfsaRegain delays one year).**

## FHSA Rules (2026)

- $8,000 annual contribution limit, $40,000 lifetime.
- Contributions are tax-deductible (like RRSP).
- Qualifying withdrawals for first home are tax-free with no repayment required.
- Can be combined with HBP.
- **App only models FHSA as a starting balance for down payment, does not model ongoing contributions or deductibility.**

## Capital Gains (2026)

- First $250,000/year: 50% inclusion rate.
- Above $250,000/year: 66.67% inclusion rate.
- **App uses flat 50% inclusion rate, missing the tiered structure.**

## Eligible Dividends (Canadian)

- Gross-up rate: 38% (eligible dividends).
- Federal dividend tax credit: 15.0198% of grossed-up amount.
- BC dividend tax credit: 12% of grossed-up amount.
- **App taxes dividend income as ordinary income, missing the gross-up/credit mechanism entirely.**

## HELOC Rules

- Maximum HELOC: 65% of property value.
- Combined mortgage + HELOC: max 80% of property value.
- Interest deductible when borrowed funds used for income-producing investments (Smith Manoeuvre).
- **App models these caps correctly.**

## Summary of Discrepancies

| Area | Status | Severity |
|------|--------|----------|
| Federal tax brackets | Correct | - |
| Federal BPA | Correct (ignores phase-out) | Low |
| BC BPA amount | Wrong ($12,932 vs $13,216) | Medium |
| Mortgage compounding | Wrong (monthly vs semi-annual) | High |
| CMHC insurance | Correct | - |
| RRSP room/limits | Correct | - |
| HBP repayment | Not modeled | Low |
| TFSA regain timing | Correct | - |
| FHSA contributions | Not modeled (balance only) | Low |
| Capital gains tiering | Simplified (flat 50%) | Medium |
| Dividend tax treatment | Missing (taxed as ordinary) | Medium |
| HELOC caps | Correct | - |
