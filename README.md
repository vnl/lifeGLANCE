# lifeGLANCE

**Your life, at a glance.** A zoomable personal timeline for milestones — past and future.

Built for people who want to map their life without handing their data to a cloud service. lifeGLANCE is a privacy-first progressive web app backed by a self-hosted [PocketBase](https://pocketbase.io) database. Your data stays on your own machine — no accounts, no third-party cloud, no tracking.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.5.0-brightgreen.svg)](../../releases)

---

> **Based on the original lifeGLANCE by [@krelltunez](https://github.com/krelltunez/lifeGLANCE).**
> All credit for the concept, design, and core application goes to him — this fork adds self-hosting infrastructure (PocketBase backend, Docker images, multi-platform support) on top of his excellent work.

---

![lifeGLANCE timeline](docs/screenshot.png)

---

## Self-hosting with Docker

lifeGLANCE ships as two Docker images published to GitHub Container Registry (GHCR):

| Image | Purpose |
|---|---|
| `ghcr.io/vnl/lifeglance:latest` | The React frontend served via nginx |
| `ghcr.io/vnl/lifeglance-pb:latest` | PocketBase backend (database + API) |

**Supported platforms:** `linux/amd64` · `linux/arm64` · `linux/arm/v7`

Works on: Mac (Apple Silicon & Intel), Windows, Raspberry Pi, Synology NAS, and any other Docker-capable host.

### Quick start

Create a `docker-compose.yml` anywhere on your machine:

```yaml
services:
  pocketbase:
    image: ghcr.io/vnl/lifeglance-pb:latest
    restart: unless-stopped
    volumes:
      # pb_data holds your entire database (milestones, chapters, media).
      # To use a folder on your host instead of a Docker volume, replace with:
      #   - /path/to/your/folder:/pb/pb_data
      - pb_data:/pb/pb_data
    healthcheck:
      test: ["CMD", "wget", "-qO", "/dev/null", "http://localhost:8090/api/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  lifeglance:
    image: ghcr.io/vnl/lifeglance:latest
    restart: unless-stopped
    ports:
      # Change the left-hand port to serve on a different host port, e.g. "8080:80"
      - "6868:80"
    depends_on:
      pocketbase:
        condition: service_healthy

volumes:
  pb_data:
```

Then run:

```bash
docker compose up -d
```

Open `http://localhost:6868` (or whichever port you chose). PocketBase is provisioned automatically on first run — no manual setup needed.

### Persistent data

Your timeline data lives in the `pb_data` volume. To back it up, stop the stack and copy the volume contents, or use *Settings → save backup* inside the app to export a portable JSON file.

To update to the latest version:

```bash
docker compose pull
docker compose up -d
```

---

## Restoring from a backup

On first launch with an empty database, lifeGLANCE shows a restore screen. If you have a JSON backup from a previous installation:

1. Click **restore from backup** and select your `.json` file.
2. The app previews what was found (milestone and chapter counts) before importing.
3. Click **import everything** to restore. Photos are re-linked automatically if they were included in the backup.

If you are starting fresh, click **start fresh** to go straight to onboarding.

> Audio and video attachments are not included in JSON backups — re-attach them manually after restoring if needed.

---

## Features

**Timeline**
- Smooth pan and zoom from individual weeks to multiple decades
- Past and future milestones on a single continuous axis
- Keyboard navigation between milestones and zoom levels
- Cluster badges for dense date ranges
- "Today" marker with date, day of week, and optional age display

**Milestones**
- Title, date (day / month / year precision), category, note, and URL
- Photo, audio, and video attachments
- Annual recurrence with configurable end year
- Inline delete confirmation, undo / redo history

**Views & search**
- All / Past / Future view modes
- Full-text search across titles and notes
- Stats panel and summary modal
- "On this day" — milestones from this date in past years
- Minimap scrubbar for fast navigation

**Import / export**
- Import events from `.ics` calendar files
- Export timeline as a high-resolution PNG (2×, with branding watermark)
- JSON backup and restore

**App**
- Installable PWA — works fully offline after first load
- Ambient generative audio with mute toggle
- Adjustable text size
- Portrait-mode warning for mobile

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `←` / `→` | Cycle past / future milestones |
| `↑` / `↓` | Zoom out / in |
| `1` – `9` | Custom zoom to N years |
| `C` | Custom zoom input |
| `T` | Jump to today |
| `P` / `A` / `F` | Past / All / Future view |
| `N` | New milestone |
| `E` | Export image |
| `/` | Search |
| `S` | Settings |
| `M` | Mute / unmute |
| `⌘Z` / `Ctrl+Z` | Undo |
| `⌘⇧Z` / `Ctrl+Y` | Redo |
| `?` | Help |
| `Esc` | Close modal |

---

## Storage

Data is stored in PocketBase, which runs as a companion container alongside the app. The PocketBase data directory (`pb_data`) is mounted as a Docker volume so it persists across container restarts and updates.

| Store | Contents |
|---|---|
| PocketBase `milestones` collection | Milestone records (text fields, photo, media attachments) |
| PocketBase `chapters` collection | Chapter records with milestone membership |
| `localStorage` | Settings and preferences only (a few KB, browser-local) |

**Backup:** use *Settings → save backup* to export a JSON file of your milestone records. Audio and video attachments are not included — re-attach them after restoring if needed.

---

## Running locally (development)

Requires Node 20+.

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`. You will also need a running PocketBase instance — use `docker compose up pocketbase` to start just the database.

---

## Building

```bash
npm run build   # outputs to /dist
npm run preview # serve the production build locally
```

---

## Tech

| | |
|---|---|
| Framework | React 18 + Vite |
| PWA | vite-plugin-pwa (Workbox) |
| Backend | PocketBase 0.22 |
| Storage | PocketBase (milestones + media), localStorage (settings) |
| Dates | date-fns |
| Font | Courier Prime (Google Fonts, cached offline) |
| Audio | Web Audio API — synthesised, no samples |
| Deployment | Docker + nginx + PocketBase |

---

## Privacy

lifeGLANCE has no third-party analytics, no accounts, and no external network requests beyond loading the app and fetching the Courier Prime font (cached after first load). All timeline data is stored in your own PocketBase instance on your own infrastructure.

---

## Credits

lifeGLANCE was created by [@krelltunez](https://github.com/krelltunez). The original project lives at [github.com/krelltunez/lifeGLANCE](https://github.com/krelltunez/lifeGLANCE) — all credit for the concept, design, and application goes to him. This fork adds Docker-based self-hosting with PocketBase persistence and multi-platform image publishing.
