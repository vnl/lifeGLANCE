import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../data/milestones', () => ({ restoreMilestones: vi.fn() }))
vi.mock('../data/chapters', () => ({ restoreChapters: vi.fn() }))
vi.mock('../data/db', () => ({ dbPutPhoto: vi.fn(), dbPut: vi.fn() }))

import { parseBackup, importBackup } from '../utils/importBackup'
import { restoreMilestones } from '../data/milestones'
import { restoreChapters } from '../data/chapters'
import { dbPutPhoto, dbPut } from '../data/db'

beforeEach(() => { vi.clearAllMocks() })

const MILESTONE = {
  id: 'abc123', title: 'Test', date: '2020-01-01T00:00:00.000Z',
  has_photo: false, category: 'personal', color: '#9370DB',
}
const CHAPTER = { id: 'ch1', title: 'My Chapter', start: '2018-01-01', end: '2020-01-01' }

describe('parseBackup', () => {
  it('parses current format { milestones, photos, chapters }', () => {
    const json = JSON.stringify({ milestones: [MILESTONE], photos: {}, chapters: [CHAPTER] })
    const result = parseBackup(json)
    expect(result.milestones).toHaveLength(1)
    expect(result.chapters).toHaveLength(1)
    expect(result.photos).toEqual({})
  })

  it('parses legacy plain-array format', () => {
    const json = JSON.stringify([MILESTONE])
    const result = parseBackup(json)
    expect(result.milestones).toHaveLength(1)
    expect(result.chapters).toHaveLength(0)
    expect(result.photos).toEqual({})
  })

  it('throws on pre-rename eras format', () => {
    const json = JSON.stringify({ milestones: [MILESTONE], eras: [] })
    expect(() => parseBackup(json)).toThrow('Chapters rename')
  })

  it('throws on invalid JSON', () => {
    expect(() => parseBackup('not json')).toThrow()
  })
})

describe('importBackup', () => {
  it('calls restoreMilestones and restoreChapters', async () => {
    restoreMilestones.mockResolvedValue([MILESTONE])
    restoreChapters.mockResolvedValue([CHAPTER])

    await importBackup({ milestones: [MILESTONE], photos: {}, chapters: [CHAPTER] })

    expect(restoreMilestones).toHaveBeenCalledWith([MILESTONE])
    expect(restoreChapters).toHaveBeenCalledWith([CHAPTER])
  })

  it('returns { milestones, chapters }', async () => {
    restoreMilestones.mockResolvedValue([MILESTONE])
    restoreChapters.mockResolvedValue([CHAPTER])

    const result = await importBackup({ milestones: [MILESTONE], photos: {}, chapters: [CHAPTER] })

    expect(result.milestones).toEqual([MILESTONE])
    expect(result.chapters).toEqual([CHAPTER])
  })

  it('does not call dbPutPhoto when no photos', async () => {
    restoreMilestones.mockResolvedValue([MILESTONE])
    restoreChapters.mockResolvedValue([])

    await importBackup({ milestones: [MILESTONE], photos: {}, chapters: [] })

    expect(dbPutPhoto).not.toHaveBeenCalled()
  })

  it('uploads photo and calls dbPut when photo is present', async () => {
    const photoMilestone = { ...MILESTONE }
    restoreMilestones.mockResolvedValue([photoMilestone])
    restoreChapters.mockResolvedValue([])
    dbPutPhoto.mockResolvedValue(undefined)
    dbPut.mockResolvedValue(undefined)

    const dataUri = 'data:image/jpeg;base64,/9j/fake'
    await importBackup({ milestones: [photoMilestone], photos: { abc123: dataUri }, chapters: [] })

    expect(dbPutPhoto).toHaveBeenCalledWith('abc123', expect.any(Blob), 'image/jpeg')
    expect(dbPut).toHaveBeenCalled()
  })

  it('skips malformed data-URI without throwing', async () => {
    restoreMilestones.mockResolvedValue([MILESTONE])
    restoreChapters.mockResolvedValue([])

    await expect(
      importBackup({ milestones: [MILESTONE], photos: { abc123: 'not-a-data-uri' }, chapters: [] })
    ).resolves.not.toThrow()
    expect(dbPutPhoto).not.toHaveBeenCalled()
  })
})
