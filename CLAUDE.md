# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working rules (read before any change)

### Mandatory workflow
1. Diagnose before touching anything. Inspect the real code/state first.
2. Verify real column/table names in Supabase before assuming them. Never guess schema.
3. Make small, surgical edits — never broad rewrites.
4. Test locally: `npm run dev` → localhost:5173.
5. Push to the `modo-oscuro` branch (development), never directly to `main`.
6. Merge to `main` (production, auto-deploys to Vercel) only after local verification.
7. Verify in production after deploy.

### Security — never violate
- NEVER use the Supabase `service_role` key in database triggers or in browser-side code. It belongs only in Vercel serverless functions (`api/`) via `SUPABASE_SERVICE_KEY`.
- App config needed by triggers lives in the protected `_app_config` table, read via the `get_app_config()` SECURITY DEFINER function — never inline the key.
- Mask any keys, tokens, or secrets before showing them in output.
- Private `pdfs` bucket is served via signed URLs only. Do not make it public.
- Edge Functions deploy separately: `npx supabase functions deploy [name]`. They are NOT deployed by the Vercel push.

### Domain vocabulary (HVAC) — critical distinction
- `averias` = breakdown/repair jobs (avisos).
- `mantenimientos` = ONE-OFF sporadic maintenance, attached to averías.
- `contratos` = PERIODIC recurring maintenance, attached to `instalaciones`.
- **NEVER confuse `mantenimientos` with `contratos`.** They are different concepts on different tables. This distinction is core to the product.

### App.jsx
App.jsx is a ~8,784-line monolith under active phased refactor. Do NOT rewrite it wholesale. Do not load the entire file into context when a targeted section will do. Extracted modules already live in organized subdirectories (utils, hooks, constants, PDF generators).

## Commands

```bash
npm run dev        # Start Vite dev server (localhost:5173)
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
```

No test suite or linter is configured.

## Architecture

**ThermoGest** is a field-service management app for HVAC companies (calefacción/climatización). It is a React + Vite SPA deployed on Vercel with Supabase as the database and auth provider.

### Routing

Routing is **manual**, not React Router. `src/main.jsx` checks `window.location.pathname` and renders one of three root components:

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `App.jsx` | Admin/technician dashboard (requires login) |
| `/contacto` | `Contacto.jsx` | Public intake form for new clients |
| `/cliente/:token` | `Portal.jsx` | Read-only client self-service portal, authenticated by a UUID token stored in `clientes.portal_token` |

`vercel.json` rewrites all paths to `/index.html` to support this.

### Backend (Vercel Serverless Functions)

`api/` contains two Vercel functions that run server-side using the **Supabase service role key** (never exposed to the browser):

- `api/contacto.js` — called by both `Contacto.jsx` and `Portal.jsx`. Creates or matches a client by phone/email, then inserts an `averia`, `mantenimiento`, or `presupuesto` record, and creates in-app notifications for all admin users.
- `api/usuarios.js` — called from `App.jsx` to create/delete users via Supabase Auth Admin API.

These functions require `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` environment variables set in Vercel (not the anon key).

### Supabase Client

- `src/supabase.js` — exports a singleton Supabase client using the **anon key** (safe for browser). Used by `App.jsx`.
- `Portal.jsx` and `Contacto.jsx` each inline their own `createClient()` call with `{ auth: { persistSession: false, autoRefreshToken: false } }` since they are unauthenticated views.

### App.jsx (Main Dashboard)

This file is very large (~325 KB) and contains the entire admin interface as a single file. Key sections:

- **Login screen** — email/password auth via `supabase.auth.signInWithPassword`; profile fetched from `profiles` table (role: `admin` | `tecnico`)
- **Sidebar** — role-aware navigation; admin sees all sections, tecnico sees a subset
- **Views** rendered by a `view` state string: `dashboard`, `averias`, `mantenimientos_sec`, `instalaciones_obras`, `contratos`, `presupuestos`, `clientes`, `usuarios`, `empresa`, `calendario`, `fichajes`

### Supabase Tables (key ones)

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts (id = Supabase Auth UID), role, color, activo |
| `clientes` | Clients; `portal_token` is UUID for Portal access |
| `averias` | Breakdown/repair jobs |
| `mantenimientos` | One-off maintenance visits |
| `instalaciones` | Installations with recurring maintenance schedules (mensual/trimestral/semestral/anual) |
| `presupuestos` | Quotes |
| `contratos` | Maintenance contracts linked to instalaciones |
| `partes` | Work reports attached to averias |
| `equipos` | Equipment per client |
| `revisiones` | Revision history per client |
| `eventos` | Calendar events |
| `fichajes` | Clock-in/out time tracking |
| `notificaciones` | In-app notifications per user |
| `empresa` | Single-row company settings (id=1), including `color_corporativo` and `logo_url` |

### Status Enumerations

Defined as plain objects at the top of each file:

- `BS` — avería statuses: `nueva → en_reparacion → pendiente_piezas → presupuesto_enviado → cerrada → pendiente_facturar → facturado`
- `MS` — mantenimiento statuses: `nuevo → en_proceso → cerrado → pendiente_facturar → facturado`
- `PS` — presupuesto statuses: `nuevo → enviado → aceptado | rechazado → facturado`
- `MT` — maintenance contract frequencies: `mensual` (30d), `trimestral` (90d), `semestral` (180d), `anual` (365d)

### Styling

All styles are **inline React styles** — no CSS files, no CSS modules, no Tailwind. A `T` object holds the color palette (defined at the top of each component file). The `inp()` helper function returns base input styles and accepts overrides. Google Fonts loaded via `<style>` tag: **Sora** for headings, **DM Sans** for body text.
