-- =============================================================================
-- 0049 — O follow-up espera a baixa da consulta
-- =============================================================================
--
-- A regra "quem já tem hora marcada não recebe" olhava só consulta FUTURA. Uma
-- consulta que acabou de passar, ainda sem baixa, deixava de contar — e a
-- pessoa voltava a ser "alguém que sumiu". Com o follow-up ligado:
--
--   · respondeu "ok" ao lembrete de 30 min, e 20 min depois do horário (ainda
--     sendo atendida) recebia o toque 1;
--   · marcou há dias, e logo depois do horário recebia o toque 2 — tendo vindo
--     ou não.
--
-- Agora qualquer consulta `agendada` segura o follow-up, inclusive a que
-- passou. Ele volta a valer quando a equipe dá a baixa:
--
--   · Compareceu → a pessoa vira cliente, e cliente não recebe follow-up;
--   · Faltou     → o follow-up retoma com a instrução de remarcar, sem cobrar
--                  a falta (`oQueAconteceuComOAgendamento`, no index.ts).
--
-- Consulta passada sem baixa já aparece no aviso âmbar de Contatos, Pacientes
-- e da conversa: é lá que a equipe resolve.
--
-- Só muda o trecho das consultas; o resto é a função da 0046, inteira.
-- =============================================================================

create or replace function public.followups_pendentes()
returns table (
  lead_id        uuid,
  whatsapp       text,
  nome           text,
  etapa          smallint,
  minutos_calado integer,
  ultima         boolean
)
language sql
stable
set search_path to 'public'
as $$
  with cfg as (
    select c.*,
           make_interval(mins  => c.followup_1_minutos) as t1,
           make_interval(hours => c.followup_2_horas)   as t2,
           make_interval(days  => c.followup_3_dias)    as t3,
           case when c.followup_3_ativo then 3 when c.followup_2_ativo then 2 when c.followup_1_ativo then 1 end as ultima_etapa
      from public.configuracoes_agente c limit 1
  ),
  clinica as (
    select coalesce(nullif(fuso_horario, ''), 'America/Sao_Paulo') as tz
    from public.configuracoes_clinica limit 1
  ),
  conversa as (
    select
      m.lead_id,
      max(m.criada_em) filter (where m.autor = 'paciente')      as ultima_do_lead,
      (array_agg(m.autor order by m.criada_em desc))[1]         as ultimo_autor
    from public.mensagens_whatsapp m
    group by m.lead_id
  ),
  -- O último agendamento de cada pessoa, para saber se ela cancelou.
  ultimo_agendamento as (
    select distinct on (c.lead_id) c.lead_id, c.status
    from public.consultas c
    order by c.lead_id, c.data_consulta desc
  ),
  candidatos as (
    select
      l.id                                                             as lead_id,
      l.whatsapp_lead                                                  as whatsapp,
      l.nome_lead                                                      as nome,
      c.ultima_do_lead,
      (extract(epoch from (now() - c.ultima_do_lead)) / 60)::integer   as minutos_calado,
      coalesce(ua.status, '')                                          as ultimo_status
    from public.crm_clinica_dados l
    join conversa c on c.lead_id = l.id
    left join ultimo_agendamento ua on ua.lead_id = l.id
    cross join cfg
    where cfg.ativo
      and cfg.followup_ativo
      and l.whatsapp_lead is not null
      and not l.agente_pausado
      and l.assumido_por is null
      and not l.nao_perturbe
      -- Cliente não recebe follow-up (ver a 0030).
      and l.status not in ('consulta_realizada', 'paciente_recorrente')
      and c.ultima_do_lead is not null
      -- A última palavra tem que ser da clínica.
      and c.ultimo_autor <> 'paciente'
      -- Quem tem hora marcada não recebe — inclusive a que JÁ PASSOU e ainda
      -- espera a baixa (ver o cabeçalho desta migração).
      and not exists (
        select 1 from public.consultas ag
        where ag.lead_id = l.id
          and ag.status = 'agendada'
      )
      and public.agente_deve_responder(l.whatsapp_lead)
  )
  -- ETAPA 1: do prazo curto até o da próxima etapa ligada. A qualquer hora.
  select c.lead_id, c.whatsapp, c.nome, 1::smallint, c.minutos_calado, cfg.ultima_etapa = 1
  from candidatos c cross join cfg
  where cfg.followup_1_ativo
    and c.ultima_do_lead <= now() - cfg.t1
    and (
      (cfg.followup_2_ativo and c.ultima_do_lead > now() - cfg.t2)
      or (not cfg.followup_2_ativo and cfg.followup_3_ativo and c.ultima_do_lead > now() - cfg.t3)
      or (not cfg.followup_2_ativo and not cfg.followup_3_ativo and c.ultima_do_lead > now() - cfg.t2)
    )
    -- Quem acabou de cancelar não recebe o toque curto (ver a 0030).
    and c.ultimo_status <> 'cancelada'
    and not exists (
      select 1 from public.agente_followups f
      where f.lead_id = c.lead_id and f.etapa = 1 and f.enviado_em > c.ultima_do_lead
    )

  union all

  -- ETAPA 2: do prazo em horas até o da etapa 3 (se ligada). Só na janela.
  select c.lead_id, c.whatsapp, c.nome, 2::smallint, c.minutos_calado, cfg.ultima_etapa = 2
  from candidatos c cross join cfg cross join clinica
  where cfg.followup_2_ativo
    and c.ultima_do_lead <= now() - cfg.t2
    and (not cfg.followup_3_ativo or c.ultima_do_lead > now() - cfg.t3)
    and not exists (
      select 1 from public.agente_followups f
      where f.lead_id = c.lead_id and f.etapa = 2 and f.enviado_em > c.ultima_do_lead
    )
    and ((now() at time zone clinica.tz)::time between cfg.followup_inicio and cfg.followup_fim)

  union all

  -- ETAPA 3: dias de silêncio. Só na janela.
  select c.lead_id, c.whatsapp, c.nome, 3::smallint, c.minutos_calado, cfg.ultima_etapa = 3
  from candidatos c cross join cfg cross join clinica
  where cfg.followup_3_ativo
    and c.ultima_do_lead <= now() - cfg.t3
    and not exists (
      select 1 from public.agente_followups f
      where f.lead_id = c.lead_id and f.etapa = 3 and f.enviado_em > c.ultima_do_lead
    )
    and ((now() at time zone clinica.tz)::time between cfg.followup_inicio and cfg.followup_fim)
$$;

comment on function public.followups_pendentes() is
  'Quem esta devendo follow-up, e de qual etapa (1, 2 ou 3). Toda a politica '
  'mora aqui; a Edge Function so executa.';

revoke execute on function public.followups_pendentes() from public, anon, authenticated;
grant execute on function public.followups_pendentes() to service_role;
