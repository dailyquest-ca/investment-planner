import { describe, it, expect } from 'vitest';
import {
  newRrspRoom,
  tfsaRoomAvailable,
  allocateDownPayment,
  RRSP_ANNUAL_MAX,
  RRSP_ROOM_RATE,
  HBP_WITHDRAWAL_LIMIT,
  TFSA_ANNUAL_LIMIT_PER_PERSON,
} from '../domain/accounts';

describe('newRrspRoom', () => {
  it('returns 18% of prior year income when under the cap', () => {
    expect(newRrspRoom(100_000)).toBeCloseTo(18_000, 0);
  });

  it('caps at the RRSP annual maximum ($33,810)', () => {
    expect(newRrspRoom(300_000)).toBe(RRSP_ANNUAL_MAX);
  });

  it('returns zero for zero income', () => {
    expect(newRrspRoom(0)).toBe(0);
  });

  it('hits the cap at exactly $187,833 of income (18% = $33,810)', () => {
    const threshold = RRSP_ANNUAL_MAX / RRSP_ROOM_RATE;
    expect(newRrspRoom(threshold)).toBeCloseTo(RRSP_ANNUAL_MAX, 0);
    expect(newRrspRoom(threshold + 10_000)).toBe(RRSP_ANNUAL_MAX);
  });
});

describe('tfsaRoomAvailable', () => {
  it('returns initial room when nothing has been used and no years elapsed', () => {
    expect(tfsaRoomAvailable(14_000, 14_000, 0, 0, 0)).toBe(14_000);
  });

  it('grows by annual increase each year', () => {
    expect(tfsaRoomAvailable(14_000, 14_000, 3, 0, 0)).toBe(14_000 + 14_000 * 3);
  });

  it('reduces by used room', () => {
    expect(tfsaRoomAvailable(14_000, 14_000, 0, 10_000, 0)).toBe(4_000);
  });

  it('increases by regained room from prior-year withdrawals', () => {
    expect(tfsaRoomAvailable(14_000, 14_000, 0, 14_000, 5_000)).toBe(5_000);
  });

  it('never returns negative', () => {
    expect(tfsaRoomAvailable(0, 0, 0, 50_000, 0)).toBe(0);
  });

  it('TFSA annual limit per person is $7,000 for 2026', () => {
    expect(TFSA_ANNUAL_LIMIT_PER_PERSON).toBe(7_000);
  });
});

describe('allocateDownPayment', () => {
  it('draws from FHSA first', () => {
    const result = allocateDownPayment(50_000, 40_000, 100_000, 100_000);
    expect(result.amountFromFHSA).toBe(40_000);
    expect(result.amountFromRRSP).toBe(10_000);
    expect(result.amountFromTFSA).toBe(0);
  });

  it('caps RRSP withdrawal at HBP limit ($60,000)', () => {
    const result = allocateDownPayment(100_000, 0, 200_000, 200_000);
    expect(result.amountFromRRSP).toBe(HBP_WITHDRAWAL_LIMIT);
    expect(result.amountFromTFSA).toBe(40_000);
  });

  it('uses TFSA for remainder after FHSA and RRSP', () => {
    const result = allocateDownPayment(80_000, 10_000, 30_000, 100_000);
    expect(result.amountFromFHSA).toBe(10_000);
    expect(result.amountFromRRSP).toBe(30_000);
    expect(result.amountFromTFSA).toBe(40_000);
  });

  it('reports unfunded remainder when all accounts are insufficient', () => {
    const result = allocateDownPayment(200_000, 10_000, 20_000, 30_000);
    expect(result.amountFromFHSA).toBe(10_000);
    expect(result.amountFromRRSP).toBe(20_000);
    expect(result.amountFromTFSA).toBe(30_000);
    expect(result.remainder).toBe(140_000);
  });

  it('handles zero down payment', () => {
    const result = allocateDownPayment(0, 10_000, 20_000, 30_000);
    expect(result.amountFromFHSA).toBe(0);
    expect(result.amountFromRRSP).toBe(0);
    expect(result.amountFromTFSA).toBe(0);
    expect(result.remainder).toBe(0);
  });

  it('HBP limit for 2026 is $60,000', () => {
    expect(HBP_WITHDRAWAL_LIMIT).toBe(60_000);
  });
});
