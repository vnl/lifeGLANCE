# First-run Restore Screen + GHCR Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-run backup import screen to lifeGLANCE and publish Docker images to GHCR via GitHub Actions so users can self-host with a single `docker compose up`.

**Architecture:** New `RestoreOrFresh` component sits in front of the existing `Onboarding` flow when the DB is empty. A shared `importBackup` utility extracted from `TimelineView` handles JSON parsing and PocketBase writes. CI builds two images (`lifeglance` + `lifeglance-pb`) on every push to `main` and on version tags.

**Tech Stack:** React 18, Vitest, Docker, GitHub Actions, GHCR (`ghcr.io`)

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `src/utils/importBackup.js` | Parse + import backup JSON into PocketBase |
| Create | `src/__tests__/importBackup.test.js` | Unit tests for importBackup utility |
| Create | `src/components/onboarding/RestoreOrFresh.jsx` | First-run screen (idle → preview → importing) |
| Create | `.github/workflows/publish.yml` | CI: build + push both images to GHCR |
| Modify | `src/App.jsx` | Add `restore-or-fresh` screen state |
| Modify | `src/components/timeline/TimelineView.jsx` | Refactor `handleRestoreFile` to use `importBackup` |
| Modify | `docker-compose.yml` | Add GHCR image refs with local-build fallback |

---

## Task 1: Extract `importBackup` utility (TDD)

**Files:**
- Create: `src/utils/importBackup.js`
- Create: `src/__tests__/importBackup.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/importBackup.test.js`:

```js
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
    restoreChapters.mockResolvedValue(undefined)

    await importBackup({ milestones: [MILESTONE], photos: {}, chapters: [CHAPTER] })

    expect(restoreMilestones).toHaveBeenCalledWith([MILESTONE])
    expect(restoreChapters).toHaveBeenCalledWith([CHAPTER])
  })

  it('returns { milestones, chapters }', async () => {
    restoreMilestones.mockResolvedValue([MILESTONE])
    restoreChapters.mockResolvedValue(undefined)

    const result = await importBackup({ milestones: [MILESTONE], photos: {}, chapters: [CHAPTER] })

    expect(result.milestones).toEqual([MILESTONE])
    expect(result.chapters).toEqual([CHAPTER])
  })

  it('does not call dbPutPhoto when no photos', async () => {
    restoreMilestones.mockResolvedValue([MILESTONE])
    restoreChapters.mockResolvedValue(undefined)

    await importBackup({ milestones: [MILESTONE], photos: {}, chapters: [] })

    expect(dbPutPhoto).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

```bash
npm test -- src/__tests__/importBackup.test.js
```

Expected: `FAIL` — `importBackup` not found.

- [ ] **Step 3: Implement `importBackup.js`**

Create `src/utils/importBackup.js`:

```js
import { restoreMilestones } from '../data/milestones'
import { restoreChapters } from '../data/chapters'
import { dbPutPhoto, dbPut } from '../data/db'

export function parseBackup(jsonText) {
  const parsed = JSON.parse(jsonText)

  if (!Array.isArray(parsed) && Array.isArray(parsed.eras) && !Array.isArray(parsed.chapters)) {
    throw new Error('This backup was created before the Chapters rename and cannot be imported. Please regenerate the backup from the app.')
  }

  const milestones = Array.isArray(parsed) ? parsed : (parsed.milestones ?? [])
  const photos     = (!Array.isArray(parsed) && parsed.photos) ? parsed.photos : {}
  const chapters   = (!Array.isArray(parsed) && Array.isArray(parsed.chapters)) ? parsed.chapters : []

  return { milestones, photos, chapters }
}

export async function importBackup({ milestones, photos, chapters }) {
  const restored = await restoreMilestones(milestones)
  await restoreChapters(chapters)

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
      m.has_photo = true
    } catch { /* malformed data-URI — skip */ }
  }

  for (const m of restored) {
    if (m.has_photo) await dbPut(m)
  }

  return { milestones: restored, chapters }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- src/__tests__/importBackup.test.js
```

Expected: all tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/importBackup.js src/__tests__/importBackup.test.js
git commit -m "feat: extract importBackup utility from TimelineView"
```

---

## Task 2: Refactor `TimelineView.handleRestoreFile` to use `importBackup`

**Files:**
- Modify: `src/components/timeline/TimelineView.jsx` (around line 997)

- [ ] **Step 1: Add imports at the top of TimelineView.jsx**

Find the existing imports block (around line 18):
```js
import { addMilestone, updateMilestone, deleteMilestone, restoreMilestones, uid } from '../../data/milestones'
import { listChapters, restoreChapters, createChapter, updateChapter, deleteChapter } from '../../data/chapters'
```

Add after them:
```js
import { parseBackup, importBackup } from '../../utils/importBackup'
```

