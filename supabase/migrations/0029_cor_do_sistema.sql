-- =============================================================================
-- 0029 — A cor do sistema vira escolha da empresa
-- =============================================================================
--
-- O azul petróleo da clínica odontológica onde o sistema nasceu estava escrito
-- à mão em cerca de 250 lugares da tela. Uma barbearia que quisesse verde
-- dependeria de alguém achar todos — e o esquecido virava um botão azul perdido
-- no meio do verde.
--
-- Agora a empresa escolhe entre 7 cores prontas, em Configurações → Empresa, e
-- a escolha mora aqui. Cada cor vem com os seus quatro tons (principal, escuro
-- para o mouse em cima, claro para o "salvando", suave para os realces),
-- ajustados à mão e conferidos com letra branca por cima.
--
-- ── O QUE MORA ONDE ─────────────────────────────────────────────────────────
--
--   · Aqui: só a CHAVE da cor escolhida ('petroleo', 'verde'...).
--   · Em src/lib/marca.ts: a lista das 7 e os tons de cada uma.
--
-- A coluna NÃO tem CHECK, pela mesma razão do `fuso_horario` e da paleta de
-- `cores.ts`: acrescentar uma cor à lista não deve exigir migração. Uma chave
-- que a tela não conhece vira a cor padrão, sem erro.
--
-- ── E A TELA DE LOGIN ───────────────────────────────────────────────────────
--
-- Ela abre antes de a pessoa entrar, e o RLS não deixa ler esta tabela sem
-- sessão. Por decisão de produto (11/09/2026), ela abre na cor padrão na
-- primeira vez e, depois do primeiro acesso, cada computador lembra a última
-- cor que viu (localStorage). Nada no banco foi aberto para quem não tem login.
-- =============================================================================


alter table public.configuracoes_clinica
  add column if not exists cor_sistema text not null default 'petroleo';

comment on column public.configuracoes_clinica.cor_sistema is
  'Chave da cor do sistema (petroleo, azul, verde, roxo, rosa, laranja, '
  'marrom). A lista e os tons de cada uma moram em src/lib/marca.ts; chave '
  'desconhecida vira a padrao (petroleo). Sem CHECK de proposito: ampliar a '
  'lista nao exige migracao.';


-- =============================================================================
-- CONFERÊNCIA
-- =============================================================================
--
--   select cor_sistema from public.configuracoes_clinica;
--   -- esperado: 'petroleo' (a cor de antes, para quem já usava o sistema)
