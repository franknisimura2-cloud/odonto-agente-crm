-- =============================================================================
-- 0037 — Lembretes de agendamento, com confirmação de presença
-- =============================================================================
--
-- A agente passa a avisar quem tem horário marcado:
--
--   VÉSPERA  — por padrão 24 h antes, dentro da janela de horário (a mesma do
--              follow-up: nada de mensagem de madrugada). Pede para a pessoa
--              responder SIM, e o SIM vira o selo "Confirmada" na Agenda.
--   ANTES    — por padrão 30 min antes. Sem janela: a consulta já está em
--              horário de atendimento.
--
-- O TEXTO É FIXO, montado pela função `whatsapp` — sem modelo de IA. Lembrete
-- não tem o que improvisar: data, hora, com quem, o quê. Um modelo aqui só
-- traria o risco de ele errar a hora de alguém. E não custa nada de OpenAI.
--
-- Mesma arquitetura do follow-up (0030): TODA a regra mora em
-- `lembretes_pendentes()`; o relógio (`pg_cron`) chama `disparar_lembretes()`
-- a cada minuto, que só acorda a função se houver fila. Quem liga o relógio é
-- `npm run lembretes:ligar`.
--
-- ── AS TRAVAS ───────────────────────────────────────────────────────────────
--
--   · Só consulta AGENDADA e futura. Cancelou, faltou, já foi: nada.
--   · Cada lembrete sai UMA vez por data. Remarcou? A data nova ganha os
--     lembretes dela — e a confirmação antiga cai (gatilho abaixo).
--   · Não lembra do que acabou de ser marcado: quem marcou há 10 min para
--     daqui a 20 não recebe o "30 min antes" — acabou de combinar.
--   · A véspera não sai quando já está perto demais (a menos de 1 h do
--     "antes"): aí só o "antes" vale, e a pessoa não recebe dois seguidos.
--   · Quem pediu para não ser procurado (`nao_perturbe`) não recebe.
--   · A mesma `agente_deve_responder()` do webhook: agente ligada e modo teste
--     respeitado — com ele ligado, só os números de teste recebem.
--
-- ── NASCE DESLIGADO ─────────────────────────────────────────────────────────
--
-- `lembretes_ativo` começa em FALSE. Uma instalação que recebe esta migração
-- com agendamentos futuros de gente de verdade não pode começar a mandar
-- mensagem no minuto seguinte. Quem liga é a empresa, na tela Atendente de IA.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. A configuração
-- -----------------------------------------------------------------------------

alter table public.configuracoes_agente
  add column if not exists lembretes_ativo            boolean not null default false,
  add column if not exists lembrete_vespera_ativo     boolean not null default true,
  add column if not exists lembrete_vespera_horas     integer not null default 24,
  add column if not exists lembrete_antes_ativo       boolean not null default true,
  add column if not exists lembrete_antes_minutos     integer not null default 30,
  add column if not exists lembrete_pedir_confirmacao boolean not null default true;

alter table public.configuracoes_agente drop constraint if exists configuracoes_agente_lembretes_check;
alter table public.configuracoes_agente add constraint configuracoes_agente_lembretes_check check (
  lembrete_vespera_horas between 2 and 72
  and lembrete_antes_minutos between 10 and 360
);


-- -----------------------------------------------------------------------------
-- 2. A confirmação, na própria consulta
-- -----------------------------------------------------------------------------

alter table public.consultas add column if not exists confirmada_em timestamptz;

comment on column public.consultas.confirmada_em is
  'Quando a pessoa confirmou presenca (respondeu SIM ao lembrete, ou a equipe '
  'marcou). Volta a nulo se a data da consulta mudar.';

-- A 0033 deu à equipe permissão POR COLUNA em `consultas`: coluna nova nasce
-- invisível. Esta precisa ser lida (o selo) e escrita (a recepção marca à mão).
grant select (confirmada_em), update (confirmada_em) on public.consultas to authenticated;

