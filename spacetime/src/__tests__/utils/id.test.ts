/**
 * id.test.ts — Unit tests for ID generation utilities.
 */

import { describe, it, expect } from 'vitest'
import {
  generateId,
  generateColonyId,
  generateCorpId,
  generateContractId,
  generateShipId,
  generateMissionId,
  generateSectorId,
  generatePlanetId,
  generateEventId,
  generateModifierId,
} from '../../utils/id'

describe('generateId', () => {
  it('generates a string with the given prefix', () => {
    const id = generateId('test')
    expect(id.startsWith('test_')).toBe(true)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId('x')))
    expect(ids.size).toBe(100)
  })

  it('has correct format: prefix_nanoid', () => {
    const id = generateId('col')
    const parts = id.split('_')
    expect(parts.length).toBe(2)
    expect(parts[0]).toBe('col')
    expect(parts[1]!.length).toBeGreaterThan(0)
  })
})

describe('Typed ID generators', () => {
  it('generateColonyId returns id starting with col_', () => {
    expect(generateColonyId().startsWith('col_')).toBe(true)
  })

  it('generateCorpId returns id starting with corp_', () => {
    expect(generateCorpId().startsWith('corp_')).toBe(true)
  })

  it('generateContractId returns id starting with ctr_', () => {
    expect(generateContractId().startsWith('ctr_')).toBe(true)
  })

  it('generateShipId returns id starting with ship_', () => {
    expect(generateShipId().startsWith('ship_')).toBe(true)
  })

  it('generateMissionId returns id starting with msn_', () => {
    expect(generateMissionId().startsWith('msn_')).toBe(true)
  })

  it('generateSectorId returns id starting with sec_', () => {
    expect(generateSectorId().startsWith('sec_')).toBe(true)
  })

  it('generatePlanetId returns id starting with pln_', () => {
    expect(generatePlanetId().startsWith('pln_')).toBe(true)
  })

  it('generateEventId returns id starting with evt_', () => {
    expect(generateEventId().startsWith('evt_')).toBe(true)
  })

  it('generateModifierId returns id starting with mod_', () => {
    expect(generateModifierId().startsWith('mod_')).toBe(true)
  })

  it('all typed generators produce unique IDs', () => {
    const ids = new Set([
      generateColonyId(),
      generateCorpId(),
      generateContractId(),
      generateShipId(),
    ])
    expect(ids.size).toBe(4)
  })
})
