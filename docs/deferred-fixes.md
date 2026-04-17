# Deferred fixes

## #5 — Test coverage

### Setup
Add [Vitest](https://vitest.dev/) (zero config with Vite):

```
npm install -D vitest
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

### What to test

| Module | Tests |
|--------|-------|
| `src/utils/icsParser.js` | All-day event parsing, timed event skipping, empty/malformed input, multi-event files |
| `src/utils/dates.js` (`buildDateFromParts`) | All three precision modes (day/month/year), edge cases (Feb 29, Dec 31) |
| `src/utils/timeline.js` (`applyRecurFilter`) | `all`, `past`, `future`, `next` modes against a known fixture set |
| Recurrence generation | Extract the year-expansion loop from `handleSave` into `src/utils/recurrence.js`, then test base year, end year clamping (+99), and instance count |
| `src/data/milestones.js` | `addMilestone`, `updateMilestone`, `deleteMilestone` against a real in-memory IndexedDB via [`fake-indexeddb`](https://github.com/dumbmatter/fakeIndexedDB) |

### Recommended order
1. `icsParser` — pure function, highest return on investment
2. `dates` — small, critical, easy to break
3. Recurrence — requires extracting the loop from `TimelineView.jsx` first (good cleanup anyway)
4. `milestones` DB layer — needs `fake-indexeddb`, more setup but covers the riskiest path

---

## #6 — Photo storage: data-URI → IndexedDB blob

### Problem
Photos are stored as base64 data-URI strings directly in the `milestones` object store, so every `dbGetAll()` call deserialises the full image payload for every milestone that has a photo. Audio/video already use the dedicated `media` blob store — photos should too.

### Plan

#### 1. Reuse the media store with a namespaced key
Audio/video keys are the milestone `id`. Photos get the key `${id}-photo`. No new object store needed.

New helpers in `src/data/db.js`:
```js
export function dbPutPhoto(id, blob, mimeType) { /* put { id: `${id}-photo`, blob, mimeType } */ }
export function dbGetPhoto(id)                  { /* get `${id}-photo` */ }
export function dbDeletePhoto(id)               { /* delete `${id}-photo` */ }
```

#### 2. DB version bump to 3
In `onupgradeneeded` for `oldVersion < 3`, open a cursor on the `milestones` store and for each record with a non-empty `photo_uri`:
- Convert the data-URI to a `Blob` (atob → Uint8Array)
- Put it into the `media` store as `${id}-photo`
- Delete `photo_uri` from the milestone record

This follows the same pattern as the v1→v2 audio migration (see `db.js` lines 27–37).

#### 3. Write path — `AddMilestoneSheet`
Replace the `FileReader` / `readAsDataURL` flow with a `photoFile` state (same pattern as `mediaFile`). Call `dbPutPhoto` in `handleSave` after the milestone is written.

#### 4. Read path — `MilestoneDetail`
On mount, call `dbGetPhoto(milestone.id)` → `URL.createObjectURL(blob)` and store in local state. Revoke on unmount. Identical to how audio playback already works.

#### 5. Backup / restore
After migration, `photo_uri` won't be in the milestone JSON. Add a `photos` key to the backup format containing `{ [id]: dataUri }`, round-tripping blobs through base64 only at export/import time. Document as a breaking change for anyone parsing backup files manually.

### Risks
- Migration is a single IndexedDB transaction — if interrupted it rolls back cleanly
- `URL.createObjectURL` leaks if not revoked on unmount — easy to miss in components that remount frequently
- Backup format change is a breaking change for manual backup parsers

### Effort
~4–6 hours. Do not rush before a release — it touches existing user data.
