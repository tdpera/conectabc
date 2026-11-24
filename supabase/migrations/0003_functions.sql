-- Cria o perfil ao registrar; o e-mail em ADMIN_EMAIL vira administrador.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    lower(new.email) = lower(coalesce(current_setting('app.admin_email', true), ''))
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Para definir o admin: alter database postgres set app.admin_email = 'voce@exemplo.com';
-- ou: update public.profiles set is_admin = true where email = 'voce@exemplo.com';
