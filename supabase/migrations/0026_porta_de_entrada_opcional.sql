-- =============================================================================
-- 0026 — A porta de entrada vira opcional
-- =============================================================================
--
-- A 0018 fez da avaliação a porta por onde quase todo tratamento passa. Numa
-- clínica odontológica é assim mesmo: o dentista examina antes de alguém
-- marcar lentes. Mas numa barbearia ninguém faz "avaliação" antes do corte, e
-- num estúdio de tatuagem a primeira conversa é um orçamento. A porta tem que
-- ser uma escolha da empresa — e "nenhuma" tem que ser uma resposta normal, não
-- um estado de erro.
--
-- A função `agenda_marcar` já estava pronta para isso desde a 0018: sem porta
-- cadastrada, ela marca o serviço direto ("recusar deixaria o paciente sem
-- saída"). Faltavam duas coisas, e são as duas desta migração.
--
-- ── 1. A LISTA QUE A ATENDENTE LÊ DIZIA "MARQUE A AVALIAÇÃO" SEM AVALIAÇÃO ──
--
-- A view `procedimentos_clinica_agente` escrevia "Antes deste, marque a
-- avaliação." em todo serviço com `exige_avaliacao` — mesmo quando nenhuma
-- porta existia (o `coalesce` caía no texto fixo "a avaliação"). A atendente
-- prometia uma consulta que não dava para marcar, e a função marcava outra
-- coisa. Agora a frase só aparece quando há uma porta ativa para apontar; sem
-- ela, o serviço é descrito como o que ele é — agendado direto, com o valor
-- quando houver.
--
-- ── 2. `exige_avaliacao` NASCE DESLIGADO ──────────────────────────────────────
--
-- O padrão da coluna era `true`: todo serviço novo nascia "passa pela
-- avaliação". Numa empresa sem porta isso é um valor adormecido esperando para
-- valer no dia em que alguém criar uma. A tela passa a gravar o valor sempre
-- (ligado quando existe porta, desligado quando não), e o padrão do banco —
-- que só vale para quem insere por fora dela — vira o neutro.
--
-- ── E "GRATUITA." VIROU "SEM CUSTO." ─────────────────────────────────────────
--
-- O adjetivo concordava com "avaliação". O nome da porta é dado ("Orçamento",
-- "Consulta inicial", "Teste de mecha"), e um serviço qualquer com preço zero
-- também recebe a frase — "Corte infantil: ... Gratuita." não se lê. "Sem
-- custo" não tem gênero. É contrato com o prompt, que foi mudado junto
-- (agente-ia/prompt.md, seção dos serviços e a do preço).
-- =============================================================================


alter table public.servicos_clinica
  alter column exige_avaliacao set default false;

comment on column public.servicos_clinica.exige_avaliacao is
  'Marcado E existindo uma porta de entrada (e_avaliacao) ativa: o agente NAO '
  'agenda este servico -- agenda a porta e guarda este nome em '
  'consultas.interesse. Sem porta, a marcacao fica guardada e nao vale. Quem '
  'confere e agenda_marcar, nao o prompt.';

comment on column public.servicos_clinica.preco_a_partir_de is
  'Piso do valor, em reais. null = o agente nao fala preco. 0 = "Sem custo". '
  '> 0 = "a partir de R$ X". Ignorado quando o servico passa pela porta de '
  'entrada -- por isso o campo some do modal na tela.';


-- =============================================================================
-- A VIEW, SABENDO QUE A PORTA PODE NÃO EXISTIR
--
-- Mesma regra da 0018 — a ordem do `case` continua sendo a regra de negócio:
-- passar pela porta vence o preço. A diferença é que "passar pela porta" agora
-- exige uma porta: sem ela, o preço (se houver) volta a ser dito.
--
-- `a.id <> s.id` impede a própria porta de mandar marcar a si mesma, caso
-- alguém ligue as duas colunas na mesma linha por fora da tela.
-- =============================================================================

create or replace view public.procedimentos_clinica_agente
with (security_invoker = true) as
select
  s.nome
  || coalesce(': ' || nullif(trim(s.descricao), ''), '')
  || case
       when s.exige_avaliacao and porta.nome is not null then
         '. Antes deste, marque ' || porta.nome || '.'
       when s.preco_a_partir_de = 0 then '. Sem custo.'
       when s.preco_a_partir_de > 0 then '. A partir de ' || public.reais(s.preco_a_partir_de) || '.'
       else ''
     end as procedimento
from public.servicos_clinica s
left join lateral (
  select a.nome
    from public.servicos_clinica a
   where a.e_avaliacao and a.ativo and a.id <> s.id
   limit 1
) porta on true
where s.ativo
order by s.created_at;

comment on view public.procedimentos_clinica_agente is
  'Servicos ativos em frases prontas, um por linha, para o prompt do Agente de '
  'IA. Traz o fluxo (passa pela porta de entrada? so quando ela existe) e o '
  'valor, quando ha. Calculada na leitura a partir de servicos_clinica.';


-- =============================================================================
-- CONFERÊNCIA
-- =============================================================================
--
--   select column_default from information_schema.columns
--    where table_name = 'servicos_clinica' and column_name = 'exige_avaliacao';
--   -- false
--
--   select procedimento from public.procedimentos_clinica_agente;
--   -- com porta: "Lentes de Contato: ... Antes deste, marque Avaliação Odontológica."
--   -- sem porta: nenhuma linha fala em "Antes deste"