-- Remarcou: a confirmação era para o horário antigo, e não vale para o novo.
create or replace function public.consultas_limpa_confirmacao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.data_consulta is distinct from old.data_consulta then
    new.confirmada_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists consultas_limpa_confirmacao on public.consultas;
create trigger consultas_limpa_confirmacao
  before update of data_consulta on public.consultas
  for each row execute function public.consultas_limpa_confirmacao();


-- -----------------------------------------------------------------------------
-- 3. O registro do que já foi enviado
-- -----------------------------------------------------------------------------
--
-- Uma linha por lembrete. `para_data` é a data da consulta NO MOMENTO do
-- envio: remarcou, a data nova não tem linha, e os lembretes dela saem. O
-- `unique` é a reserva — a função grava ANTES de mandar, e duas batidas do
-- relógio não mandam o mesmo lembrete duas vezes (mesmo desenho da 0030).

create table if not exists public.agente_lembretes (
  id                uuid        primary key default gen_random_uuid(),
  consulta_id       uuid        not null references public.consultas(id) on delete cascade,
  etapa             text        not null check (etapa in ('vespera', 'antes')),
  para_data         timestamptz not null,
  pediu_confirmacao boolean     not null default false,
  enviado_em        timestamptz not null default now(),
  texto             text,
  unique (consulta_id, etapa, para_data)
);

alter table public.agente_lembretes enable row level security;

-- A equipe que atende lê (é o que foi dito à pessoa); quem escreve é a função,
-- com a chave de serviço.
drop policy if exists "agente_lembretes_le" on public.agente_lembretes;
create policy "agente_lembretes_le" on public.agente_lembretes
  for select to authenticated
  using ((select public.pode('conversas')) or (select public.pode('agenda_todas')) or (select public.pode('pessoas')));


-- -----------------------------------------------------------------------------
-- 4. Quem está devendo lembrete
-- -----------------------------------------------------------------------------

