import { describe, it, expect } from 'vitest'
import { rupeeInputToPaise, paiseToRupeeInput, formatPaise } from './format'

// Rupee form inputs ↔ paise. Every money field in the portal (wallet
// settings, menus, coupons) goes through these two; a wrong rounding here
// would reach the ledger.

describe('rupeeInputToPaise', () => {
  it('whole rupees', () => {
    expect(rupeeInputToPaise('599')).toBe(59900)
    expect(rupeeInputToPaise('0')).toBe(0)
  })
  it('rupees and paise', () => {
    expect(rupeeInputToPaise('599.50')).toBe(59950)
    expect(rupeeInputToPaise('599.5')).toBe(59950)
    expect(rupeeInputToPaise('.99')).toBe(99)
  })
  it('more than two decimals are rounded to the nearest paisa', () => {
    expect(rupeeInputToPaise('599.999')).toBe(60000)
    expect(rupeeInputToPaise('599.994')).toBe(59999)
  })
  it('floating-point traps still land on the right paisa', () => {
    expect(rupeeInputToPaise('1.15')).toBe(115)
    expect(rupeeInputToPaise('0.07')).toBe(7)
    expect(rupeeInputToPaise('4.35')).toBe(435)
  })
  it('surrounding whitespace is ignored; a number is accepted as-is', () => {
    expect(rupeeInputToPaise('  250 ')).toBe(25000)
    expect(rupeeInputToPaise(250)).toBe(25000)
  })
  it('empty, null and undefined mean "no value" → null', () => {
    expect(rupeeInputToPaise('')).toBeNull()
    expect(rupeeInputToPaise('   ')).toBeNull()
    expect(rupeeInputToPaise(null)).toBeNull()
    expect(rupeeInputToPaise(undefined)).toBeNull()
  })
  it('non-numeric and negative input is rejected with null', () => {
    expect(rupeeInputToPaise('abc')).toBeNull()
    expect(rupeeInputToPaise('₹500')).toBeNull()
    expect(rupeeInputToPaise('12,000')).toBeNull()
    expect(rupeeInputToPaise('-5')).toBeNull()
  })
})

describe('paiseToRupeeInput', () => {
  it('whole rupees have no decimals; paise show two', () => {
    expect(paiseToRupeeInput(50000)).toBe('500')
    expect(paiseToRupeeInput(50050)).toBe('500.50')
    expect(paiseToRupeeInput(5)).toBe('0.05')
  })
  it('null and undefined are an empty input', () => {
    expect(paiseToRupeeInput(null)).toBe('')
    expect(paiseToRupeeInput(undefined)).toBe('')
  })
  it('round-trips with rupeeInputToPaise', () => {
    for (const p of [0, 1, 99, 100, 59900, 59950, 123456]) expect(rupeeInputToPaise(paiseToRupeeInput(p))).toBe(p)
  })
})

describe('formatPaise', () => {
  it('Indian grouping, no decimals for whole rupees, two otherwise', () => {
    expect(formatPaise(59900)).toBe('₹599')
    expect(formatPaise(59950)).toBe('₹599.50')
    expect(formatPaise(12345600)).toBe('₹1,23,456')
  })
  it('a missing amount is a dash', () => {
    expect(formatPaise(null)).toBe('—')
    expect(formatPaise(undefined)).toBe('—')
    expect(formatPaise(NaN)).toBe('—')
  })
})
