-- ============================================================================
-- Trigger de signup: al crearse un usuario en auth.users, crea su fila en
-- public.perfiles con valores por defecto (TDEE 2500, déficit 15%, cut).
-- Se ejecuta como SECURITY DEFINER para poder insertar en perfiles desde el
-- contexto de auth (el usuario aún no tiene fila). NO salta RLS: solo crea
-- la fila del propio usuario recién registrado.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
