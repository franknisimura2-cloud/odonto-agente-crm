-- =============================================================================
-- 0033 — O valor pago de cada consulta, só para quem tem `valores`
-- =============================================================================
--
-- A 0031 fechou o valor ACUMULADO da pessoa (`crm_clinica_dados`). Cada
-- consulta também guarda o seu (`consultas.valor_pago`), e ele continuava ao
-- alcance de quem vê a agenda — a recepcionista e a profissional liam o
-- faturamento consulta por consulta.
--
-- Mesmo remédio: a coluna sai do alcance do papel `authenticated`, e volta
-- filtrada por duas funções que conferem `pode('valores')`:
--
--   valores_das_consultas(ids)             os valores, só das consultas que a
--                                          pessoa já vê (a mesma regra da
--                                          política `consultas_le`)
--   definir_valor_pago_consulta(id, valor) grava
--
-- ⚠️ `select('*')` EM `consultas` QUEBRA A PARTIR DAQUI. O `*` pede todas as
-- colunas, e uma delas não é mais da equipe: "permission denied for column".
-- A tela lista as colunas (`COLUNAS_CONSULTA`, em `src/lib/consultas.ts`) — e
-- coluna nova nesta tabela precisa entrar lá E num `grant` como os de baixo.
-- =============================================================================

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'consultas'
     and column_name <> 'valor_pago';

  execute 'revoke select, insert, update on public.consultas from authenticated';
  execute format(
    'grant select (%1$s), insert (%1$s), update (%1$s) on public.consultas to authenticated',
    cols);
end $$;

create or replace function public.valores_das_consultas(p_ids uuid[])
returns table (id uuid, valor_pago numeric)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.valor_pago
    from public.consultas c
   where c.id = any(p_ids)
     and public.pode('valores')
     -- SECURITY DEFINER passa por cima do RLS: a visibilidade da política
     -- `consultas_le` é repetida aqui, senão bastaria saber um id para ler o
     -- valor de uma consulta que a pessoa não enxerga.
     and (public.pode('agenda_todas') or public.pode('pessoas') or public.pode('conversas')
          or c.profissional_id = public.meu_profissional())
$$;

create or replace function public.definir_valor_pago_consulta(p_id uuid, p_valor numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pode('valores') then
    raise exception 'sem_permissao: sem acesso aos valores' using errcode = '42501';
  end if;
  update public.consultas set valor_pago = p_valor where id = p_id;
end;
$$;

revoke all on function public.valores_das_consultas(uuid[]) from public, anon;
revoke all on function public.definir_valor_pago_consulta(uuid, numeric) from public, anon;
grant execute on function public.valores_das_consultas(uuid[]) to authenticated, service_role;
grant execute on function public.definir_valor_pago_consulta(uuid, numeric) to authenticated, service_role;
