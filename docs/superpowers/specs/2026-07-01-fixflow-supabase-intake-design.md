# FixFlow — Diseño (spec)

- **Fecha:** 2026-07-01
- **Estado:** Aprobado (brainstorming)
- **Autor:** Nick Granados (con Claude)

> Nota: este spec está en español para revisión de Nick. El README público final del repo se escribirá en inglés (case study para reclutadores).

## 1. Propósito y contexto

FixFlow es un mini-app de **intake de solicitudes de servicio con QR**. Sirve para dos cosas:

1. **Cerrar el gap de Supabase** de Nick (RLS, Edge Functions, Auth, Storage) construyendo algo real (ver principio `gap-to-project-strategy`).
2. Ser una **pieza de portfolio** para aplicar al rol "Senior Fullstack Supabase Engineer" (workflow apps para service-industry: intake con QR, status tracking, portal técnico/admin, fotos/documentación).

**Escenario:** un cliente escanea el QR de un local, reporta un problema (con foto), y el staff (admin/técnico) lo gestiona.

## 2. Objetivos y no-objetivos

**Objetivos (v1):**
- Demostrar con evidencia: Auth + **RLS de 3 niveles** + Edge Function + Storage.
- Loop completo funcionando y deployado, con un README tipo case study.

**No-objetivos (v1, por YAGNI — quedan en el roadmap):**
- Realtime, SMS/Twilio, pagos/Stripe, CI/CD, optimización de performance, multi-tenancy avanzado.

## 3. Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui.
- **Backend:** Supabase → Auth, Postgres (con RLS), Storage, Edge Functions (Deno/TS).
- **Email:** Resend.
- **Deploy:** Vercel (frontend) + Supabase cloud (backend). Repo público en GitHub (`internick2017`).

## 4. Arquitectura

### Dos mundos
1. **Público (sin login):** cliente escanea QR del local → formulario de intake → describe problema + sube foto → se crea el ticket → se dispara el email al staff.
2. **Staff (con login):**
   - **Técnico:** ve solo los tickets asignados a él; actualiza estado.
   - **Admin:** ve todo; asigna tickets a técnicos; ve los QR de cada local.

### Pantallas (rutas)
- `/` — landing corta + botón de login.
- `/intake/[locationId]` — formulario público (destino del QR).
- `/login` — login de staff.
- `/dashboard` — lista de tickets (filtrada por rol vía RLS).
- `/tickets/[id]` — detalle del ticket (ver + cambiar estado; admin puede asignar).
- `/admin/locations` — admin: locales + sus QR (solo admin).

### El loop (flujo de datos)
QR → formulario intake → se crea ticket → Database Webhook → Edge Function → email al staff → staff loguea → ve el ticket (filtrado por RLS) → actualiza estado.

## 5. Modelo de datos

### Tabla `profiles` (staff + rol)
- `id` (PK, referencia a `auth.users`)
- `full_name` (text)
- `role` (enum: `admin` | `tecnico`)
- `created_at` (timestamptz)

Patrón estándar Supabase: los logins viven en `auth.users` (protegida); `profiles` se engancha para guardar nombre y rol.

### Tabla `locations` (locales, cada uno con su QR)
- `id` (PK, uuid)
- `name` (text) — ej: "Sucursal Centro"
- `created_at` (timestamptz)

### Tabla `tickets` (solicitudes de servicio)
- `id` (PK, uuid)
- `location_id` (FK → `locations.id`)
- `description` (text)
- `photo_path` (text, nullable) — ruta en Storage
- `customer_contact` (text, nullable) — email/teléfono opcional del cliente
- `status` (enum: `received` | `in_progress` | `resolved`, default `received`)
- `assigned_to` (FK → `profiles.id`, nullable)
- `created_at` (timestamptz)

### Relaciones
- Cada ticket pertenece a un local (`location_id`).
- Cada ticket puede estar asignado a un técnico (`assigned_to`).
- Cada profile es un usuario del staff.

### Storage
- Bucket `ticket-photos` para las fotos. La ruta queda en `tickets.photo_path`.

## 6. Auth y roles

