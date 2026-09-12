-- =============================================================================
-- 0030 — Follow-up: a agente volta a falar quando a conversa esfria
-- =============================================================================
--
-- Até aqui a agente era 100% reativa: a Edge Function só acorda quando a ponte
-- entrega um webhook, ou seja, **só quando alguém escreve**. Metade das
-- conversas morre no silêncio — a pessoa pergunta o preço, some, e ninguém
-- volta a falar com ela.
--
-- Follow-up é o contrário disso: falar quando ninguém escreveu. Isso exige um
-- relógio, e o relógio é o `pg_cron`, que roda dentro do próprio banco e chama
-- a função a cada minuto (ver `disparar_followups()` no fim deste arquivo).
--
-- ── AS DUAS ETAPAS ──────────────────────────────────────────────────────────
--
--   Etapa 1, aos 10 minutos — a conversa acabou de esfriar, a pessoa ainda
--   está no assunto. É um toque no ombro: "ainda está aí?".
--
--   Etapa 2, às 24 horas — a pessoa sumiu de verdade. É a última tentativa, e
--   depois dela ninguém mais escreve até ela responder.
--
-- ── QUEM CANCELOU PULA A ETAPA 1 ────────────────────────────────────────────
--
-- Cancelar não é dizer "não quero mais": a pessoa quis, escolheu dia e hora e
-- desmarcou, quase sempre porque o horário deixou de servir. É o lead mais
-- perto de voltar que existe — e por isso o toque dela não pode ser o de dez
-- minutos, que soaria como quem não aceitou o não. Ela cai na etapa 2, que com
-- a janela de horário chega no dia seguinte, e lá o texto convida a remarcar
-- (ver `oQueAconteceuComOAgendamento()` na Edge Function).
--
-- ── O RELÓGIO É A ÚLTIMA MENSAGEM DO LEAD, NUNCA A DA AGENTE ────────────────
--
-- Parece detalhe e é a decisão central deste arquivo. Se o prazo contasse da
-- última mensagem **de qualquer um**, o follow-up da etapa 1 reiniciaria o
-- próprio relógio: a agente falaria aos 10 minutos, e as 24 horas da etapa 2
-- passariam a contar dali — 24 horas e 10 minutos depois do silêncio real.
-- Pior: cada follow-up empurraria o seguinte, para sempre.
--
-- Contando do último `autor = 'paciente'`, as duas etapas medem a mesma coisa
-- (há quanto tempo a PESSOA está calada) e o ciclo **se rearma sozinho**: no
-- instante em que ela responde, `ultima_do_lead` anda para frente e os
-- follow-ups já enviados ficam para trás — prontos para valer de novo na
-- próxima vez que a conversa esfriar.
--
-- ── AS TRAVAS, QUE SÃO O QUE SEPARA FOLLOW-UP DE SPAM ───────────────────────
--
--   · A última palavra tem que ser da agente. Se o lead falou por último, ela
--     está DEVENDO resposta — mandar follow-up aí esconde um defeito atrás de
--     uma simpatia.
--   · Quem já tem hora marcada não recebe. Isso seria lembrete de consulta,
--     que é outra funcionalidade, com outro texto e outro momento.
--   · Conversa pausada ou assumida por gente (migração 0010) fica de fora: o
--     robô não entra por cima de quem está atendendo à mão.
--   · O modo teste vale igual ao do webhook — a mesma `agente_deve_responder()`.
--     Sem isso, o primeiro teste dispararia para todo mundo que já escreveu.
--   · A etapa 2 respeita uma janela de horário (padrão 9h às 20h30, todo dia).
--     A etapa 1 **não** respeita, de propósito: são 10 minutos dentro de uma
--     conversa viva, e quem escreveu 22h30 está acordado às 22h40.
--
-- ── O QUE ESTA MIGRAÇÃO NÃO FAZ ─────────────────────────────────────────────
--
-- Ela não agenda o cron. O `cron.schedule` precisa do endereço da SUA função,
-- que carrega o ref do seu projeto — e nada do projeto de ninguém entra em
-- arquivo versionado (mesma regra do `publicar.mjs`). Quem agenda é
-- `npm run followup:ligar`, que guarda endereço e segredo no Vault e cria o
-- job. Enquanto ele não roda, tudo aqui existe e fica parado.
-- =============================================================================


