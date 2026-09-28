-- =============================================================================
-- 0035 — Só uma dona mexe em donas
-- =============================================================================
--
-- A permissão `equipe` deixa alguém mudar os acessos dos outros. Sem esta
-- trava, ela seria a porta para virar dona: bastava a recepcionista com
-- `equipe` pôr `papel = 'dona'` na própria linha — ou mexer na linha da dona.
--
-- Agora, pela equipe (papel `authenticated`):
--   - promover alguém a dona, ou mudar qualquer coisa de acesso de uma dona,
--     exige SER dona;
--   - o resto continua exigindo `equipe`, como na 0031.
--
-- A rota que gera senha provisória (função `whatsapp`, /equipe/nova-senha)
-- aplica a mesma regra: senha de dona, só uma dona gera.
-- =============================================================================

create or replace function public.sou_dona()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.usuarios u where u.id = auth.uid() and u.ativo and u.papel = 'dona')
$$;

revoke all on function public.sou_dona() from public, anon;
grant execute on function public.sou_dona() to authenticated, service_role;

create or replace function public.usuarios_protege_acesso()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.papel, new.permissoes, new.profissional_id, new.ativo)
     is distinct from (old.papel, old.permissoes, old.profissional_id, old.ativo) then

    if current_user = 'authenticated' then
      if not public.pode('equipe') then
        raise exception 'sem_permissao: só quem gerencia a equipe muda os acessos'
          using errcode = '42501';
      end if;
      if (old.papel = 'dona' or new.papel = 'dona') and not public.sou_dona() then
        raise exception 'sem_permissao: só uma dona promove ou altera outra dona'
          using errcode = '42501';
      end if;
    end if;

    if old.papel = 'dona' and old.ativo
       and (new.papel <> 'dona' or not new.ativo)
       and not exists (
         select 1 from public.usuarios u
          where u.papel = 'dona' and u.ativo and u.id <> old.id
       ) then
      raise exception 'ultima_dona: a empresa precisa de pelo menos uma dona ativa'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
