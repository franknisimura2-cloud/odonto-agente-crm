-- =============================================================================
-- 0036 — "Agendamentos por Profissional" conta como o cartão "Agendamentos"
-- =============================================================================
--
-- O cartão "Agendamentos", no topo do Dashboard, conta pela data em que o
-- agendamento foi MARCADO. O gráfico por profissional contava pela data da
-- CONSULTA — e o período dos filtros termina hoje. Resultado: tudo o que foi
-- marcado para os próximos dias ficava fora do gráfico. A tela mostrava
-- "2 agendamentos" no cartão e nenhum no gráfico logo abaixo.
--
-- Agora os dois contam pela marcação: o gráfico responde "quem recebeu os
-- agendamentos deste período". Cancelados ficam de fora — marcação desfeita
-- não é agendamento de ninguém.
--
-- A data de marcação é a `created_at` da consulta: é quando ela entrou na
-- agenda, pela equipe, pela Letícia ou pela API.
-- =============================================================================

create or replace function public.dashboard_profissionais(p_inicio timestamptz, p_fim timestamptz)
returns table (profissional_id uuid, nome text, cor text, consultas bigint)
language sql
stable
as $$
  with cont as (
    select c.profissional_id, count(*) as n
      from public.consultas c
     where c.created_at between p_inicio and p_fim
       and c.status <> 'cancelada'
     group by 1
  )
  select p.id,
         trim(p.nome || ' ' || coalesce(p.sobrenome, ''))
           || case when p.ativo then '' else ' (inativo)' end,
         p.cor,
         coalesce(cont.n, 0)::bigint
    from public.profissionais p
    left join cont on cont.profissional_id = p.id
   where p.ativo or cont.n is not null

  union all

  select null::uuid, 'Sem profissional', null::text, cont.n
    from cont
   where cont.profissional_id is null

  order by 4 desc, 2
$$;
