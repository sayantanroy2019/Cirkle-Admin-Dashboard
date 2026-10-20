import { describe, it, expect } from 'vitest'
import { describeDependents, describeOutcome, isCancelled } from './eventDeletion'
import { formatPaise } from './format'

// The words in the delete dialog are the whole safety net between an admin
// and an irreversible action, so they are pinned here.

const zero = {
  orders: 0, paidOrders: 0, paidPaise: 0, tickets: 0, invitations: 0,
  categories: 0, artists: 0, photos: 0, coupons: 0, promoPopups: 0,
}

describe('isCancelled', () => {
  it('reads cancelledAt and nothing else', () => {
    expect(isCancelled({ cancelledAt: '2026-10-20T10:00:00Z' })).toBe(true)
    expect(isCancelled({ cancelledAt: null })).toBe(false)
    expect(isCancelled(null)).toBe(false)
    expect(isCancelled({})).toBe(false)
  })
})

describe('describeDependents', () => {
  it('drops zeros and pluralises, including the irregular one', () => {
    expect(describeDependents({ ...zero, categories: 2, artists: 1, photos: 4, coupons: 1 })).toEqual([
      '2 ticket categories', '1 artist', '4 gallery photos', '1 coupon',
    ])
    expect(describeDependents({ ...zero, categories: 1, promoPopups: 1, invitations: 3 })).toEqual([
      '1 ticket category', '1 promo popup', '3 invitations',
    ])
  })
  it('is empty when nothing hangs off the event', () => {
    expect(describeDependents(zero)).toEqual([])
    expect(describeDependents(undefined)).toEqual([])
  })
})

describe('describeOutcome', () => {
  it('delete: says permanent, says no undo', () => {
    const d = describeOutcome({ outcome: 'delete', counts: zero })
    expect(d.title).toMatch(/permanently deleted/)
    expect(d.body).toMatch(/no undo/)
    expect(d.confirmLabel).toBe('Delete permanently')
  })

  it('cancel with sales: leads with tickets, paid orders and the rupee liability', () => {
    const counts = { ...zero, orders: 33, paidOrders: 31, paidPaise: 12400000, tickets: 42 }
    const d = describeOutcome({ outcome: 'cancel', counts })
    expect(d.title).toMatch(/cancelled, not deleted/)
    expect(d.body.startsWith(`42 tickets across 31 paid orders — ${formatPaise(12400000)} collected`)).toBe(true)
    expect(d.body).toMatch(/refunding by hand/)
    expect(d.body).toMatch(/stay in Oversight/)
    expect(d.body).not.toMatch(/invitation/)
    expect(d.confirmLabel).toBe('Cancel event')
  })

  it('cancel with only failed orders: says none were paid, no rupee figure', () => {
    const counts = { ...zero, orders: 2, tickets: 0 }
    const d = describeOutcome({ outcome: 'cancel', counts })
    expect(d.body.startsWith('2 orders, none of them paid.')).toBe(true)
    expect(d.body).not.toMatch(/₹/)
  })

  it('cancel with only invitations: names them and nothing about money', () => {
    const counts = { ...zero, invitations: 1 }
    const d = describeOutcome({ outcome: 'cancel', counts })
    expect(d.body.startsWith('1 invitation requested.')).toBe(true)
    expect(d.body).not.toMatch(/paid order|none of them paid|₹/)
  })

  it('singulars read naturally', () => {
    const counts = { ...zero, orders: 1, paidOrders: 1, paidPaise: 59000, tickets: 1, invitations: 1 }
    const d = describeOutcome({ outcome: 'cancel', counts })
    expect(d.body).toMatch(/^1 ticket across 1 paid order — /)
    expect(d.body).toMatch(/ 1 invitation requested\./)
  })
})
