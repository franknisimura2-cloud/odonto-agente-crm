-- =============================================================================
-- 0034 — A equipe, para a tela "Equipe e acessos"
-- =============================================================================
--
-- A dona precisa ver quem é quem (o e-mail de login) e o que cada um pode,
-- de fato, fazer — o padrão do papel com os ajustes dela por cima.
--
--   usuarios.email            o login, copiado do Auth (a tela não lê o Auth)
--   permissao_efetiva(...)    a regra de uma permissão para um usuário — a
--                             MESMA que a pode() usa (ela passa a chamar esta)
--   equipe()                  a lista, com as permissões efetivas de cada um;
--                             vazia para quem não tem `equipe`
--
-- Criar um login novo e gerar senha provisória NÃO é aqui: precisa da chave
-- de serviço (Auth admin), e mora na função `whatsapp` (rotas /equipe/...),
-- que confere `equipe` antes.
-- =============================================================================

alter table public.usuarios add column if not exists email text;

update public.usuarios u
   set email = a.email
  from auth.users a
 where a.id = u.id and u.email is distinct from a.email;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nome, papel, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    case when exists (select 1 from public.usuarios where papel = 'dona' and ativo)
         then 'profissional' else 'dona' end,
    new.email
  );
  return new;
end;
$$;

-- A regra de uma permissão para um usuário qualquer. `pode()` passa a ser só
-- "esta regra, para quem está logado" — uma regra, dois usos.
create or replace function public.permissao_efetiva(p_papel text, p_permissoes jsonb, p_permissao text)
returns boolean
language sql
immutable
as $$
  select case
    when p_papel = 'dona' then true
    else coalesce((p_permissoes ->> p_permissao)::boolean, public.permissao_padrao(p_papel, p_permissao))
  end
$$;

create or replace function public.pode(p_permissao text)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((
    select public.permissao_efetiva(u.papel, u.permissoes, p_permissao)
      from public.usuarios u
     where u.id = auth.uid() and u.ativo
  ), false)
$$;

create or replace function public.equipe()
returns table (
  id uuid,
  nome text,
  email text,
  papel text,
  profissional_id uuid,
  ativo boolean,
  permissoes jsonb,
  efetivas jsonb,
  created_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select u.id, u.nome, u.email, u.papel, u.profissional_id, u.ativo, u.permissoes,
         (select jsonb_object_agg(p, public.permissao_efetiva(u.papel, u.permissoes, p))
            from unnest(array[
              'dashboard', 'valores', 'conversas', 'agenda_todas', 'agenda_editar',
              'pessoas', 'crm', 'exportar', 'configurar', 'equipe'
            ]) as p),
         u.created_at
    from public.usuarios u
   where public.pode('equipe')
   order by u.ativo desc, (u.papel = 'dona') desc, u.nome
$$;

revoke all on function public.permissao_efetiva(text, jsonb, text) from public, anon;
revoke all on function public.equipe() from public, anon;
grant execute on function public.permissao_efetiva(text, jsonb, text) to authenticated, service_role;
grant execute on function public.equipe() to authenticated, service_role;