- Supabase Auth maneja el login del staff (email + password). El usuario logueado se identifica en las policies como `auth.uid()`.
- El cliente anónimo no loguea (usa el rol público `anon`).
- El rol (`admin`/`tecnico`) se guarda en `profiles.role` y se setea en los datos de ejemplo (seed).

## 7. RLS (políticas de seguridad)

Se prende RLS en todas las tablas (deny by default: sin policy, nadie entra). Policies:

### `tickets`
- **INSERT:** cualquiera, incl. `anon` (intake público).
- **SELECT:** admin = todos · técnico = solo `assigned_to = auth.uid()` · anónimo = ninguno.
- **UPDATE:** admin = cualquiera (estado + asignación) · técnico = solo los suyos (solo estado) · anónimo = no.
- **DELETE:** solo admin.

### `locations`
- **SELECT:** todos, incl. anónimo (para mostrar el nombre del local en el intake).
- **INSERT/UPDATE/DELETE:** solo admin.

### `profiles`
- **SELECT:** staff logueado (el admin necesita ver técnicos para asignar).
- **UPDATE:** cada uno el suyo.

### Storage (`ticket-photos`)
- **INSERT (subir):** anónimo (intake).
- **SELECT (ver):** staff logueado.

> Nota de implementación: el chequeo de rol dentro de las policies se hace mirando `profiles` del `auth.uid()` (posible helper `is_admin()` / función `security definer`, a definir en el plan).

## 8. Edge Function (email)

- **Disparo:** Database Webhook sobre INSERT en `tickets`. Supabase llama sola a la Edge Function cuando entra un ticket (desacoplado del navegador).
- **Acción:** con la API de Resend, manda email al staff: "Nuevo ticket en [local]: [descripción]".
- **Secretos:** `RESEND_API_KEY` vive solo como secret de la Edge Function en Supabase, nunca en el frontend.

## 9. Manejo de errores

- **Formulario intake:** validación (descripción obligatoria), estados de carga, mensaje de éxito, error amable si falla envío o subida de foto.
- **Edge Function:** si Resend falla, no rompe la creación del ticket (el ticket ya está guardado; email best-effort) y loguea el error.
- **RLS en UI:** si un técnico abre un ticket que no es suyo, no recibe fila → mostrar "sin acceso / no encontrado".

## 10. Testing (liviano, prueba lo importante)

- **Tests de RLS** (los más valiosos): verifican que anónimo puede crear pero no leer; que técnico ve solo los suyos; que admin ve todo. Prueban con evidencia que la seguridad funciona.
- **Smoke test** del flujo de intake.
- (e2e y unit del front → roadmap.)

## 11. Deploy

- **Backend:** proyecto Supabase (free tier) = DB + Auth + Storage + Edge Function.
- **Frontend:** Vercel conectado al repo (auto-deploy).
- **Repo:** público en GitHub, con README case study (decisiones + diagrama).
- **Env:** `NEXT_PUBLIC_SUPABASE_URL` + anon key en el frontend (públicas, ok); `RESEND_API_KEY` como secret de Supabase.
- **QR:** generados con librería, apuntando a `/intake/[locationId]`; el admin los ve en su pantalla de locales.

## 12. Roadmap de crecimiento (subir de nivel a senior)

Para reusar el demo cuando un rol pida más senior:
- Mover escrituras críticas a Edge Functions con `service role` + validación (backend-for-frontend por encima de RLS).
- Realtime (dashboard en vivo).
- Tests unit + e2e + CI/CD (GitHub Actions).
- Performance: índices, leer `EXPLAIN`, optimizar queries.
- Integraciones: Twilio (SMS), Stripe (pagos).
- Multi-tenancy real (locations → organizaciones con aislamiento).
- Observabilidad: audit log, rate-limiting, logs estructurados.

## 13. Decisiones tomadas

- Escenario: intake de servicio con QR (vs inspección de equipos / tracking de reparaciones).
- Roles: Admin + Técnico + cliente anónimo (3 niveles) para RLS rico.
- Edge Function: email vía Resend (vs cron / intake seguro).
- Con locations (esquema relacional) vs QR único global.
- Enfoque 1 (Supabase estándar, RLS al frente) vs backend-for-frontend por Edge Functions.
