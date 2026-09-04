-- ============================================================
-- REBUSCÁNDOME — ADMINISTRADOR ÚNICO
-- Migración incremental después de 001_initial_schema.sql
-- ============================================================

-- Solo puede existir UN perfil con role = 'admin'.
create unique index if not exists uq_profiles_single_admin
on public.profiles (role)
where role = 'admin';

-- El trigger de protección permite cambios administrativos ejecutados
-- desde el entorno de base de datos (auth.uid() IS NULL), por ejemplo
-- al provisionar el único administrador desde el SQL Editor de Supabase.
create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Contexto de base de datos confiable (SQL Editor / servidor privilegiado)
  if auth.uid() is null then
    return new;
  end if;

  -- Usuario autenticado normal: no puede escalar privilegios ni cambiar
  -- el estado de seguridad de su propio perfil.
  if not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
  end if;

  return new;
end;
$$;

-- Función de provisionado del administrador único.
-- Se ejecuta solo desde un contexto privilegiado (auth.uid() IS NULL).
create or replace function public.bootstrap_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_exists boolean;
begin
  if auth.uid() is not null then
    raise exception 'bootstrap_admin solo puede ejecutarse desde un contexto privilegiado';
  end if;

  select exists(
    select 1 from public.profiles where role = 'admin'
  ) into admin_exists;

  if admin_exists then
    raise exception 'Ya existe un administrador en Rebuscandome';
  end if;

  if not exists(
    select 1 from auth.users where id = p_user_id
  ) then
    raise exception 'El usuario de Auth indicado no existe';
  end if;

  -- El administrador no necesita registro de afiliado.
  delete from public.affiliates
  where profile_id = p_user_id;

  update public.profiles
  set
    role = 'admin',
    status = 'active',
    onboarding_completed = true,
    updated_at = now()
  where id = p_user_id;

  if not found then
    insert into public.profiles (
      id,
      role,
      status,
      onboarding_completed
    )
    values (
      p_user_id,
      'admin',
      'active',
      true
    );
  end if;
end;
$$;

-- Evitamos que la función pueda invocarse desde la app pública.
revoke execute on function public.bootstrap_admin(uuid) from public;
revoke execute on function public.bootstrap_admin(uuid) from anon;
revoke execute on function public.bootstrap_admin(uuid) from authenticated;

-- Verificación del cambio.
select 'Administrador único habilitado correctamente' as result;
