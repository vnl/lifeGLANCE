import { restoreMilestones } from '../data/milestones'
import { restoreChapters } from '../data/chapters'
import { dbPutPhoto, dbPut } from '../data/db'

export function parseBackup(jsonText) {
  const parsed = JSON.parse(jsonText)

  if (!Array.isArray(parsed) && 'eras' in parsed && !Array.isArray(parsed.chapters)) {
    throw new Error('This backup was created before the Chapters rename and cannot be imported. Please regenerate the backup from the app.')
  }

  const milestones = Array.isArray(parsed) ? parsed : (parsed.milestones ?? [])
  const photos     = (!Array.isArray(parsed) && parsed.photos) ? parsed.photos : {}
  const chapters   = (!Array.isArray(parsed) && Array.isArray(parsed.chapters)) ? parsed.chapters : []

  return { milestones, photos, chapters }
}

export async function importBackup({ milestones, photos, chapters }) {
  const restored = await restoreMilestones(milestones)
  const restoredChapters = await restoreChapters(chapters)

  const milestonesWithPhotos = new Set()
  for (const m of restored) {
    const dataUri = photos[m.id]
    if (!dataUri) continue
    try {
      const [header, b64] = dataUri.split(',')
      const mimeType = header.match(/:(.*?);/)[1]
      const raw = atob(b64)
      const arr = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
      const blob = new Blob([arr], { type: mimeType })
      await dbPutPhoto(m.id, blob, mimeType)
      milestonesWithPhotos.add(m.id)
    } catch { /* malformed data-URI — skip */ }
  }

  for (const m of restored) {
    if (milestonesWithPhotos.has(m.id)) {
      await dbPut({ ...m, has_photo: true })
    }
  }

  return { milestones: restored, chapters: restoredChapters }
}
