-- ============================================================================
-- Cron semanal: recalcula TDEE/meta para TODOS los usuarios.
--
-- Se ejecuta los lunes a las 06:00 UTC vía pg_cron, invocando la Edge Function
-- compute_weekly en modo { "all": true }. La función usa su propio SERVICE_ROLE
-- (secret de la Edge Function), así que NO se embedde ninguna key aquí.
--
-- Aplicar (Supabase SQL Editor, o: supabase db query --file supabase/cron.sql --linked)
-- Requiere las extensiones pg_cron y pg_net (ya vienen en Supabase).
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Limpia el job previo si existe (idempotente)
select cron.unschedule('compute_weekly_all');

-- Agenda: lunes 06:00 UTC
select cron.schedule(
  'compute_weekly_all',
  '0 6 * * 1',
  $$
  select net.http_post(
    url:='https://cqcpkuskimahmifvlckd.supabase.co/functions/v1/compute_weekly',
    body:='{"all": true}'::jsonb
  );
  $$
);

-- Verificar que quedó agendado:
-- select * from cron.job where jobname = 'compute_weekly_all';
