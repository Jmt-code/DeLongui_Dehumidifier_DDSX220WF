# Deshumi Test — De'Longhi Dehumidifier Controller

## Project Overview

Personal IoT controller for a De'Longhi DDSX220WFA dehumidifier. Express backend that authenticates via the Gigya/Ayla Networks OIDC flow and proxies commands to the device API. React + Vite frontend. Electron wrapper (`electron-app/`) packages both into a Windows desktop app.

Three server versions exist: `server.js` (v1), `server_v2.js` (v2), `server_v3.js` (full OIDC + refresh token persistence). Only `server_v3.js` is maintained and bundled; v1/v2 are legacy.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express 5, Axios, dotenv |
| Frontend | React 19 + Vite 7, JavaScript (JSX) |
| Auth | Gigya OIDC → Ayla Networks JWT |
| Desktop | Electron 39 + electron-builder |

## Directory Structure

```
deshumi_test/
├── backend/
│   ├── server_v3.js       # Current server (the one bundled in Electron)
│   ├── server.js, server_v2.js  # Legacy, unused
│   ├── .env               # Optional, not committed (see below)
│   └── refresh_token.txt  # Runtime state, not committed
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Auth state, credentials storage, view switching
│   │   ├── api.js         # fetch wrapper, API_URL = http://localhost:3001/api
│   │   └── components/    # Dashboard, DeviceDetails, HistoryChart, Icon, LoginView
│   └── vite.config.js     # No proxy — the frontend calls :3001 directly
├── electron-app/
│   ├── main.js            # Spawns backend, serves frontend/dist on 127.0.0.1:5173
│   └── package.json       # electron-builder config (extraResources = backend + frontend/dist)
└── docs/screenshots/      # Used by README.md
```

## Key Commands

```bash
# Backend (http://127.0.0.1:3001)
cd backend && npm install && npm start      # or: npm run dev (node --watch)

# Frontend (http://localhost:5173)
cd frontend && npm install && npm run dev
npm run lint
npm run build

# Desktop app
cd frontend && npm run build                # electron-builder copies frontend/dist
cd ../electron-app && npm install
npm start                                   # run unpackaged
npm run build:win                           # -> electron-app/dist/win-unpacked/DeLonghi_Dehumidifier_Control.exe
```

The Windows build target is `dir` (a `win-unpacked` folder), not a single portable `.exe`. Always rebuild `frontend/dist` before `build:win`, otherwise the old UI gets bundled.

**ELECTRON_RUN_AS_NODE gotcha:** VS Code terminals (and Claude Code inside VS Code) set `ELECTRON_RUN_AS_NODE=1`. With it, Electron and the packaged `.exe` start as plain Node (`bad option: ...` or `Cannot read properties of undefined (reading 'isPackaged')`). Unset it when running the app: `env -u ELECTRON_RUN_AS_NODE ./DeLonghi_Dehumidifier_Control.exe`. Building is not affected.

## Environment Variables

`backend/.env` is optional. The Gigya/Ayla app constants are hardcoded in `server_v3.js`; `.env` only provides fallbacks:

```
DELONGHI_EMAIL=...       # used by /api/login when the body has no email
DELONGHI_PASSWORD=...
PORT=3001
```

**Never commit or bundle `.env`** — it holds the user's account password. It is not in Electron's `extraResources`.

## API Endpoints (server_v3.js)

| Method | Path | Description |
|---|---|---|
| POST | `/api/login` | Log in with De'Longhi account (email/password) |
| POST | `/api/logout` | Clear session and delete `refresh_token.txt` |
| GET | `/api/auth/status` | `{ authenticated, expiresAt }` |
| GET | `/api/devices` | List paired devices |
| GET | `/api/devices/:dsn/status` | Normalized device readings |
| GET | `/api/devices/:dsn/properties` | All raw device properties |
| GET | `/api/devices/:dsn/history/:property` | Datapoints (`?limit=`, max 100) |
| POST | `/api/devices/:dsn/on` / `off` | Power |
| POST | `/api/devices/:dsn/mode` | `{ mode }`, 1–3 |
| POST | `/api/devices/:dsn/humidity` | `{ humidity }`, integer 30–80 |

All `/api/devices` routes require a valid token (auto-refreshed from the stored refresh token).

## Security Notes

- Backend and Electron static server bind to `127.0.0.1`; CORS only allows `http://localhost:5173` / `http://127.0.0.1:5173`.
- Device control inputs are validated (mode, humidity, history property name and limit).
- Gigya/Ayla app constants (API_KEY, CLIENT_ID, CLIENT_SECRET, APP_ID, APP_SECRET) are hardcoded in all server versions.
- "Remember me" stores the password base64-encoded (not encrypted) in `localStorage`.
- Refresh token is stored as plaintext in `refresh_token.txt` next to the server (inside `resources/backend` in the packaged app).
- No rate limiting on `/api/login`.
