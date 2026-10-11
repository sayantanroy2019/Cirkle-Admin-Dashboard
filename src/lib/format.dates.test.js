import { describe, it, expect } from 'vitest'
import { isoToLocalInput, localInputToIso, shortId, titleCaseOrDash, fullName } from './format'

// The datetime-local bridge and the small display helpers every table uses.

describe('isoToLocalInput / localInputToIso', () => {
  it('round-trips to the minute in whatever zone the browser is in', () => {
    const iso = '2026-11-20T15:30:00.000Z'
    const local = isoToLocalInput(iso)
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(localInputToIso(local)).toBe(iso)
  })
  it('an empty or invalid value is an empty input / null, never "Invalid Date"', () => {
    expect(isoToLocalInput('')).toBe('')
    expect(isoToLocalInput(null)).toBe('')
    expect(isoToLocalInput('not a date')).toBe('')
    expect(localInputToIso('')).toBeNull()
    expect(localInputToIso('garbage')).toBeNull()
  })
})

describe('display helpers', () => {
  it('shortId shows the leading block of a UUID, a dash for none', () => {
    expect(shortId('26ae6389-7858-438d-a4aa-aab0d0fb8b0f')).toBe('26ae6389')
    expect(shortId(null)).toBe('—')
  })
  it('titleCaseOrDash capitalises and unsnakes', () => {
    expect(titleCaseOrDash('man')).toBe('Man')
    expect(titleCaseOrDash('invite_only')).toBe('Invite only')
    expect(titleCaseOrDash('')).toBe('—')
  })
  it('fullName joins what exists', () => {
    expect(fullName('Ada', 'Lovelace')).toBe('Ada Lovelace')
    expect(fullName('Ada', null)).toBe('Ada')
    expect(fullName(null, undefined)).toBe('—')
  })
})
