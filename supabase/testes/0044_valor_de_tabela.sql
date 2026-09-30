-- Teste da 0044 — o valor de tabela: o item particular do plano nasce com ele, e a
-- Letícia não o enxerga. Desfaz tudo no fim.

create temp table r (n serial, ok boolean, texto text);
create temp table s as select id, nome from public.servicos_clinica where ativo and exige_avaliacao order by created_at limit 1;
update public.servicos_clinica set valor_tabela = 2800, preco_a_partir_de = null where id = (select id from s);
insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status, forma_pagamento) values ('11111111-0000-0000-0000-000000000001', 'Ana', '5511900000001', 'conversando', 'particular');
insert into public.planos_tratamento (id, lead_id) values ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001');
insert into public.plano_itens (id, plano_id, servico_id, procedimento) select '66666666-0000-0000-0000-000000000001'::uuid, '44444444-0000-0000-0000-000000000001'::uuid, id, nome from s;
insert into r (ok, texto) select valor = 2800 and cobertura = 'particular', 'item particular nasce com o valor de tabela (' || valor || ')' from public.plano_itens where id = '66666666-0000-0000-0000-000000000001';
insert into r (ok, texto) select count(*) = 0, 'o valor de tabela não vai para o que a Letícia lê' from public.procedimentos_clinica_agente where procedimento like '%2.800%' or procedimento like '%2800%';
do $$ declare falhas int; txt text; begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n) into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt; end $$;
