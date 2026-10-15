# 🔒 Security and Private Data

## ⚠️ IMPORTANT - DO NOT UPLOAD THESE FILES

The following files contain sensitive data and should **NEVER** be shared or uploaded to Git:

### Credential files:
- ❌ `backend/.env` - Contains your De'Longhi email and password
- ❌ `backend/refresh_token.txt` - Active session token

### Public information in the code:

The following API keys are **public** and are hardcoded in the official De'Longhi apps:
- ✅ `API_KEY = '3_e5qn7USZK-QtsIso1wCelqUKAK_IVEsYshRIssQ-X-k55haiZXmKWDHDRul2e5Y2'` (Gigya)
- ✅ `CLIENT_ID = '1S8q1WJEs-emOB43Z0-66WnL'` (OIDC)
- ✅ `APP_ID = 'DeLonghiComfort2-mw-id'`

These keys are necessary to communicate with the Ayla Networks API and are present in all De'Longhi Comfort apps.

## 📝 Secure Configuration

1. **Copy the example file:**
   ```bash
   cp backend/.env.example backend/.env
   ```

2. **Edit `backend/.env` with your credentials:**
   ```env
   DELONGHI_EMAIL=your_email@example.com
   DELONGHI_PASSWORD=your_real_password
   ```

3. **Never share these files**

## 🔐 Credentials in the browser

When you check "Remember me" in the app:
- Credentials are saved in the browser's `localStorage`
- They are encoded in base64 (NOT real encryption)
- They are only accessible from your local computer
- They are deleted if you clear the browser cache

**Recommendation:** Only use "Remember me" on trusted computers.

## 🌐 Network exposure

- The backend (`:3001`) and the Electron static server (`:5173`) bind to `127.0.0.1`, so other devices on your network cannot reach them.
- The backend accepts cross-origin requests only from `http://localhost:5173` (the app's own UI).
- The static server refuses paths outside the built frontend folder.

## 🚪 Signing out

"Sign out" clears the saved credentials in the UI, drops the backend session and deletes `backend/refresh_token.txt`.

## 🛡️ Protection with .gitignore

The `.gitignore` file in the root protects:
- `.env` files
- `refresh_token.txt`
- `node_modules/` folders
- Compiled distributions

Make sure these files appear as "Untracked" in git before committing.
