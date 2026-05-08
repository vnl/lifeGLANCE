import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock pb.js before importing db.js
vi.mock('../data/pb.js', () => ({
  default: {
    collection: vi.fn(),
    files: { getUrl: vi.fn() },
  },
}))

import pb from '../data/pb.js'
import { initDB, dbGetAll, dbAdd, dbPut, dbDelete } from '../data/db.js'

function makeMockCollection(overrides = {}) {
  return {
    getFullList: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getOne: vi.fn(),
    ...overrides,
  }
}

describe('initDB', () => {
  it('resolves without throwing when PocketBase is reachable', async () => {
    const col = makeMockCollection({ getFullList: vi.fn().mockResolvedValue([]) })
    pb.collection.mockReturnValue(col)
    await expect(initDB()).resolves.toBeUndefined()
  })

  it('throws when PocketBase is unreachable', async () => {
    const col = makeMockCollection({ getFullList: vi.fn().mockRejectedValue(new Error('fetch failed')) })
    pb.collection.mockReturnValue(col)
    await expect(initDB()).rejects.toThrow()
  })
})

describe('dbGetAll', () => {
  it('returns array of clean milestone records', async () => {
    const raw = [
      { id: 'abc', title: 'Test', collectionId: 'x', collectionName: 'milestones', expand: {} },
    ]
    const col = makeMockCollection({ getFullList: vi.fn().mockResolvedValue(raw) })
    pb.collection.mockReturnValue(col)
    const result = await dbGetAll()
    expect(result).toEqual([{ id: 'abc', title: 'Test' }])
  })
})

describe('dbAdd', () => {
  it('creates a record and returns cleaned result', async () => {
    const input = { id: 'abc', title: 'New', date: '2024-01-01', date_precision: 'day' }
    const returned = { ...input, collectionId: 'x', collectionName: 'milestones' }
    const col = makeMockCollection({ create: vi.fn().mockResolvedValue(returned) })
    pb.collection.mockReturnValue(col)
    const result = await dbAdd(input)
    expect(result).toEqual(input)
    expect(col.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc', title: 'New' }))
  })
})

describe('dbPut', () => {
  it('updates existing record (upsert - update path)', async () => {
    const input = { id: 'abc', title: 'Updated' }
    const returned = { ...input, collectionId: 'x', collectionName: 'milestones' }
    const col = makeMockCollection({ update: vi.fn().mockResolvedValue(returned) })
    pb.collection.mockReturnValue(col)
    const result = await dbPut(input)
    expect(result).toEqual(input)
    expect(col.update).toHaveBeenCalledWith('abc', expect.objectContaining({ title: 'Updated' }))
  })

  it('creates record when update returns 404 (upsert - create path)', async () => {
    const input = { id: 'abc', title: 'New' }
    const returned = { ...input, collectionId: 'x', collectionName: 'milestones' }
    const notFound = Object.assign(new Error('not found'), { status: 404 })
    const col = makeMockCollection({
      update: vi.fn().mockRejectedValue(notFound),
      create: vi.fn().mockResolvedValue(returned),
    })
    pb.collection.mockReturnValue(col)
    const result = await dbPut(input)
    expect(result).toEqual(input)
    expect(col.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc' }))
  })

  it('rethrows non-404 errors', async () => {
    const col = makeMockCollection({ update: vi.fn().mockRejectedValue(new Error('server error')) })
    pb.collection.mockReturnValue(col)
    await expect(dbPut({ id: 'abc' })).rejects.toThrow('server error')
  })
})

describe('dbDelete', () => {
  it('calls delete with the milestone id', async () => {
    const col = makeMockCollection({ delete: vi.fn().mockResolvedValue(undefined) })
    pb.collection.mockReturnValue(col)
    await dbDelete('abc')
    expect(col.delete).toHaveBeenCalledWith('abc')
  })
})