- [ ] **Step 2: Replace `handleRestoreFile` body**

Find `handleRestoreFile` (line ~997). Replace the entire function body with:

```js
async function handleRestoreFile(e) {
  const file = e.target.files[0]
  if (!file) return
  try {
    const text   = await file.text()
    const parsed = parseBackup(text)
    const { milestones: restored, chapters: restoredChapters } = await importBackup(parsed)
    setMilestones([...restored])
    setChapters([...restoredChapters])
    historyRef.current = { stack: [[...restored]], idx: 0 }
    setCanUndo(false)
    setCanRedo(false)
  } catch (err) {
    console.error('Restore failed:', err)
    showToast(err.message || 'Restore failed. The backup file may be invalid.')
  }
  e.target.value = ''
}
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass (same count as before this task — no new tests, no regressions).

- [ ] **Step 4: Commit**

```bash
git add src/components/timeline/TimelineView.jsx
git commit -m "refactor: use importBackup utility in TimelineView handleRestoreFile"
```

---

## Task 3: Build `RestoreOrFresh` component and wire `App.jsx`

**Files:**
- Create: `src/components/onboarding/RestoreOrFresh.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `RestoreOrFresh.jsx`**

Create `src/components/onboarding/RestoreOrFresh.jsx`:

```jsx
import React, { useRef, useState } from 'react'
import { parseBackup, importBackup } from '../../utils/importBackup'

export default function RestoreOrFresh({ onRestoreComplete, onStartFresh }) {
  const [phase,   setPhase]   = useState('idle') // idle | preview | importing
  const [preview, setPreview] = useState(null)   // { milestones, photos, chapters }
  const [error,   setError]   = useState(null)
  const fileRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    try {
      const text   = await file.text()
      const parsed = parseBackup(text)
      setPreview(parsed)
      setPhase('preview')
      setError(null)
    } catch (err) {
      setError(err.message || "That doesn't look like a lifeGLANCE backup.")
    }
  }

  async function handleConfirm() {
    setPhase('importing')
    try {
      const result = await importBackup(preview)
      onRestoreComplete(result)
    } catch {
      setError('Import failed — please try again.')
      setPhase('idle')
      setPreview(null)
    }
  }

  function handleCancel() {
    setPhase('idle')
    setPreview(null)
    setError(null)
  }

  return (
    <div className="onboarding onboarding-welcome">
      <div style={{ textAlign: 'center', maxWidth: '400px', margin: '0 auto', padding: '2rem' }}>
        <div className="logo" style={{ marginBottom: '2rem' }}>
          <span className="logo-life">life</span>
          <span className="logo-glance">GLANCE</span>
        </div>

        {phase === 'idle' && (
          <>
            <p style={{ color: '#888', marginBottom: '2rem', fontSize: '0.9rem' }}>
              welcome. do you have a backup from a previous lifeGLANCE install?
            </p>
            {error && (
              <p style={{ color: '#e85d75', fontSize: '0.8rem', marginBottom: '1rem' }}>{error}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
              <button className="btn btn-filled" onClick={() => fileRef.current?.click()}>
                ↑ restore from backup
              </button>
              <button className="btn" onClick={onStartFresh}>
                start fresh →
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".json"
              style={{ display: 'none' }} onChange={handleFile} />
          </>
        )}

        {phase === 'preview' && preview && (
          <>
            <p style={{ color: '#888', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              found in backup:
            </p>
            <div style={{
              background: '#1a1a2e', border: '1px solid #333', borderRadius: '6px',
              padding: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#e8e8e8',
            }}>
              <div>{preview.milestones.length} milestone{preview.milestones.length !== 1 ? 's' : ''}</div>
              <div>{preview.chapters.length} chapter{preview.chapters.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
              <button className="btn btn-filled" onClick={handleConfirm}>
                import everything →
              </button>
              <button className="btn" onClick={handleCancel}>
                cancel
              </button>
            </div>
          </>
        )}

        {phase === 'importing' && (
          <div style={{ color: '#888', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <span className="cursor" style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
            importing...
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `App.jsx`**

Replace the entire `App.jsx` with:

```jsx
import React, { useState, useEffect } from 'react'
import Onboarding      from './components/onboarding/Onboarding'
import RestoreOrFresh  from './components/onboarding/RestoreOrFresh'
import TimelineView    from './components/timeline/TimelineView'
import { initDB, dbGetAll } from './data/db'
import { registerDevtools } from './data/devtools'