-- =============================================================================
-- 1. AS EXTENSÕES DO RELÓGIO
--
-- `pg_cron` dispara de minuto em minuto; `pg_net` faz o HTTP de dentro do
-- banco. As duas vêm com o Supabase, desligadas.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;


-- =============================================================================
-- 2. A CONFIGURAÇÃO — na tabela que já guarda o que é do agente
-- =============================================================================

alter table public.configuracoes_agente
  add column if not exists followup_ativo     boolean not null default true,
  add column if not exists followup_1_minutos integer not null default 10,
  add column if not exists followup_2_horas   integer not null default 24,
  add column if not exists followup_inicio    time    not null default '09:00',
  add column if not exists followup_fim       time    not null default '20:30';

alter table public.configuracoes_agente
  drop constraint if exists configuracoes_agente_followup_check;

alter table public.configuracoes_agente
  add constraint configuracoes_agente_followup_check check (
    followup_1_minutos between 1 and 1440
    and followup_2_horas between 1 and 720
    and followup_inicio < followup_fim
  );

comment on column public.configuracoes_agente.followup_ativo is
  'Chave geral do follow-up. Desligada, o cron continua rodando e nao acha '
  'ninguem — nada e enviado.';
comment on column public.configuracoes_agente.followup_1_minutos is
  'Minutos de silencio do LEAD ate a etapa 1. Ignora a janela de horario.';
comment on column public.configuracoes_agente.followup_2_horas is
  'Horas de silencio do LEAD ate a etapa 2, a ultima tentativa. So dentro da '
  'janela.';
comment on column public.configuracoes_agente.followup_inicio is
  'Abertura da janela do follow-up, no fuso da empresa. Vale so para a etapa 2.';
comment on column public.configuracoes_agente.followup_fim is
  'Fechamento da janela do follow-up, no fuso da empresa. Vale so para a etapa 2.';


-- =============================================================================
-- 3. O REGISTRO DO QUE JÁ FOI ENVIADO
--
-- É esta tabela que impede a mesma pessoa de receber o mesmo toque duas vezes.
-- Uma linha por follow-up enviado, com o texto — que é o que permite ler
-- depois se a mensagem ficou boa.
--
-- A linha é criada ANTES do envio, como reserva: o cron dispara a cada minuto
-- e a geração do texto leva segundos, então duas execuções poderiam pegar o
-- mesmo lead. Quem reserva primeiro envia; se o envio falhar, a reserva é
-- apagada e o lead volta para a fila.
-- =============================================================================

create table if not exists public.agente_followups (
  id         uuid        primary key default gen_random_uuid(),
  lead_id    uuid        not null references public.crm_clinica_dados(id) on delete cascade,
  etapa      smallint    not null check (etapa in (1, 2)),
  enviado_em timestamptz not null default now(),
  texto      text
);

-- A pergunta que a `followups_pendentes()` faz o tempo todo: "esta pessoa já
-- recebeu a etapa N depois da última mensagem dela?".
create index if not exists agente_followups_lead_idx
  on public.agente_followups (lead_id, etapa, enviado_em desc);

comment on table public.agente_followups is
  'Um follow-up enviado, por linha. A ausencia de linha mais nova que a ultima '
  'mensagem do lead e o que torna a etapa devida de novo.';

alter table public.agente_followups enable row level security;

-- A equipe LÊ (é o histórico do que o robô mandou), e não escreve: quem
-- escreve é a Edge Function, com a service_role, que passa por cima do RLS.
drop policy if exists "agente_followups_le" on public.agente_followups;
create policy "agente_followups_le" on public.agente_followups
  for select to authenticated using (true);


-- =============================================================================
-- 3.5. O "NÃO ME PROCURE MAIS"
--
-- As travas da `followups_pendentes()` são todas estruturais: tem hora marcada,
-- está pausada, já recebeu. Nenhuma é sobre o que a pessoa DISSE — e sem isso
-- quem escreve "não tenho mais interesse" recebe um follow-up dez minutos
-- depois. Insistir depois de um não explícito é o caminho mais curto para o
-- número ser denunciado.
--
-- Quem marca é a própria agente, pela ferramenta `nao_perturbe`: ela é quem
-- está lendo a conversa, e é a única capaz de separar "não quero mais nada" de
-- "não quero esse horário".
--
-- ⚠️ ISTO NÃO A CALA. Se a pessoa escrever de novo, a agente responde
-- normalmente — o que acaba é a PROCURA, não o atendimento. Quem cala é o
-- `agente_pausado`, que é outra coisa e tem outro botão.
-- =============================================================================

