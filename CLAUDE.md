# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
