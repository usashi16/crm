# GB Tech Corp Platform

A React front end backed by a Flask API and a local SQLite database:

- Public website with services, a contact enquiry form, and a light/dark theme
- Admin login and a protected business CRM for leads, an employee directory, team tasks, and customer enquiries

## Sign-in

Sign-in is built in and free: Flask sessions (HTTP-only cookie), Werkzeug password hashes, and role checks on every admin API route. Accounts live in the local SQLite database, so there is no third-party service or account to set up. Set `GBTECH_SECRET_KEY`, `GBTECH_ADMIN_USERNAME`, and `GBTECH_ADMIN_PASSWORD` before deploying.

## Setup

You need Python 3 and Node.js 20 or newer.

1. Copy your existing `manage_users.py` into this folder, and your images into `public/images/` (see the note in that folder).
2. Install dependencies:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
npm install
```

3. Set a local administrator account:

```powershell
$env:GBTECH_SECRET_KEY = "replace-with-a-long-random-secret"
$env:GBTECH_ADMIN_USERNAME = "your-admin-username"
$env:GBTECH_ADMIN_PASSWORD = "your-strong-password"
```

## Run it

**While developing** (hot reload), use two terminals:

```powershell
python app.py        # API on http://127.0.0.1:8000
npm run dev          # React app on http://127.0.0.1:5173 (forwards /api to Flask)
```

**As one app** (how you would deploy it):

```powershell
npm run build        # creates dist/
python app.py        # serves the site and the API on http://127.0.0.1:8000
```

Pages: `/` (website), `/admin-login`, and `/crm` (admin only). The old `.html` addresses redirect to these.

## Create accounts

```powershell
python manage_users.py --role student --username student01 --password "strong-password" --name "Student Name" --email "student@example.com" --student-number "GB-1001" --program "Digital Business"
```

Use `--role admin` (without the student-only options) to create more administrators.

## Project files

- `app.py` - Flask server, SQLite schema, authentication, API routes, and serving of `dist/`
- `index.html`, `vite.config.js`, `package.json` - Vite and React setup
- `src/main.jsx`, `src/App.jsx` - entry point and routes
- `src/pages/` - `HomePage`, `AdminLoginPage`, `CrmPage`
- `src/components/` - theme toggle, toasts, scroll reveal and count-up animations
- `src/lib/` - API helper, auth context, theme store, router, motion helpers
- `src/styles.css` - shared responsive styles, including the dark theme
- `public/images/` - logo and service images

The database is created at `instance/gbtech.sqlite3` on first run. The only value kept in the browser is the theme choice (`gb-theme` in `localStorage`).
