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
  it.each([
    ['generateColonyId', generateColonyId, 'col_'],
    ['generateCorpId', generateCorpId, 'corp_'],
    ['generateContractId', generateContractId, 'ctr_'],
    ['generateShipId', generateShipId, 'ship_'],
    ['generateMissionId', generateMissionId, 'msn_'],
    ['generateSectorId', generateSectorId, 'sec_'],
    ['generatePlanetId', generatePlanetId, 'pln_'],
    ['generateEventId', generateEventId, 'evt_'],
    ['generateModifierId', generateModifierId, 'mod_'],
  ] as const)('%s returns id starting with %s', (_name, fn, prefix) => {
    expect(fn().startsWith(prefix)).toBe(true)
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