export default function App() {
  const [screen,       setScreen]       = useState('loading')  // loading | restore-or-fresh | onboarding | timeline | error
  const [milestones,   setMilestones]   = useState([])
  const [portraitWarn, setPortraitWarn] = useState(
    () => window.matchMedia('(orientation: portrait) and (max-width: 1024px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait) and (max-width: 1024px)')
    const handler = (e) => setPortraitWarn(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    initDB()
      .then(() => { registerDevtools(); navigator.storage?.persist?.(); return dbGetAll() })
      .then((all) => {
        setMilestones(all)
        setScreen(all.length === 0 ? 'restore-or-fresh' : 'timeline')
      })
      .catch((err) => {
        console.error('DB init failed:', err)
        setScreen('error')
      })
  }, [])

  function handleRestoreComplete({ milestones: imported }) {
    setMilestones(imported)
    setScreen('timeline')
  }

  function handleOnboardingComplete(initial) {
    setMilestones(initial)
    setScreen('timeline')
  }

  const content = screen === 'loading' ? (
    <div className="app-loading">
      <span className="cursor" style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
    </div>
  ) : screen === 'restore-or-fresh' ? (
    <RestoreOrFresh
      onRestoreComplete={handleRestoreComplete}
      onStartFresh={() => setScreen('onboarding')}
    />
  ) : screen === 'onboarding' ? (
    <Onboarding onComplete={handleOnboardingComplete} />
  ) : screen === 'error' ? (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: '1rem',
      fontFamily: 'Courier Prime, monospace', color: '#e8e8e8',
      background: '#0F1117', textAlign: 'center', padding: '2rem',
    }}>
      <div style={{ fontSize: '2rem' }}>⚠</div>
      <div style={{ fontSize: '1.2rem' }}>Cannot connect to database</div>
      <div style={{ fontSize: '0.9rem', color: '#888', maxWidth: '400px' }}>
        PocketBase is not reachable. Make sure the server is running and try refreshing.
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: '1rem', padding: '0.5rem 1.5rem',
          background: 'transparent', border: '1px solid #555',
          color: '#e8e8e8', fontFamily: 'inherit', cursor: 'pointer',
          fontSize: '0.9rem',
        }}
      >
        Retry
      </button>
    </div>
  ) : (
    <TimelineView milestones={milestones} setMilestones={setMilestones} />
  )

  return (
    <>
      {content}
      {portraitWarn && (
        <div className="portrait-overlay">
          <div className="logo">
            <span className="logo-life">life</span>
            <span className="logo-glance">GLANCE</span>
          </div>
          <div className="portrait-rotate-icon">↺</div>
          <div className="portrait-message">
            please rotate your device<br />
            for the best experience
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass. No regressions.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/RestoreOrFresh.jsx src/App.jsx
git commit -m "feat: add RestoreOrFresh first-run screen before onboarding"
```

---

## Task 4: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to GHCR

on:
  push:
    branches: [main]
    tags: ['v*']

env:
  APP_IMAGE: ghcr.io/vnl/lifeglance
  PB_IMAGE:  ghcr.io/vnl/lifeglance-pb

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: App image metadata
        id: app-meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.APP_IMAGE }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push app image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.app-meta.outputs.tags }}
          labels: ${{ steps.app-meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: PocketBase image metadata
        id: pb-meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.PB_IMAGE }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push PocketBase image
        uses: docker/build-push-action@v5
        with:
          context: ./pocketbase
          push: true
          tags: ${{ steps.pb-meta.outputs.tags }}
          labels: ${{ steps.pb-meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: publish lifeglance and lifeglance-pb images to GHCR on main push"
```

---

## Task 5: Update `docker-compose.yml` for GHCR

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add `image:` fields with GHCR defaults**

Replace `docker-compose.yml` contents with:

```yaml
services:
  pocketbase:
    image: ${LIFEGLANCE_PB_IMAGE:-ghcr.io/vnl/lifeglance-pb:latest}
    build: ./pocketbase
    restart: unless-stopped
    volumes:
      - pb_data:/pb/pb_data
    healthcheck:
      test: ["CMD", "wget", "-qO", "/dev/null", "http://localhost:8090/api/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  lifeglance:
    image: ${LIFEGLANCE_IMAGE:-ghcr.io/vnl/lifeglance:latest}
    build: .
    restart: unless-stopped
    ports:
      - "6868:80"
    depends_on:
      pocketbase:
        condition: service_healthy

volumes:
  pb_data:
```

> **Note for dev:** Always use `docker compose up --build` locally. Without `--build`, Compose will try to pull from GHCR instead of building locally.

- [ ] **Step 2: Verify local build still works**

```bash
docker compose up --build
```

Expected: both containers start, `[lifeGLANCE] Database ready.` in pocketbase logs, http://localhost:6868 loads.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add GHCR image refs to docker-compose with local-build fallback"
```

---

## What users do after images are published

```bash
# download compose file
curl -O https://raw.githubusercontent.com/vnl/lifeGLANCE/main/docker-compose.yml

# start
docker compose up -d

# open
open http://localhost:6868
```

First visit shows the `RestoreOrFresh` screen. Upload a backup or start fresh.