create or replace function public.lembretes_pendentes()
returns table (
  consulta_id       uuid,
  lead_id           uuid,
  whatsapp          text,
  nome              text,
  etapa             text,
  data_consulta     timestamptz,
  procedimento      text,
  profissional      text,
  pedir_confirmacao boolean
)
language sql
stable
set search_path = public
as $$
  with cfg as (
    select * from public.configuracoes_agente limit 1
  ),
  clinica as (
    select coalesce(nullif(fuso_horario, ''), 'America/Sao_Paulo') as tz
    from public.configuracoes_clinica limit 1
  ),
  candidatas as (
    select c.id, c.lead_id, l.whatsapp_lead, l.nome_lead, c.data_consulta, c.created_at,
           c.procedimento, c.confirmada_em,
           nullif(trim(coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')), '') as profissional
      from public.consultas c
      join public.crm_clinica_dados l on l.id = c.lead_id
      left join public.profissionais p on p.id = c.profissional_id
      cross join cfg
     where cfg.lembretes_ativo
       and c.status = 'agendada'
       and c.data_consulta > now()
       and l.whatsapp_lead is not null
       and not l.nao_perturbe
       and public.agente_deve_responder(l.whatsapp_lead)
  )
  -- VÉSPERA
  select k.id, k.lead_id, k.whatsapp_lead, k.nome_lead, 'vespera', k.data_consulta,
         k.procedimento, k.profissional,
         cfg.lembrete_pedir_confirmacao and k.confirmada_em is null
    from candidatas k cross join cfg cross join clinica
   where cfg.lembrete_vespera_ativo
     and now() >= k.data_consulta - make_interval(hours => cfg.lembrete_vespera_horas)
     and k.created_at <= k.data_consulta - make_interval(hours => cfg.lembrete_vespera_horas)
     -- Perto demais: só o "antes" vale (ou nenhum, se ele estiver desligado).
     and now() < k.data_consulta - make_interval(mins => cfg.lembrete_antes_minutos + 60)
     and (now() at time zone clinica.tz)::time between cfg.followup_inicio and cfg.followup_fim
     and not exists (
       select 1 from public.agente_lembretes x
        where x.consulta_id = k.id and x.etapa = 'vespera' and x.para_data = k.data_consulta
     )

  union all

  -- ANTES
  select k.id, k.lead_id, k.whatsapp_lead, k.nome_lead, 'antes', k.data_consulta,
         k.procedimento, k.profissional, false
    from candidatas k cross join cfg
   where cfg.lembrete_antes_ativo
     and now() >= k.data_consulta - make_interval(mins => cfg.lembrete_antes_minutos)
     and k.created_at <= k.data_consulta - make_interval(mins => cfg.lembrete_antes_minutos)
     and not exists (
       select 1 from public.agente_lembretes x
        where x.consulta_id = k.id and x.etapa = 'antes' and x.para_data = k.data_consulta
     )
$$;

comment on function public.lembretes_pendentes() is
  'Quem esta devendo lembrete, e qual. Toda a politica mora aqui; a Edge '
  'Function so executa.';


-- -----------------------------------------------------------------------------
-- 5. A confirmação: a resposta SIM chega pelo webhook
-- -----------------------------------------------------------------------------
--
-- A função `whatsapp` reconhece o "sim" e chama esta: ela acha a consulta que
-- está esperando confirmação (a véspera pediu, ainda não confirmou, ainda não
-- aconteceu), marca, e devolve o que confirmou — para a resposta citar o dia.
-- Nenhuma esperando? Volta vazio, e a mensagem segue para a agente como
-- qualquer outra.

create or replace function public.confirmar_presenca(p_lead uuid)
returns table (consulta_id uuid, data_consulta timestamptz, procedimento text)
language sql
set search_path = public
as $$
  with alvo as (
    select c.id
      from public.consultas c
     where c.lead_id = p_lead
       and c.status = 'agendada'
       and c.data_consulta > now()
       and c.confirmada_em is null
       and exists (
         select 1 from public.agente_lembretes x
          where x.consulta_id = c.id and x.etapa = 'vespera'
            and x.pediu_confirmacao and x.para_data = c.data_consulta
       )
     order by c.data_consulta
     limit 1
  )
  update public.consultas c
     set confirmada_em = now()
    from alvo
   where c.id = alvo.id
  returning c.id, c.data_consulta, c.procedimento
$$;


-- -----------------------------------------------------------------------------
-- 6. O disparo — o que o relógio chama a cada minuto
-- -----------------------------------------------------------------------------
--
-- Igual à `disparar_followups()` (0030): endereço e segredo no Vault, gravados
-- por `npm run lembretes:ligar`. O segredo é o mesmo do follow-up
-- (`followup_segredo`, o WEBHOOK_SEGREDO) — um segredo só por instalação.

create or replace function public.disparar_lembretes()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url     text;
  v_segredo text;
  v_pedido  bigint;
begin
  if not exists (select 1 from public.lembretes_pendentes()) then
    return null;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'lembretes_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'followup_segredo';

  if v_url is null or v_segredo is null then
    raise warning 'lembretes: falta endereco ou segredo no Vault. Rode npm run lembretes:ligar.';
    return null;
  end if;

  select net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-segredo', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 8000
  ) into v_pedido;

  return v_pedido;
end;
$$;

-- Nenhuma das três é da equipe nem da chave pública: expõem telefone, mudam
-- consulta ou fazem a agente falar. Só a chave de serviço (a função).
revoke execute on function public.lembretes_pendentes()       from public, anon, authenticated;
revoke execute on function public.confirmar_presenca(uuid)    from public, anon, authenticated;
revoke execute on function public.disparar_lembretes()        from public, anon, authenticated;
grant execute on function public.lembretes_pendentes()    to service_role;
grant execute on function public.confirmar_presenca(uuid) to service_role;
grant execute on function public.disparar_lembretes()     to service_role;
