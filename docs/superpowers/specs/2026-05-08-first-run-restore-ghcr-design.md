# First-run restore screen + GHCR publishing

**Date:** 2026-05-08
**Branch:** feature/pocketbase-migration → merge to main first, then this work on a new branch

---

## Goal

Ship lifeGLANCE as a self-hosted Docker image on GHCR. When users run it for the first time, the app offers a zero-friction path to import an existing lifeGLANCE backup — or start fresh with the existing guided onboarding. End users never touch the PocketBase admin panel.

---

## Scope

1. `RestoreOrFresh` — new first-run screen in the React app
2. `importBackup.js` — shared backup import utility (extracted from TimelineView)
3. GitHub Actions CI — builds and pushes two images to GHCR on push to `main` / version tags
4. `docker-compose.yml` — updated to reference GHCR images; stays dev-compatible

---

## 1. First-run screen (`RestoreOrFresh`)

### Trigger

`App.jsx` already detects an empty DB (`milestones.length === 0`). Currently this shows `Onboarding`. After this change it shows `RestoreOrFresh` instead. `RestoreOrFresh` hands off to `Onboarding` if the user picks "start fresh".

### Component: `src/components/onboarding/RestoreOrFresh.jsx`

Three internal states:

| State | What the user sees |
|---|---|
| `idle` | Two buttons: "restore from backup" + "start fresh" |
| `preview` | "Found X milestones, Y chapters — import everything?" + confirm / cancel |
| `importing` | Spinner while writing to PocketBase |

Props:
- `onRestoreComplete({ milestones })` — called after successful import; App sets screen to `timeline` (chapters are in PocketBase; TimelineView fetches them on mount)
- `onStartFresh()` — called when user clicks "start fresh"; App sets screen to `onboarding`

### App.jsx changes

- Add `'restore-or-fresh'` to the screen state union
- When DB empty: `setScreen('restore-or-fresh')` instead of `'onboarding'`
- Handle `onRestoreComplete`: `setMilestones(milestones)`, `setScreen('timeline')` (no chapters needed — TimelineView loads them from PocketBase)
- Handle `onStartFresh`: `setScreen('onboarding')`
- Existing `Onboarding` component and `TimelineView` are untouched

---

## 2. Backup import utility (`importBackup.js`)

### Location

`src/utils/importBackup.js`

### API

```js
// Parse and validate — returns preview counts, throws on invalid file
export function parseBackup(jsonText) // → { milestones, photos, chapters }

// Import into PocketBase — returns { milestones, chapters }
export async function importBackup({ milestones, photos, chapters })
```

### Logic (extracted verbatim from `TimelineView.jsx:997–1048`)

1. Parse JSON, detect format (plain array / `{ milestones, photos, chapters }`)
2. Reject pre-rename `eras` format with clear error message
3. `parseBackup` returns counts — used by `RestoreOrFresh` for the preview step
4. `importBackup` calls:
   - `restoreMilestones(items)` — existing fn, unchanged
   - `restoreChapters(chapters)` — existing fn, unchanged
   - `dbPutPhoto(id, blob, mimeType)` for each milestone with `has_photo`
   - `dbPut(m)` to persist `has_photo = true` updates
5. Returns `{ milestones, chapters }` to caller

### Consumers

- `RestoreOrFresh` (new — first-run import)
- `TimelineView.handleRestoreFile` (existing — refactored to call `importBackup`)

No behaviour change in the Settings restore flow — same logic, now shared.

---

## 3. GHCR publishing (GitHub Actions)

### Workflow: `.github/workflows/publish.yml`

**Triggers:**
- Push to `main`
- Tags matching `v*` (e.g. `v1.0.0`)

**Images built:**

| Image | Dockerfile | Description |
|---|---|---|
| `ghcr.io/vnl/lifeglance:latest` | `./Dockerfile` | nginx + Vite-built React app |
| `ghcr.io/vnl/lifeglance-pb:latest` | `./pocketbase/Dockerfile` | Official PocketBase + entrypoint.sh |

**Auth:** `GITHUB_TOKEN` (automatic — no secrets to configure).

**Tags:**
- `:latest` on every `main` push
- `:v1.2.3` on tagged releases (using `docker/metadata-action`)

**Cache:** `cache-from: type=gha` / `cache-to: type=gha,mode=max` for fast rebuilds.

---

## 4. `docker-compose.yml` for users

Two modes in one file via environment variable:

```yaml
services:
  lifeglance:
    image: ${LIFEGLANCE_IMAGE:-ghcr.io/vnl/lifeglance:latest}
    build: .   # ignored when image is pulled; used in dev with --build
  pocketbase:
    image: ${LIFEGLANCE_PB_IMAGE:-ghcr.io/vnl/lifeglance-pb:latest}
    build: ./pocketbase
```

- **Users** (no env vars set): pulls from GHCR automatically
- **Dev** (`docker compose up --build`): builds locally as today

Users get the app running with:

```bash
curl -O https://raw.githubusercontent.com/vnl/lifeGLANCE/main/docker-compose.yml
docker compose up -d
# open http://localhost:6868
```

---

## 5. Error handling

| Error | User-facing message |
|---|---|
| File is not valid JSON | "That doesn't look like a lifeGLANCE backup." |
| Pre-rename `eras` format | "This backup was created before the Chapters rename and cannot be imported. Please regenerate the backup from the app." (existing message) |
| PocketBase write fails | "Import failed — please try again." |
| File has 0 milestones | Preview shows "0 milestones" — user can still confirm or cancel |

---

## 6. What is NOT in scope

- User-facing PocketBase admin credentials (auto-provisioned, hidden)
- Merge-on-restore (replace-all only, same as existing restore behaviour)
- Multiple user accounts / auth in the app
- Mobile / portrait layout changes to the new screen
