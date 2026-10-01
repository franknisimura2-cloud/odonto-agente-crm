-- =============================================================================
-- 0047 — A passagem para uma pessoa
-- =============================================================================
--
-- Até aqui, "deixa eu chamar uma colega" era só uma frase: a Letícia dizia,
-- e o sistema não marcava nada, não avisava ninguém e ela continuava
-- respondendo. Agora a passagem é um ato:
--
--   · a ferramenta `passar_para_pessoa` PAUSA a Letícia naquela conversa e
--     grava quando e por quê (`passagem_em`, `passagem_motivo`);
--   · a tela Conversas mostra quem está esperando a equipe, com o motivo;
--   · quem estiver na lista `passagem_avisar` recebe um aviso no WhatsApp.
--
-- A marca se apaga sozinha (gatilho abaixo) quando alguém ASSUME a conversa
-- ou a DEVOLVE para a Letícia — não há "resolver" para alguém esquecer.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Na pessoa
-- -----------------------------------------------------------------------------

alter table public.crm_clinica_dados
  add column if not exists passagem_em     timestamptz,
  add column if not exists passagem_motivo text;

comment on column public.crm_clinica_dados.passagem_em is
  'Quando a atendente passou a conversa para a equipe. Nulo = ninguem esperando. '
  'Apaga sozinho quando alguem assume ou devolve a conversa.';

-- Permissão por coluna desde a 0031: coluna nova nasce invisível.
grant select (passagem_em, passagem_motivo), update (passagem_em, passagem_motivo)
   on public.crm_clinica_dados to authenticated;

create or replace function public.leads_limpa_passagem()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.passagem_em is not null and (
       (new.assumido_por is not null and old.assumido_por is null)   -- alguém assumiu
    or (old.agente_pausado and not new.agente_pausado)               -- devolveram para a atendente
  ) then
    new.passagem_em := null;
    new.passagem_motivo := null;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_limpa_passagem on public.crm_clinica_dados;
create trigger leads_limpa_passagem
  before update of assumido_por, agente_pausado on public.crm_clinica_dados
  for each row execute function public.leads_limpa_passagem();


-- -----------------------------------------------------------------------------
-- 2. Quem avisar no WhatsApp
-- -----------------------------------------------------------------------------

alter table public.configuracoes_agente
  add column if not exists passagem_avisar text[] not null default '{}';

comment on column public.configuracoes_agente.passagem_avisar is
  'Numeros da equipe (formato canonico, so digitos com DDI) que recebem aviso '
  'no WhatsApp quando a atendente passa uma conversa. Vazio = so a tela.';


-- -----------------------------------------------------------------------------
-- 3. A lista de conversas — a da 0014, com as duas colunas no fim
-- -----------------------------------------------------------------------------

create or replace view public.conversas_lista
with (security_invoker = true)
as
  select
    d.id                          as lead_id,
    d.nome_lead,
    d.whatsapp_lead,
    d.status,
    d.agente_pausado,
    d.assumido_por,
    d.assumido_em,
    u.nome                        as assumido_por_nome,
    ultima.conteudo               as ultimo_conteudo,
    ultima.tipo                   as ultimo_tipo,
    ultima.autor                  as ultimo_autor,
    ultima.criada_em              as ultima_em,
    coalesce(pendentes.total, 0)  as nao_lidas,
    d.data_agendamento,
    d.passagem_em,
    d.passagem_motivo
  from public.crm_clinica_dados d
  join lateral (
    select m.conteudo, m.tipo, m.autor, m.criada_em
      from public.mensagens_whatsapp m
     where m.lead_id = d.id
     order by m.criada_em desc
     limit 1
  ) ultima on true
  left join lateral (
    select count(*) as total
      from public.mensagens_whatsapp m
     where m.lead_id = d.id
       and m.autor = 'paciente'
       and not m.lida
  ) pendentes on true
  left join public.usuarios u on u.id = d.assumido_por;

revoke all on public.conversas_lista from anon;


-- -----------------------------------------------------------------------------
-- 4. A visão da ficha — a da 0043, com as duas colunas no fim
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
    retorno_servico,
    passagem_em,
    passagem_motivo
  from public.crm_clinica_dados d;

revoke all on public.crm_clinica from anon;