alter table public.crm_clinica_dados
  add column if not exists nao_perturbe        boolean not null default false,
  add column if not exists nao_perturbe_em     timestamptz,
  add column if not exists nao_perturbe_motivo text;

comment on column public.crm_clinica_dados.nao_perturbe is
  'A pessoa pediu para nao ser mais procurada. Tira ela do follow-up para '
  'sempre, e NAO impede a agente de responder se ela escrever de novo.';

-- A view precisa enxergar as colunas novas, senão a equipe nunca descobre por
-- que aquele lead parou de receber follow-up — e "some sem dizer o motivo" é o
-- defeito que este repositório mais persegue.
--
-- ⚠️ `create or replace view` e as colunas NOVAS NO FIM: mudar a ordem das que
-- já existem faz o comando falhar. E o `security_invoker` vai explícito — foi
-- perdê-lo, na 0022, que abriu a view para a chave pública até a 0028.
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
    valor_pago_acumulado,
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
    nao_perturbe_motivo
  from public.crm_clinica_dados d;

-- A 0028 tirou a `anon` daqui, e recriar a view devolveria o acesso padrão.
revoke all on public.crm_clinica from anon;


-- =============================================================================
-- 4. QUEM ESTÁ DEVENDO FOLLOW-UP
--
-- Toda a política mora aqui, e de propósito: a Edge Function não decide nada,
-- só executa o que esta função devolve. Mudar a regra é mudar SQL, num lugar
-- só, sem republicar função nenhuma.
--
-- `security invoker` (o padrão) de propósito: quem chama é a Edge Function com
-- a service_role, que já ignora o RLS. Fosse `definer`, ela entraria na lista
-- da seção 10 do DATABASE.md — funções que passam por cima do RLS — e teria
-- que ser revogada da chave pública para não virar porta aberta.
-- =============================================================================

create or replace function public.followups_pendentes()
returns table (
  lead_id        uuid,
  whatsapp       text,
  nome           text,
  etapa          smallint,
  minutos_calado integer
)
language sql
stable
set search_path to 'public'
as $$
  with cfg as (
    select * from public.configuracoes_agente limit 1
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
      -- Pediu para não ser mais procurada. Ver a seção 3.5.
      and not l.nao_perturbe
      -- CLIENTE NÃO RECEBE FOLLOW-UP. O follow-up existe para trazer de volta
      -- quem ainda não veio; quem já foi atendido e some não está sumindo de
      -- uma negociação, está apenas sem assunto. Perseguir cliente com "ainda
      -- está aí?" é o que faz uma empresa virar aquela que não larga o pé.
      and l.status not in ('consulta_realizada', 'paciente_recorrente')
      and c.ultima_do_lead is not null
      -- A última palavra tem que ser dela. Se o lead falou por último, ela está
      -- devendo resposta — e follow-up ali é constrangedor.
      and c.ultimo_autor <> 'paciente'
      -- Quem já tem hora marcada não recebe. Lembrete de consulta é outra coisa.
      and not exists (
        select 1 from public.consultas ag
        where ag.lead_id = l.id
          and ag.status = 'agendada'
          and ag.data_consulta > now()
      )
      -- A mesma trava do webhook: agente ligado, e o modo teste respeitado.
      and public.agente_deve_responder(l.whatsapp_lead)
  )
  -- Etapa 1: entre o prazo curto e o longo. O teto não é zelo — sem ele, quem
  -- está calado há três dias receberia a etapa 1 e a 2 no mesmo minuto.
  select c.lead_id, c.whatsapp, c.nome, 1::smallint, c.minutos_calado
  from candidatos c cross join cfg
  where c.ultima_do_lead <= now() - make_interval(mins  => cfg.followup_1_minutos)
    and c.ultima_do_lead >  now() - make_interval(hours => cfg.followup_2_horas)
    -- QUEM ACABOU DE CANCELAR NÃO RECEBE O TOQUE CURTO.
    --
    -- Dez minutos depois de desmarcar, um "quer remarcar?" soa como quem não
    -- aceitou o não — e é o contrário do que se quer com essa pessoa, que é
    -- justamente a mais perto de voltar. Ela cai na etapa 2, que com a janela
    -- de horário chega no dia seguinte, e o texto de lá convida a remarcar.
    and c.ultimo_status <> 'cancelada'
    and not exists (
      select 1 from public.agente_followups f
      where f.lead_id = c.lead_id and f.etapa = 1 and f.enviado_em > c.ultima_do_lead
    )

  union all

  -- Etapa 2: a última tentativa, e só dentro da janela.
  select c.lead_id, c.whatsapp, c.nome, 2::smallint, c.minutos_calado
  from candidatos c cross join cfg cross join clinica
  where c.ultima_do_lead <= now() - make_interval(hours => cfg.followup_2_horas)
    and not exists (
      select 1 from public.agente_followups f
      where f.lead_id = c.lead_id and f.etapa = 2 and f.enviado_em > c.ultima_do_lead
    )
    and ((now() at time zone clinica.tz)::time
         between cfg.followup_inicio and cfg.followup_fim)
