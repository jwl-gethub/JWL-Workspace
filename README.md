# Jewellery With Love — Planner

Internal project & task planner for JWL. Dashboard, My Day, Tasks, Inbox,
Projects (with auto progress + health), Team workload, and a weekly
management review screen. Comes pre-loaded with the four live projects
(October Tourmaline, US Expansion, Website CRO, Christmas 2026) and the
recurring review cadence from the planning doc.

Plain Node.js + Express + Postgres. No build step, no framework lock-in —
one server file, one static HTML page, one database table.

## Deploy to Railway (same project as the attribution tool)

1. **Push this folder to a GitHub repo.**
   ```bash
   cd jwl-planner-app
   git init
   git add -A
   git commit -m "JWL planner"
   git branch -M main
   git remote add origin https://github.com/<you>/jwl-planner.git
   git push -u origin main
   ```
   (Create the empty repo on GitHub first, or run `gh repo create jwl-planner --private --source=. --push` if you have the GitHub CLI.)

2. **In Railway:** open the same project the attribution tool lives in →
   **+ New → GitHub Repo** → pick `jwl-planner`. Railway detects Node.js
   and builds it automatically (`npm install` then `npm start`).

3. **Add a database:** in that same project, **+ New → Database →
   PostgreSQL**. Railway wires `DATABASE_URL` into every service in the
   project automatically — you don't need to copy it anywhere.

4. **Set two variables** on the planner service (Settings → Variables):
   - `ACCESS_CODE` — the password your team types to open the app. Without
     this set, the URL is open to anyone who has it.
   - `SESSION_SECRET` — any long random string (e.g. `openssl rand -hex 32`).
     Without this, everyone gets signed out whenever the service restarts.

5. **Generate a domain:** Settings → Networking → Generate Domain. That's
   the URL to share with Roxana, Brett and Rodica.

6. **Load the starting data (once):** using the Railway CLI from this
   folder —
   ```bash
   railway link      # pick this service
   railway run npm run seed
   ```
   This loads the 4 staff, 4 projects and ~75 tasks already prepared. It's
   safe to re-run; it won't create duplicates.

After that, every `git push` to `main` redeploys automatically, same as
the attribution tool.

## Running locally

```bash
npm install
export DATABASE_URL=postgres://user:pass@localhost:5432/jwl_planner
export ACCESS_CODE=devcode
export SESSION_SECRET=dev-secret
npm run seed   # first time only
npm start
```
Open http://localhost:3000.

## How it works

- `server.js` — Express app: session-based login gate, a small REST API
  (`GET /api/state`, `PUT/DELETE /api/:collection/:id`), and a
  Server-Sent-Events stream (`/api/stream`) so every open tab sees changes
  from teammates within about a second, no refresh needed.
- `db.js` — one Postgres table, `documents(collection, id, data jsonb)`.
  Staff, projects and tasks are each a collection; every row's `data` is
  the whole record as JSON, matching what the front end already expects.
- `public/index.html` — the entire app: layout, styling and logic in one
  file, talking to the API above through a small shim so the UI code
  doesn't know or care that it isn't running against a special-purpose
  backend service.

## Editing staff

There's no separate admin panel yet — use **Team → + Add person** in the
app itself. To remove someone, mark them inactive by editing the row
directly in Postgres for now (`UPDATE documents SET data = jsonb_set(data,'{active}','false') WHERE collection='staff' AND id='...'`).

## Security note

This app is reachable at a public Railway URL, gated only by the shared
`ACCESS_CODE`. That's fine for an internal team tool, but don't post the
URL anywhere public, and change the code if it ever leaks. There's no
per-person login — anyone with the code can see and edit everything, which
matches how the planning doc described permissions for v1.
