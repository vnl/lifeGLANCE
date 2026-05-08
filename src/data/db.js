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

// --- Chapter CRUD (implemented in Task 5) ---

export async function dbGetAllChapters() { throw new Error('not yet implemented') }
export async function dbGetChapter() { throw new Error('not yet implemented') }
export async function dbAddChapter() { throw new Error('not yet implemented') }
export async function dbPutChapter() { throw new Error('not yet implemented') }
export async function dbDeleteChapter() { throw new Error('not yet implemented') }

// --- Media (implemented in Task 6) ---

export async function dbPutMedia() { throw new Error('not yet implemented') }
export async function dbGetMedia() { throw new Error('not yet implemented') }
export async function dbClearAllMedia() { /* no-op: deleting milestone record removes its files */ }
export async function dbPutPhoto() { throw new Error('not yet implemented') }
export async function dbGetPhoto() { throw new Error('not yet implemented') }
export async function dbDeletePhoto() { throw new Error('not yet implemented') }
