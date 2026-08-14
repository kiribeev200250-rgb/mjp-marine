import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { computeDiscountAmount } from '@/lib/crm/documentJobs'

describe('computeDiscountAmount', () => {
  it('returns zero for NONE', () => {
    expect(computeDiscountAmount(new Decimal(100), 'NONE', 50).toString()).toBe('0')
    expect(computeDiscountAmount(new Decimal(100), undefined, undefined).toString()).toBe('0')
  })

  it('computes a percentage discount off the catalog subtotal', () => {
    expect(computeDiscountAmount(new Decimal(200), 'PERCENT', 10).toString()).toBe('20')
  })

  it('computes a fixed discount as-is', () => {
    expect(computeDiscountAmount(new Decimal(200), 'FIXED', 15).toString()).toBe('15')
  })

  it('rejects a negative discount value', () => {
    expect(() => computeDiscountAmount(new Decimal(100), 'PERCENT', -5)).toThrow()
    expect(() => computeDiscountAmount(new Decimal(100), 'FIXED', -5)).toThrow()
  })

  it('rejects a percentage discount over 100%', () => {
    expect(() => computeDiscountAmount(new Decimal(100), 'PERCENT', 150)).toThrow()
  })

  it('rejects a fixed discount larger than the catalog subtotal', () => {
    expect(() => computeDiscountAmount(new Decimal(100), 'FIXED', 150)).toThrow()
  })

  it('rounds a percentage discount to 2 decimal places', () => {
    // 33.333... * 15% = 4.99995 -> 5.00
    expect(computeDiscountAmount(new Decimal('33.333'), 'PERCENT', 15).toString()).toBe('5')
  })
})
