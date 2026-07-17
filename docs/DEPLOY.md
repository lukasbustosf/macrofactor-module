# Despliegue — pasos verificados

URLs actuales (verificadas):
- Frontend: `https://macrofactor-module-tfcc.vercel.app`
- Backend: `https://insightful-youth-production.up.railway.app`
- Supabase: `cqcpkuskimahmifvlckd.supabase.co`

## 1. Variables de entorno

### Supabase (`web/.env.local` y Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=https://cqcpkuskimahmifvlckd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
NEXT_PUBLIC_BACKEND_URL=https://insightful-youth-production.up.railway.app
```

### Backend Railway
```
SUPABASE_URL=https://cqcpkuskimahmifvlckd.supabase.co
SUPABASE_ANON_KEY=<anon>
PORT=<lo da Railway>
```

### Edge Function `compute_weekly`
Usa el secret **nativo** de Supabase `SUPABASE_SERVICE_ROLE_KEY` (ya existe en
el proyecto). No hay que setear nada manual, salvo si se quisiera sobrescribir.

## 2. Frontend → Vercel
- Root Directory: **`web`** (clave: el `pyproject.toml` raíz hace que Vercel
  detecte Python; con Root Directory=web fuerza Next.js).
- Framework: Next.js. Build: `npm run build`. Output: `.next` (automático).
- Variables: las 3 `NEXT_PUBLIC_*` de arriba.
- Deploy automático desde `master` (push).

## 3. Backend → Railway
- Root Directory: **`backend`**.
- `backend/railway.json` define start `uvicorn main:app --host 0.0.0.0 --port $PORT`
  y healthcheck `/health`.
- NOTA: el `railway.json` raíz es para el servicio de frontend (web); el de
  `backend/` sobreescribe para el contenedor Python.
- Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
- El viejo servicio de frontend en Railway (`macrofactor-module-production`) debe
  borrarse para no pagar doble (ya está en Vercel).

## 4. Edge Function → Supabase CLI
Requiere CLI autenticado (`supabase login` con PAT sbp_... o OAuth).
```bash
export SUPABASE_ACCESS_TOKEN=<PAT>
supabase login --token "$SUPABASE_ACCESS_TOKEN"
supabase link --project-ref cqcpkuskimahmifvlckd

# (opcional) sobreescribir secrets:
supabase secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=<anon>

supabase functions deploy compute_weekly

# cron semanal:
supabase db query --file supabase/cron.sql --linked
# o pegar supabase/cron.sql en el SQL Editor.
```

## 5. Verificación post-deploy
```bash
# backend
curl https://insightful-youth-production.up.railway.app/health   # {"ok":true}
curl -H "Authorization: Bearer <JWT>" \
  "https://insightful-youth-production.up.railway.app/api/correlacion?dias=30"

# frontend
curl -sI https://macrofactor-module-tfcc.vercel.app/ | head -1   # HTTP/2 200

# edge function (manual)
curl -X POST https://cqcpkuskimahmifvlckd.supabase.co/functions/v1/compute_weekly \
  -H "Authorization: Bearer <SERVICE_ROLE>" -d '{"all": true}'

# cron
supabase db query --linked "select jobname, schedule, active from cron.job;"
```
