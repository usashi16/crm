# GB Tech Corp CRM project guide

## Project overview

A small CRM for GB Tech Corp. A public website and an admin-only dashboard for tracking leads and viewing employee (student) and operational records.

## Tech stack

- **Front end:** React 19 built with Vite. Plain CSS in `src/styles.css`. No UI or routing library.
- **Backend:** Python with Flask
- **Database:** SQLite, stored at `instance/gbtech.sqlite3`
- **Authentication:** Flask sessions with HTTP-only cookies, role checks, and Werkzeug password hashing. Accounts are local; there is no third-party identity provider.
- **Python dependency:** Flask, declared in `requirements.txt`

## Front end structure

- `src/App.jsx` maps `/`, `/admin-login`, and `/crm` to pages with a small History API router (`src/lib/router.jsx`).
- `src/lib/auth.jsx` holds the signed-in user (from `GET /api/auth/me`). The CRM page redirects non-admins to `/admin-login`, but this is only a convenience: the server enforces access.
- `src/pages/CrmPage.jsx` is the dashboard. All views stay mounted and the `#hash` (`#leads`, `#students`, ...) picks the visible one.
- `src/lib/theme.js` is the light/dark store (`data-theme` on `<html>`, saved as `gb-theme`). The inline script in `index.html` applies it before first paint.
- Dark mode is an override layer at the end of `src/styles.css` under `[data-theme="dark"]`. Add a matching override when adding components with hardcoded colors.
- Motion (scroll reveal, count-up, toasts, row animations) lives in `src/components/` and `src/lib/motion.js`, with CSS in the same final section of the stylesheet. Everything respects `prefers-reduced-motion`.

The CRM provides: summary metrics, a lead form, a searchable and status-filterable lead list with delete, an approval queue for new registrations, and read-only previews (first five) of employees, applications, tasks, and enquiries. The sidebar monthly target is static.

## Data flow and API

React calls the Flask API with `fetch()` through `src/lib/api.js`.

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `POST /api/admin/students/<user_id>/approve`
- `GET /api/admin/summary`
- `GET`/`POST /api/admin/leads` (supports `q` and `status`), `DELETE /api/admin/leads/<id>`
- `GET /api/admin/students`, `/applications`, `/tasks`, `/enquiries`
- `POST /api/enquiries` (public contact form)

Admin routes use the `auth_required("admin")` guard. Existing students provisioned through `manage_users.py` are active by default; public registrations stay pending until an administrator approves them.

## Serving

In production Flask serves the built `dist/` folder: `/` and `/admin-login` return the React app, `/crm` does too but redirects signed-out visitors to `/admin-login`, and the old `.html` URLs redirect to the new routes. During development Vite serves the app on port 5173 and proxies `/api` to Flask on port 8000.

## Key files

- `app.py` - Flask app, database schema, authentication, API routes, serving `dist/`
- `manage_users.py` - command-line account provisioning
- `index.html`, `vite.config.js`, `package.json` - Vite setup
- `src/` - React source (see above)
- `public/images/` - logo and service images
- `README.md` - setup and account instructions

## Local development

Follow `README.md`. At minimum set `GBTECH_SECRET_KEY`, `GBTECH_ADMIN_USERNAME`, and `GBTECH_ADMIN_PASSWORD`, then run `python app.py` and `npm run dev`. For a single-server run, `npm run build` first.

## Change guidance

- Keep admin-only data behind admin-protected API routes; do not rely on hiding UI for access control.
- Use parameterized SQLite queries for user-provided values.
- Do not treat the displayed lead value sum as realized revenue; it is currently a simple sum of lead values.
- Update this guide and `README.md` when structure, setup, or user-facing behavior changes.
