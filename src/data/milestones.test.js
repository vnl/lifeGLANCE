import { describe, it, expect, beforeEach, vi } from 'vitest'

// In-memory store shared across mock functions.
// Use an object property so closures always see the current value
// even after hoisting resolves the vi.mock factory.
const _state = { store: [] }

vi.mock('./db', () => ({
  dbGetAll: vi.fn(() => Promise.resolve([..._state.store])),
  dbAdd: vi.fn((item) => { _state.store.push(item); return Promise.resolve(item) }),
  dbPut: vi.fn((item) => {
    const idx = _state.store.findIndex(m => m.id === item.id)
    if (idx >= 0) _state.store[idx] = item; else _state.store.push(item)
    return Promise.resolve(item)
  }),
  dbDelete: vi.fn((id) => {
    _state.store = _state.store.filter(m => m.id !== id)
    return Promise.resolve()
  }),
  dbClearAllMedia: vi.fn(() => Promise.resolve()),
}))

import { addMilestone, updateMilestone, deleteMilestone, loadMilestones, restoreMilestones } from './milestones'

beforeEach(() => {
  _state.store = []
  vi.clearAllMocks()
})

describe('addMilestone', () => {
  it('stores a milestone and returns it with an id', async () => {
    const m = await addMilestone({ title: 'First Home', date: new Date('2015-06-01') })
    expect(m.id).toBeTruthy()
    expect(m.title).toBe('First Home')
    const all = await loadMilestones()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(m.id)
  })

  it('sets direction to past for past dates', async () => {
    const m = await addMilestone({ title: 'Past', date: new Date('2000-01-01') })
    expect(m.direction).toBe('past')
  })

  it('sets direction to future for future dates', async () => {
    const m = await addMilestone({ title: 'Future', date: new Date('2099-01-01') })
    expect(m.direction).toBe('future')
  })

  it('stores multiple milestones independently', async () => {
    await addMilestone({ title: 'A', date: new Date('2010-01-01') })
    await addMilestone({ title: 'B', date: new Date('2011-01-01') })
    await addMilestone({ title: 'C', date: new Date('2012-01-01') })
    const all = await loadMilestones()
    expect(all).toHaveLength(3)
  })

  it('does not include photo_uri in stored record', async () => {
    await addMilestone({ title: 'Photo test', date: new Date('2020-01-01'), has_photo: true })
    const all = await loadMilestones()
    expect('photo_uri' in all[0]).toBe(false)
  })
})

describe('updateMilestone', () => {
  it('updates an existing milestone', async () => {
    const m = await addMilestone({ title: 'Original', date: new Date('2015-01-01') })
    await updateMilestone(m.id, { title: 'Updated', date: new Date('2015-01-01') }, m)
    const all = await loadMilestones()
    expect(all[0].title).toBe('Updated')
  })

  it('recalculates direction on date change', async () => {
    const m = await addMilestone({ title: 'Test', date: new Date('2000-01-01') })
    expect(m.direction).toBe('past')
    await updateMilestone(m.id, { title: 'Test', date: new Date('2099-01-01') }, m)
    const all = await loadMilestones()
    expect(all[0].direction).toBe('future')
  })

  it('strips any photo_uri field passed in updates', async () => {
    const m = await addMilestone({ title: 'Test', date: new Date('2020-01-01') })
    await updateMilestone(m.id, { title: 'Test', date: new Date('2020-01-01'), photo_uri: 'data:...' }, m)
    const all = await loadMilestones()
    expect('photo_uri' in all[0]).toBe(false)
  })
})

describe('deleteMilestone', () => {
  it('removes the milestone from the store', async () => {
    const m = await addMilestone({ title: 'To Delete', date: new Date('2020-01-01') })
    await deleteMilestone(m.id)
    const all = await loadMilestones()
    expect(all).toHaveLength(0)
  })

  it('does not affect other milestones', async () => {
    const a = await addMilestone({ title: 'Keep', date: new Date('2020-01-01') })
    const b = await addMilestone({ title: 'Delete', date: new Date('2021-01-01') })
    await deleteMilestone(b.id)
    const all = await loadMilestones()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(a.id)
  })
})

describe('restoreMilestones', () => {
  it('replaces all existing milestones', async () => {
    await addMilestone({ title: 'Old', date: new Date('2010-01-01') })
    const imported = [
      { id: 'x1', title: 'New A', date: '2020-01-01T00:00:00.000Z', date_precision: 'day',
        category: 'personal', color: '#888', direction: 'past', note: '', has_photo: false,
        media_type: null, url: '', recurrence: null, recurrence_id: null,
        created_at: '2020-01-01T00:00:00.000Z', updated_at: '2020-01-01T00:00:00.000Z' },
    ]
    const restored = await restoreMilestones(imported)
    expect(restored).toHaveLength(1)
    const all = await loadMilestones()
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('New A')
  })

  it('strips photo_uri and resets has_photo from restored items', async () => {
    const items = [
      { id: 'y1', title: 'Photo Mile', date: '2020-01-01T00:00:00.000Z', date_precision: 'day',
        category: 'personal', color: '#888', direction: 'past', note: '',
        photo_uri: 'data:image/png;base64,abc', has_photo: true, media_type: null,
        url: '', recurrence: null, recurrence_id: null,
        created_at: '2020-01-01T00:00:00.000Z', updated_at: '2020-01-01T00:00:00.000Z' },
    ]
    await restoreMilestones(items)
    const all = await loadMilestones()
    expect('photo_uri' in all[0]).toBe(false)
    expect(all[0].has_photo).toBe(false)
  })
})
