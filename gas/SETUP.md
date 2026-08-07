# Google Apps Script setup

1. Create a spreadsheet named `Lift Coach Data` in the intended Drive folder and copy its ID from the URL.
2. Create a new Apps Script project at `script.google.com`.
3. Under **Project Settings > Script Properties**, add `SHEET_ID` with that ID and `SYNC_TOKEN` with a long random value. Keep both out of the public repository.
4. Paste `Code.gs`, then run `setup()` once and authorize it.
5. Select **Deploy > New deployment > Web app**.
6. Execute as **Me**. For personal use, choose the narrowest access option that still lets the PWA call the deployment.
7. Copy the `/exec` URL and set it as `DEFAULT_API_URL` in `app/app.js` (or paste it under **Settings > Cloud sync URL**). Enter the same `SYNC_TOKEN` in the app's sync settings.
8. Press **Sync now**. The app uploads queued sets, then restores the user's cloud history and de-duplicates by `set_id`.

Never place an OpenAI API key or other secret in `app.js`. Future AI credentials belong in Apps Script Properties.