/**
 * Re-exports from the domain tax module for backward compatibility.
 * New code should import from '@/src/lib/domain/tax' directly.
 */
export { calculateIncomeTax, getMarginalRate, type TaxResult } from './domain/tax';
