# Despliegue Fase 1 — Motor adaptativo (Edge Function + cron)

Estos pasos requieren que **tú** los corras (el agente no tiene el PAT de
Supabase en esta sesión). Son los mismos que usamos para el schema/trigger.

## 0. Login + link (si no está hecho en esta máquina)
```bash
export SUPABASE_ACCESS_TOKEN=<tu_PAT_sbp_...>
supabase login --token "$SUPABASE_ACCESS_TOKEN"
supabase link --project-ref cqcpkuskimahmifvlckd
```

## 1. Setear secrets de la Edge Function
La función `compute_weekly` lee `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
desde su propio entorno (NO desde la petición). Hay que setearlos una vez:
```bash
supabase secrets set \
  SUPABASE_URL=https://cqcpkuskimahmifvlckd.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<tu_SERVICE_ROLE> \
  SUPABASE_ANON_KEY=<tu_ANON>
```
> El `SERVICE_ROLE` aquí es el que la función usa internamente para leer
> registros_diarios de todos los usuarios. El frontend NO lo usa nunca.

## 2. Desplegar la función
```bash
supabase functions deploy compute_weekly
```

## 3. Aplicar el cron semanal
```bash
supabase db query --file supabase/cron.sql --linked
```
(O si prefieres: pega el contenido de `supabase/cron.sql` en el SQL Editor
de Supabase y lo corres ahí.)

## 4. Verificar
```bash
# triggear manualmente para un usuario (reemplaza UUID):
curl -X POST https://cqcpkuskimahmifvlckd.supabase.co/functions/v1/compute_weekly \
  -H "Authorization: Bearer <SERVICE_ROLE>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<UUID>"}'
```
Debe devolver `{ "ok": true, "tdee": ..., "metaDiaria": ..., ... }`.
Luego en Table Editor: `perfiles.tdee_actual` y `checkins` deben actualizarse.

## 5. (El frontend ya quedó listo)
El frontend Vercel ya lee `perfiles` (TDEE + déficit) y muestra la pantalla
"Hoy" con meta diaria, consumido y restante, más el onboarding. Solo falta
que el motor corra por cron para que `tdee_actual` deje de ser el default 2500.
