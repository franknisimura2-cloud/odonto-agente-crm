-- =============================================================================
-- 0039 — Cobertura de convênio com a pontuação certa
-- =============================================================================
--
-- Na 0038, quando a descrição curta do serviço não terminava em ponto (e não
-- havia preço nem porta de entrada depois dela), a Letícia lia "indicada a
-- cada seis meses Cobertura de convênio: ...". Mesma visão, com o ponto.
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
     end
  -- A frase anterior pode terminar sem ponto (descrição sem ponto final e sem
  -- preço): sem esta checagem, a cobertura grudava nela.
  || case
       when cob.nomes is null then ''
       when s.exige_avaliacao and porta.nome is not null then ' '
       when s.preco_a_partir_de is not null then ' '
       when right(trim(coalesce(s.descricao, '')), 1) in ('.', '!', '?') then ' '
       else '. '
     end
  || coalesce('Cobertura de convênio: ' || cob.nomes || '.', '') as procedimento
from public.servicos_clinica s
left join lateral (
  select a.nome
    from public.servicos_clinica a
   where a.e_avaliacao and a.ativo and a.id <> s.id
   limit 1
) porta on true
left join lateral (
  select string_agg(cv.nome, ', ' order by cv.nome) as nomes
    from public.convenio_coberturas cc
    join public.convenios cv on cv.id = cc.convenio_id and cv.ativo
   where cc.servico_id = s.id
) cob on true
where s.ativo
order by s.created_at;
