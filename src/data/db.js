import pb from './pb.js'

function clean(record) {
  if (!record) return record
  const { collectionId, collectionName, expand, ...rest } = record
  return rest
}

// --- Init / health check ---

export async function initDB() {
  await pb.collection('milestones').getFullList({ perPage: 1 })
}

// --- Milestone CRUD ---

export async function dbGetAll() {
  const records = await pb.collection('milestones').getFullList({ sort: 'date' })
  return records.map(clean)
}

export async function dbAdd(item) {
  const { photo, media_file, ...fields } = item
  const record = await pb.collection('milestones').create({ id: item.id, ...fields })
  return clean(record)
}

export async function dbPut(item) {
  const { photo, media_file, ...fields } = item
  try {
    return clean(await pb.collection('milestones').update(item.id, fields))
  } catch (e) {
    if (e.status === 404) {
      return clean(await pb.collection('milestones').create({ id: item.id, ...fields }))
    }
    throw e
  }
}

export async function dbDelete(id) {
  await pb.collection('milestones').delete(id)
}

// --- Chapter CRUD ---

function cleanChapter(record) {
  const cleaned = clean(record)
  if (typeof cleaned.milestoneIds === 'string') {
    try { cleaned.milestoneIds = JSON.parse(cleaned.milestoneIds) } catch { cleaned.milestoneIds = [] }
  }
  if (!Array.isArray(cleaned.milestoneIds)) cleaned.milestoneIds = []
  return cleaned
}

export async function dbGetAllChapters() {
  const records = await pb.collection('chapters').getFullList({ sort: 'start' })
  return records.map(cleanChapter)
}

export async function dbGetChapter(id) {
  const record = await pb.collection('chapters').getOne(id)
  return cleanChapter(record)
}

export async function dbAddChapter(item) {
  const fields = { ...item, milestoneIds: JSON.stringify(item.milestoneIds ?? []) }
  const record = await pb.collection('chapters').create({ id: item.id, ...fields })
  return cleanChapter(record)
}

export async function dbPutChapter(item) {
  const fields = { ...item, milestoneIds: JSON.stringify(item.milestoneIds ?? []) }
  try {
    return cleanChapter(await pb.collection('chapters').update(item.id, fields))
  } catch (e) {
    if (e.status === 404) {
      return cleanChapter(await pb.collection('chapters').create({ id: item.id, ...fields }))
    }
    throw e
  }
}

export async function dbDeleteChapter(id) {
  await pb.collection('chapters').delete(id)
}

// --- Media (implemented in Task 6) ---

export async function dbPutMedia() { throw new Error('not yet implemented') }
export async function dbGetMedia() { throw new Error('not yet implemented') }
export async function dbClearAllMedia() { /* no-op: deleting milestone record removes its files */ }
export async function dbPutPhoto() { throw new Error('not yet implemented') }
export async function dbGetPhoto() { throw new Error('not yet implemented') }
export async function dbDeletePhoto() { throw new Error('not yet implemented') }
