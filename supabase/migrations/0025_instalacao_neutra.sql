-- =============================================================================
-- 0025 — A instalação nasce neutra
-- =============================================================================
--
-- O Núcleo nasceu dentro de uma clínica odontológica, e as migrações guardam
-- essa origem: a 0001 dá à empresa o nome "Odonto Clinica", a 0005 cadastra
-- vinte tratamentos, a 0012 escreve os textos deles e a 0018 faz da avaliação
-- a porta de entrada. Uma barbearia que instalasse o sistema abriria a página
-- Serviços e encontraria "Extração de Siso" — e a atendente oferecendo canal
-- a quem quer cortar o cabelo.
--
-- As migrações antigas NÃO são editadas: elas já rodaram em bancos de verdade,
-- e mudar o que um arquivo aplicado faz é o jeito de dois bancos com o "mesmo"
-- histórico ficarem diferentes. Esta migração desfaz o conteúdo no fim da
-- fila. Numa instalação nova, o efeito é o de nunca ter existido.
--
-- ── O QUE SAI ────────────────────────────────────────────────────────────────
--
--   • Os vinte serviços odontológicos. Quem é clínica odontológica os traz de
--     volta, prontos, com o kit `kits/clinica-odontologica/servicos.sql`.
--   • O nome "Odonto Clinica". Vazio, a barra lateral mostra "Núcleo", e a
--     linha `Nome:` some da view `informacoes_clinica_agente` até a empresa
--     preencher o dela — a atendente não se apresenta em nome de outra.
--
-- ── O QUE FICA ───────────────────────────────────────────────────────────────
--
--   • A grade de horário de exemplo (segunda a sexta das 8h às 18h, sábado até
--     o meio-dia). Serve para qualquer negócio e se muda na aba Horários.
--   • O nome da atendente, "Letícia" (0019). É o padrão do produto.
--
-- ⚠️ SÓ AGE NUM BANCO QUE NINGUÉM USOU. Com um contato ou um agendamento
-- sequer, a migração não mexe em nada e só avisa: num sistema em uso, apagar o
-- catálogo quebraria fichas e agendamentos que citam esses nomes (a trava da
-- 0022 exige que eles existam). E mesmo num banco vazio só saem os nomes da
-- lista abaixo — um serviço que a empresa já tenha cadastrado pela tela fica.
-- =============================================================================

do $$
begin
  if exists (select 1 from public.crm_clinica_dados)
     or exists (select 1 from public.consultas) then
    raise notice '0025: o banco já tem contatos ou agendamentos; o catálogo e o nome da empresa ficam como estão.';
    return;
  end if;

  delete from public.servicos_clinica
   where nome in (
     -- 0018 renomeou a primeira; as duas grafias entram, para o caso de um
     -- banco ter parado no meio do caminho.
     'Avaliação Odontológica',
     'Avaliação e Planejamento Digital do Sorriso',
     'Lentes de Contato',
     'Facetas em Resina',
     'Clareamento Dental',
     'Gengivoplastia',
     'Alinhadores Transparentes',
     'Implante Unitário',
     'Carga Imediata',
     'Prótese Fixa sobre Implantes',
     'Enxerto Ósseo',
     'Levantamento de Seio Maxilar',
     'Prótese Dentária',
     'Tratamento de Canal',
     'Placa de Bruxismo',
     'Tratamento de DTM',
     'Limpeza e Profilaxia',
     'Raspagem',
     'Tratamento Periodontal',
     'Enxerto Gengival',
     'Extração de Siso'
   );

  update public.configuracoes_clinica
     set nome_clinica = null
   where nome_clinica = 'Odonto Clinica';
end
$$;


-- =============================================================================
-- CONFERÊNCIA
-- =============================================================================
--
--   select count(*) from public.servicos_clinica;          -- instalação nova: 0
--   select nome_clinica from public.configuracoes_clinica;  -- instalação nova: null
--   select informacao from public.informacoes_clinica_agente;
--   -- instalação nova: só a linha "Atendimento: ..."
