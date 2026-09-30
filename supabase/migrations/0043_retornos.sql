-- =============================================================================
-- 0043 — Retorno periódico (a limpeza semestral): a roda que mantém a clínica
-- =============================================================================
--
-- A fidelização da clínica odontológica: quem fez a limpeza volta em seis
-- meses. Esta migração dá ao sistema a memória disso e à Letícia o motivo de
-- chamar:
--
--   servicos_clinica.retorno_meses     o serviço que gera retorno, e em quanto
--                                      tempo (a limpeza, 6; nulo = não gera)
--   crm_clinica_dados.proximo_retorno  a data em que a pessoa deve voltar,
--                    .retorno_servico  e para quê
--
-- ── A DATA SE CALCULA SOZINHA ───────────────────────────────────────────────
--
-- Consulta de um serviço com retorno recebe baixa "compareceu" (ou é
-- lançada já realizada): próximo retorno = data da consulta + N meses — se
-- for mais tarde que o que já estava marcado. A equipe pode corrigir à mão na
-- ficha. As consultas já realizadas antes desta migração também contam (o
-- preenchimento do fim do arquivo).
--
-- ── A LETÍCIA CHAMA ─────────────────────────────────────────────────────────
--
-- Mesmo desenho do follow-up, dos lembretes e da retomada de planos: a regra
-- em `retornos_pendentes()`, o relógio (`npm run retornos:ligar`) chama
-- `disparar_retornos()`, que acorda a rota /retornos. As travas:
--
--   · a partir de N dias ANTES da data (padrão 7) — e até N toques (padrão 2),
--     com o intervalo configurado entre eles (padrão 7 dias);
--   · quem já tem QUALQUER consulta agendada no futuro não é chamado — já
--     está voltando;
--   · quem falou com a clínica nas últimas 24 h não é chamado — está
--     conversando;
--   · janela de horário, pausa, assumida, `nao_perturbe`, agente desligada e
--     modo teste, como no resto.
--
-- Cada chamada vale para UMA data de retorno (`para_data`): a pessoa voltou e
-- a data andou, os toques recomeçam para a data nova.
--
-- ── NASCE DESLIGADO ─────────────────────────────────────────────────────────
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. O serviço que gera retorno, e a data na pessoa
-- -----------------------------------------------------------------------------

alter table public.servicos_clinica
  add column if not exists retorno_meses smallint check (retorno_meses is null or retorno_meses between 1 and 24);

comment on column public.servicos_clinica.retorno_meses is
  'Em quantos meses quem fez este servico deve voltar (a limpeza: 6). Nulo = nao gera retorno.';

alter table public.crm_clinica_dados
  add column if not exists proximo_retorno date,
  add column if not exists retorno_servico text;

grant select (proximo_retorno, retorno_servico), update (proximo_retorno, retorno_servico)
   on public.crm_clinica_dados to authenticated;

create index if not exists crm_clinica_dados_retorno_idx
  on public.crm_clinica_dados (proximo_retorno) where proximo_retorno is not null;


-- -----------------------------------------------------------------------------
-- 2. A data se calcula sozinha
-- -----------------------------------------------------------------------------
--
-- SECURITY DEFINER: quem dá baixa (agenda) pode não ter permissão de mexer
-- na ficha (pessoas). Sem isso, a data não andaria justo quando a recepção
-- marca "compareceu".

create or replace function public.consultas_marca_retorno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meses smallint;
  v_tz    text;
  v_data  date;
begin
  if new.status <> 'realizada' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'realizada' then return new; end if;

  select s.retorno_meses into v_meses
    from public.servicos_clinica s
   where lower(trim(s.nome)) = lower(trim(new.procedimento)) and s.retorno_meses is not null
   limit 1;
  if v_meses is null then return new; end if;

  select coalesce(nullif(fuso_horario, ''), 'America/Sao_Paulo') into v_tz from public.configuracoes_clinica limit 1;
  v_data := ((new.data_consulta at time zone coalesce(v_tz, 'America/Sao_Paulo'))::date
             + make_interval(months => v_meses))::date;

  update public.crm_clinica_dados
     set proximo_retorno = v_data,
         retorno_servico = new.procedimento
   where id = new.lead_id
     and (proximo_retorno is null or proximo_retorno < v_data);
  return new;