$$;

comment on function public.followups_pendentes() is
  'Quem esta devendo follow-up, e de qual etapa. Toda a politica (travas, '
  'prazos e janela) mora aqui; a Edge Function so executa.';


-- =============================================================================
-- 5. O DISPARO — o que o cron chama a cada minuto
--
-- Endereço e segredo saem do Vault, e não deste arquivo: os dois são da
-- instalação, não do produto. Quem os grava é `npm run followup:ligar`.
--
-- ⚠️ `security definer` porque o Vault não é legível por qualquer papel — e por
-- isso ela é REVOGADA de `anon` e `authenticated` logo abaixo. Sem essa
-- revogação, a consulta de segurança da seção 10 do DATABASE.md passa a
-- devolver uma linha, que é exatamente o defeito que a migração 0028 fechou.
-- =============================================================================

create or replace function public.disparar_followups()
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_url     text;
  v_segredo text;
  v_pedido  bigint;
begin
  -- Nada a fazer? Não acorda a função. O cron bate de minuto em minuto, e a
  -- esmagadora maioria das batidas não tem ninguém na fila.
  if not exists (select 1 from public.followups_pendentes()) then
    return null;
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'followup_url';
  select decrypted_secret into v_segredo
  from vault.decrypted_secrets where name = 'followup_segredo';

  if v_url is null or v_segredo is null then
    raise warning 'follow-up: falta endereco ou segredo no Vault. Rode npm run followup:ligar.';
    return null;
  end if;

  select net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type',      'application/json',
                 'x-webhook-segredo', v_segredo
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 8000
  ) into v_pedido;

  return v_pedido;
end;
$$;

comment on function public.disparar_followups() is
  'Chamada pelo pg_cron a cada minuto: se houver fila, acorda a Edge Function. '
  'Endereco e segredo saem do Vault (npm run followup:ligar).';

-- A chave pública não chama nem uma nem outra. `followups_pendentes` expõe
-- telefone; `disparar_followups` faz a agente falar com gente de verdade.
--
-- ⚠️ `from public` NÃO É REDUNDANTE, e esquecê-lo foi o erro cometido na
-- primeira versão desta migração. Toda função nasce executável pelo papel
-- `public`, e `anon`/`authenticated` herdam dele: revogar só dos dois deixa a
-- porta aberta pela herança, e a consulta de segurança da seção 10 do
-- DATABASE.md volta a acusar `disparar_followups`. É a mesma sequência
-- revoke/grant da migração 0028, que já avisava disso no cabeçalho.
revoke execute on function public.followups_pendentes() from public, anon, authenticated;
revoke execute on function public.disparar_followups()  from public, anon, authenticated;

grant execute on function public.followups_pendentes() to service_role;
grant execute on function public.disparar_followups()  to service_role;


-- =============================================================================
-- CONFERÊNCIA
-- =============================================================================
--
--   -- A fila de agora (esperado: vazio num banco recém-instalado)
--   select * from public.followups_pendentes();
--
--   -- A configuração
--   select followup_ativo, followup_1_minutos, followup_2_horas,
--          followup_inicio, followup_fim
--   from public.configuracoes_agente;
--
--   -- O job do cron existe? (esperado: 1 linha, DEPOIS do followup:ligar)
--   select jobname, schedule, active from cron.job where jobname = 'followups';
--
--   -- As últimas batidas do cron
--   select status, return_message, start_time
--   from cron.job_run_details order by start_time desc limit 10;
