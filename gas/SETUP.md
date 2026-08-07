# Google Apps Script setup

1. Create a spreadsheet named `Lift Coach Data` in the intended Drive folder and copy its ID from the URL.
2. Create a new Apps Script project at `script.google.com`.
3. Set `DEFAULT_SHEET_ID` in `Code.gs` to that spreadsheet ID, paste the file, and run `setup()` once.
4. Select **Deploy > New deployment > Web app**.
5. Execute as **Me**. For personal use, choose the narrowest access option that still lets the PWA call the deployment.
6. Copy the `/exec` URL and set it as `DEFAULT_API_URL` in `app/app.js` (or paste it under **Settings > Cloud sync URL**).
7. Press **Sync now**. The app uploads queued sets, then restores the user's cloud history and de-duplicates by `set_id`.

Never place an OpenAI API key or other secret in `app.js`. Future AI credentials belong in Apps Script Properties.