end;
$$;

drop trigger if exists consultas_marca_retorno on public.consultas;
create trigger consultas_marca_retorno
  after insert or update of status on public.consultas
  for each row execute function public.consultas_marca_retorno();


-- -----------------------------------------------------------------------------
-- 3. A visão que a tela e a Letícia leem — a da 0038, com duas colunas no fim
-- -----------------------------------------------------------------------------

create or replace view public.crm_clinica with (security_invoker = true) as
  select
    id,
    nome_lead,
    whatsapp_lead,
    procedimentos_interesse,
    nullif(array_to_string(procedimentos_interesse, ', '), '') as procedimento_interesse,
    data_nascimento,
    anotacoes,
    resumo_conversa,
    inicio_atendimento,
    ultima_mensagem,
    status,
    follow_up_1,
    follow_up_2,
    follow_up_3,
    data_agendamento,
    data_marcacao_agendamento,
    id_agendamento,
    id_conta_chatwoot,
    id_conversa_chatwoot,
    id_lead_chatwoot,
    inbox_id_chatwoot,
    public.valor_pago_visivel(d.id)::numeric(10,2) as valor_pago_acumulado,
    created_at,
    agente_pausado,
    assumido_por,
    assumido_em,
    case
      when ultima_mensagem is null then null::integer
      else floor(extract(epoch from now() - ultima_mensagem) / 60)::integer
    end as minutos_ultima_mensagem,
    (select max(c.data_consulta) from public.consultas c
      where c.lead_id = d.id and c.status = 'realizada') as ultima_consulta,
    nao_perturbe,
    nao_perturbe_em,
    nao_perturbe_motivo,
    forma_pagamento,
    convenio_id,
    convenio_carteirinha,
    convenio_validade,
    (select cv.nome from public.convenios cv where cv.id = d.convenio_id) as convenio_nome,
    proximo_retorno,
    retorno_servico
  from public.crm_clinica_dados d;

revoke all on public.crm_clinica from anon;


-- -----------------------------------------------------------------------------
-- 4. A configuração e o registro das chamadas
-- -----------------------------------------------------------------------------

alter table public.configuracoes_agente
  add column if not exists retornos_ativo          boolean  not null default false,
  add column if not exists retornos_antecedencia   integer  not null default 7,
  add column if not exists retornos_intervalo_dias integer  not null default 7,
  add column if not exists retornos_toques         smallint not null default 2;

alter table public.configuracoes_agente drop constraint if exists configuracoes_agente_retornos_check;
alter table public.configuracoes_agente add constraint configuracoes_agente_retornos_check check (
  retornos_antecedencia between 0 and 60
  and retornos_intervalo_dias between 1 and 60
  and retornos_toques between 1 and 3
);

create table if not exists public.agente_retornos (
  id         uuid        primary key default gen_random_uuid(),
  lead_id    uuid        not null references public.crm_clinica_dados(id) on delete cascade,
  para_data  date        not null,
  toque      smallint    not null check (toque between 1 and 3),
  enviado_em timestamptz not null default now(),
  texto      text,
  unique (lead_id, para_data, toque)
);

alter table public.agente_retornos enable row level security;

drop policy if exists "agente_retornos_le" on public.agente_retornos;
create policy "agente_retornos_le" on public.agente_retornos
  for select to authenticated
  using ((select public.pode('pessoas')) or (select public.pode('conversas')));

revoke all on public.agente_retornos from anon;


-- -----------------------------------------------------------------------------
-- 5. A fila
-- -----------------------------------------------------------------------------

