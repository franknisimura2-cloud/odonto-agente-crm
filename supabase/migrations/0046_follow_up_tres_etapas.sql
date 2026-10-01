-- =============================================================================
-- 0046 — Follow-up em três etapas, configurado na tela
-- =============================================================================
--
-- O Kanban sempre teve três colunas de follow-up (Follow-up 1, 2 e 3), e a
-- agente só fazia duas etapas, ligadas por comando. Agora:
--
--   ETAPA 1   minutos de silêncio (padrão 10) — a qualquer hora
--   ETAPA 2   horas de silêncio (padrão 24)   — só na janela de horário
--   ETAPA 3   dias de silêncio (padrão 3)     — só na janela; NOVA
--
-- Cada etapa liga e desliga sozinha, e a última etapa ligada é a última
-- tentativa (a instrução da agente muda). O card anda para a coluna da etapa
-- enviada.
--
-- ── NASCE DESLIGADO, COMO OS LEMBRETES ──────────────────────────────────────
--
-- Até aqui `followup_ativo` nascia TRUE e quem ligava de verdade era o
-- relógio (`npm run followup:ligar`). Com a chave na tela, ela passa a ser a
-- decisão — e começa desligada, para ninguém receber mensagem no minuto em
-- que o relógio for agendado. (Nenhuma instalação tinha o relógio ligado.)
--
-- ── UMA ETAPA NÃO ATROPELA A OUTRA ──────────────────────────────────────────
--
-- Cada etapa vale do SEU prazo até o prazo da PRÓXIMA etapa ligada. Sem esse
-- teto, quem está calado há cinco dias receberia as etapas 1, 2 e 3 no mesmo
-- minuto. Os prazos precisam crescer (etapa 1 < etapa 2 < etapa 3) — o banco
-- confere.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. A configuração
-- -----------------------------------------------------------------------------

alter table public.configuracoes_agente
  add column if not exists followup_1_ativo boolean not null default true,
  add column if not exists followup_2_ativo boolean not null default true,
  add column if not exists followup_3_ativo boolean not null default false,
  add column if not exists followup_3_dias  integer not null default 3;

alter table public.configuracoes_agente alter column followup_ativo set default false;
update public.configuracoes_agente set followup_ativo = false;

alter table public.configuracoes_agente drop constraint if exists configuracoes_agente_followup_check;
alter table public.configuracoes_agente add constraint configuracoes_agente_followup_check check (
  followup_1_minutos between 1 and 1440
  and followup_2_horas between 1 and 720
  and followup_3_dias between 1 and 60
  and followup_inicio < followup_fim
  -- Os prazos crescem: 10 min < 24 h < 3 dias.
  and followup_1_minutos < followup_2_horas * 60
  and followup_2_horas < followup_3_dias * 24
);

comment on column public.configuracoes_agente.followup_ativo is
  'Chave geral do follow-up, ligada na tela Atendente de IA. Nasce desligada.';
comment on column public.configuracoes_agente.followup_3_dias is
  'Dias de silencio do LEAD ate a etapa 3. So dentro da janela.';


-- -----------------------------------------------------------------------------
-- 2. O registro aceita a etapa 3
-- -----------------------------------------------------------------------------

alter table public.agente_followups drop constraint if exists agente_followups_etapa_check;
alter table public.agente_followups add constraint agente_followups_etapa_check check (etapa in (1, 2, 3));


-- -----------------------------------------------------------------------------
-- 3. A fila — a da 0030, com as três etapas e o teto de cada uma
-- -----------------------------------------------------------------------------
--
-- O retorno ganha `ultima`: esta é a última etapa ligada? É o que decide o tom
-- da mensagem (a última deixa a porta aberta, sem insistir). Mudar as colunas
-- de retorno exige recriar a função.

drop function if exists public.followups_pendentes();

create function public.followups_pendentes()
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
      -- Quem já tem hora marcada não recebe.
      and not exists (
        select 1 from public.consultas ag
        where ag.lead_id = l.id
          and ag.status = 'agendada'
          and ag.data_consulta > now()
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
