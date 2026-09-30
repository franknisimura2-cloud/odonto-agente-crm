-- =============================================================================
-- 0045 — O painel da roda: convênio → odontograma → plano → aprovação → retorno
-- =============================================================================
--
-- O Dashboard ganha a visão do modelo inteiro da clínica odontológica, no
-- período escolhido nos filtros da tela:
--
--   ENTRADA      pessoas novas, e quantas vieram pelo convênio
--   AVALIAÇÃO    pessoas que ganharam odontograma
--   PLANO        planos apresentados, e quanto de particular eles somam
--   APROVAÇÃO    planos aprovados (inteiro ou em parte), o particular
--                aprovado, o ticket médio — e quantos eram de paciente de
--                convênio que aprovou particular: a CONVERSÃO
--   RETORNO      a carteira com retorno previsto, quanto dela está em dia, e
--                os retornos realizados no período
--
-- E a mesma conta por convênio: qual traz paciente, e qual traz paciente que
-- vira particular.
--
-- Mesmo desenho das funções da 0024: SECURITY INVOKER — cada um vê a soma do
-- que o RLS deixa ver. Dinheiro só com `valores`: sem ela, os campos de valor
-- voltam nulos (e a tela não os desenha).
-- =============================================================================

create or replace function public.dashboard_roda(p_inicio timestamptz, p_fim timestamptz)
returns jsonb
language sql
stable
set search_path = public
as $$
  with
  valores as (select public.pode('valores') as pode),
  clinica as (
    select coalesce(nullif(fuso_horario, ''), 'America/Sao_Paulo') as tz from public.configuracoes_clinica limit 1
  ),
  novos as (
    select d.id, d.forma_pagamento
      from public.crm_clinica_dados d
     where coalesce(d.inicio_atendimento, d.created_at) between p_inicio and p_fim
  ),
  avaliados as (
    select distinct r.lead_id from public.odontograma_registros r
     where r.created_at between p_inicio and p_fim
  ),
  planos as (
    select p.id, p.status, p.desconto, l.forma_pagamento,
           coalesce((select sum(i.valor) from public.plano_itens i
                      where i.plano_id = p.id and i.cobertura = 'particular'), 0) as particular,
           coalesce((select sum(i.valor) from public.plano_itens i
                      where i.plano_id = p.id and i.cobertura = 'particular'
                        and i.status in ('aprovado', 'feito')), 0) as aprovado
      from public.planos_tratamento p
      join public.crm_clinica_dados l on l.id = p.lead_id
     where p.apresentado_em between p_inicio and p_fim
  ),
  sim as (
    select * from planos where status in ('parcial', 'aprovado', 'concluido')
  ),
  carteira as (
    select d.id, d.proximo_retorno,
           exists (select 1 from public.consultas c
                    where c.lead_id = d.id and c.status = 'agendada' and c.data_consulta > now()) as marcado
      from public.crm_clinica_dados d
     where d.proximo_retorno is not null
  )
  select jsonb_build_object(
    'entrada', (select count(*) from novos),
    'entrada_convenio', (select count(*) from novos where forma_pagamento = 'convenio'),
    'entrada_particular', (select count(*) from novos where forma_pagamento = 'particular'),
    'avaliados', (select count(*) from avaliados),
    'planos_apresentados', (select count(*) from planos),
    'planos_aprovados', (select count(*) from sim),
    'planos_convenio', (select count(*) from planos where forma_pagamento = 'convenio'),
    'convertidos', (select count(*) from sim where forma_pagamento = 'convenio' and aprovado > 0),
    'particular_apresentado', case when (select pode from valores)
      then (select coalesce(sum(greatest(particular - desconto, 0)), 0) from planos) end,
    'particular_aprovado', case when (select pode from valores)
      then (select coalesce(sum(aprovado), 0) from sim) end,
    'ticket_medio', case when (select pode from valores)
      then (select round(coalesce(sum(aprovado), 0) / nullif(count(*), 0), 2) from sim) end,
    'carteira_retorno', (select count(*) from carteira),
    'carteira_em_dia', (select count(*) from carteira, clinica
                         where marcado or proximo_retorno >= (now() at time zone clinica.tz)::date),
    'retornos_realizados', (
      select count(*) from public.consultas c
        join public.servicos_clinica s on lower(trim(s.nome)) = lower(trim(c.procedimento)) and s.retorno_meses is not null
       where c.status = 'realizada' and c.data_consulta between p_inicio and p_fim)
  )
$$;

comment on function public.dashboard_roda(timestamptz, timestamptz) is
  'A roda da clinica odontologica no periodo: entrada, avaliacao, plano, '
  'aprovacao (e a conversao convenio -> particular) e retorno. Valores so com '
  'a permissao valores.';

create or replace function public.dashboard_roda_convenios(p_inicio timestamptz, p_fim timestamptz)
returns table (
  convenio            text,
  pacientes           bigint,
  novos               bigint,
  planos_apresentados bigint,
  planos_aprovados    bigint,
  particular_aprovado numeric
)
language sql
stable
set search_path = public
as $$
  select
    coalesce(cv.nome, 'Particular') as convenio,
    count(distinct d.id),
    count(distinct d.id) filter (where coalesce(d.inicio_atendimento, d.created_at) between p_inicio and p_fim),
    count(distinct p.id) filter (where p.apresentado_em between p_inicio and p_fim),
    count(distinct p.id) filter (where p.apresentado_em between p_inicio and p_fim
                                   and p.status in ('parcial', 'aprovado', 'concluido')),
    case when public.pode('valores') then coalesce(sum(i.valor) filter (
      where p.apresentado_em between p_inicio and p_fim
        and i.cobertura = 'particular' and i.status in ('aprovado', 'feito')), 0) end
  from public.crm_clinica_dados d
  left join public.convenios cv on cv.id = d.convenio_id
  left join public.planos_tratamento p on p.lead_id = d.id
  left join public.plano_itens i on i.plano_id = p.id
  where d.forma_pagamento in ('convenio', 'particular')
  group by coalesce(cv.nome, 'Particular')
  order by 2 desc
$$;

comment on function public.dashboard_roda_convenios(timestamptz, timestamptz) is
  'A roda por convenio (e o particular): quem traz paciente, e quem traz '
  'paciente que aprova particular.';

revoke all on function public.dashboard_roda(timestamptz, timestamptz) from public, anon;
revoke all on function public.dashboard_roda_convenios(timestamptz, timestamptz) from public, anon;
grant execute on function public.dashboard_roda(timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.dashboard_roda_convenios(timestamptz, timestamptz) to authenticated, service_role;