create or replace function public.retornos_pendentes()
returns table (
  lead_id    uuid,
  whatsapp   text,
  nome       text,
  para_data  date,
  servico    text,
  toque      smallint
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
  base as (
    select l.id, l.whatsapp_lead, l.nome_lead, l.proximo_retorno, l.retorno_servico,
           (select count(*) from public.agente_retornos r
             where r.lead_id = l.id and r.para_data = l.proximo_retorno) as enviados,
           (select max(r.enviado_em) from public.agente_retornos r
             where r.lead_id = l.id and r.para_data = l.proximo_retorno) as ultimo_em
      from public.crm_clinica_dados l
      cross join cfg cross join clinica
     where cfg.ativo
       and cfg.retornos_ativo
       and l.proximo_retorno is not null
       and (now() at time zone clinica.tz)::date >= l.proximo_retorno - cfg.retornos_antecedencia
       and l.whatsapp_lead is not null
       and not l.nao_perturbe
       and not l.agente_pausado
       and l.assumido_por is null
       -- Já tem hora marcada: já está voltando.
       and not exists (
         select 1 from public.consultas c
          where c.lead_id = l.id and c.status = 'agendada' and c.data_consulta > now()
       )
       -- Falou com a clínica há pouco: está conversando.
       and not exists (
         select 1 from public.mensagens_whatsapp m
          where m.lead_id = l.id and m.autor = 'paciente' and m.criada_em > now() - interval '24 hours'
       )
       and public.agente_deve_responder(l.whatsapp_lead)
  )
  select b.id, b.whatsapp_lead, b.nome_lead, b.proximo_retorno, b.retorno_servico, (b.enviados + 1)::smallint
    from base b
    cross join cfg cross join clinica
   where b.enviados < cfg.retornos_toques
     and (b.ultimo_em is null or now() >= b.ultimo_em + make_interval(days => cfg.retornos_intervalo_dias))
     and (now() at time zone clinica.tz)::time between cfg.followup_inicio and cfg.followup_fim
$$;

comment on function public.retornos_pendentes() is
  'Quem a agente deve chamar agora para o retorno (a limpeza semestral). Toda '
  'a politica mora aqui; a Edge Function so executa.';


-- -----------------------------------------------------------------------------
-- 6. O disparo
-- -----------------------------------------------------------------------------

create or replace function public.disparar_retornos()
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
  if not exists (select 1 from public.retornos_pendentes()) then
    return null;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'retornos_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'followup_segredo';

  if v_url is null or v_segredo is null then
    raise warning 'retornos: falta endereco ou segredo no Vault. Rode npm run retornos:ligar.';
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

revoke execute on function public.retornos_pendentes() from public, anon, authenticated;
revoke execute on function public.disparar_retornos()  from public, anon, authenticated;
grant execute on function public.retornos_pendentes() to service_role;
grant execute on function public.disparar_retornos()  to service_role;


-- -----------------------------------------------------------------------------
-- 7. O que já aconteceu antes desta migração
-- -----------------------------------------------------------------------------
--
-- Só serve quando algum serviço já tem `retorno_meses` (numa instalação
-- nova, nenhum tem: o kit é que marca a limpeza). O kit repete esta conta
-- depois de marcar.

update public.crm_clinica_dados l
   set proximo_retorno = x.data, retorno_servico = x.procedimento
  from (
    select distinct on (c.lead_id) c.lead_id, c.procedimento,
           ((c.data_consulta at time zone coalesce(
               (select nullif(fuso_horario, '') from public.configuracoes_clinica limit 1), 'America/Sao_Paulo'))::date
             + make_interval(months => s.retorno_meses))::date as data
      from public.consultas c
      join public.servicos_clinica s on lower(trim(s.nome)) = lower(trim(c.procedimento)) and s.retorno_meses is not null
     where c.status = 'realizada'
     order by c.lead_id, c.data_consulta desc
  ) x
 where l.id = x.lead_id and (l.proximo_retorno is null or l.proximo_retorno < x.data);
