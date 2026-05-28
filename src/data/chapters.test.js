import { describe, it, expect, vi } from 'vitest'
import { buildChapter } from './chapters'

vi.mock('./milestones', () => ({ uid: () => 'test-id-123' }))
vi.mock('./db', () => ({
  dbGetAllChapters: vi.fn(),
  dbGetChapter:     vi.fn(),
  dbAddChapter:     vi.fn(x => x),
  dbPutChapter:     vi.fn(x => x),
  dbDeleteChapter:  vi.fn(),
}))

describe('buildChapter', () => {
  it('sets end to null for ongoing chapters', () => {
    const ch = buildChapter({ title: 'Career', start: '2020-01-01T00:00:00.000Z', end: null, color: '#C8A96E' })
    expect(ch.end).toBeNull()
  })

  it('preserves ISO string end date', () => {
    const ch = buildChapter({ title: 'School', start: '2018-09-01T00:00:00.000Z', end: '2022-06-01T00:00:00.000Z', color: '#C8A96E' })
    expect(ch.end).toBe(new Date('2022-06-01T00:00:00.000Z').toISOString())
  })

  it('converts Date object end to ISO string', () => {
    const endDate = new Date('2023-12-31')
    const ch = buildChapter({ title: 'Project', start: '2023-01-01T00:00:00.000Z', end: endDate, color: '#C8A96E' })
    expect(ch.end).toBe(endDate.toISOString())
  })

  it('includes required fields', () => {
    const ch = buildChapter({ title: 'Test', start: '2020-01-01T00:00:00.000Z', end: null, color: '#3D3580' })
    expect(ch.id).toBe('test-id-123')
    expect(ch.title).toBe('Test')
    expect(ch.milestoneIds).toEqual([])
  })
})
