-- Teste da 0045 — o painel da roda: as contas, e o dinheiro só com `valores`.
-- Desfaz tudo no fim. As contas usam um período só deste teste (2031), para
-- não se misturar com os dados da clínica.

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       v.email, '{}'::jsonb, now(), now()
from (values
  ('d0000000-0000-0000-0000-00000000000d', 'teste-dona@odonto.test'),
  ('a0000000-0000-0000-0000-00000000000a', 'teste-recepcao@odonto.test')
) as v (id, email);
update public.usuarios set papel = 'dona' where id = 'd0000000-0000-0000-0000-00000000000d';
update public.usuarios set papel = 'recepcao', permissoes = '{"dashboard": true}' where id = 'a0000000-0000-0000-0000-00000000000a';

insert into public.convenios (id, nome) values ('c0000000-0000-0000-0000-00000000000c', 'Convênio Teste');

-- Três pessoas novas em 2031: duas de convênio, uma particular.
insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status, forma_pagamento, convenio_id, inicio_atendimento) values
  ('11111111-0000-0000-0000-000000000001', 'Ana', '5511900000001', 'consulta_realizada', 'convenio', 'c0000000-0000-0000-0000-00000000000c', '2031-03-02'),
  ('11111111-0000-0000-0000-000000000002', 'Bia', '5511900000002', 'consulta_realizada', 'convenio', 'c0000000-0000-0000-0000-00000000000c', '2031-03-03'),
  ('11111111-0000-0000-0000-000000000003', 'Caio', '5511900000003', 'consulta_realizada', 'particular', null, '2031-03-04');

-- Duas ganharam odontograma no período.
insert into public.odontograma_registros (lead_id, dente, condicao, created_at) values
  ('11111111-0000-0000-0000-000000000001', 16, 'carie', '2031-03-05'),
  ('11111111-0000-0000-0000-000000000001', 36, 'ausente', '2031-03-05'),
  ('11111111-0000-0000-0000-000000000002', 11, 'carie', '2031-03-06');

-- Dois planos apresentados: Ana aprova o particular (R$ 3.000 de 3.500), Bia não decide.
insert into public.planos_tratamento (id, lead_id, status, apresentado_em, desconto) values
  ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'apresentado', '2031-03-10', 0),
  ('44444444-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'apresentado', '2031-03-11', 100);
insert into public.plano_itens (plano_id, procedimento, etapa, cobertura, convenio_id, valor, status) values
  ('44444444-0000-0000-0000-000000000001', 'Restauração', 1, 'convenio', 'c0000000-0000-0000-0000-00000000000c', 0, 'aprovado'),
  ('44444444-0000-0000-0000-000000000001', 'Implante', 2, 'particular', null, 3000, 'aprovado'),
  ('44444444-0000-0000-0000-000000000001', 'Clareamento', 3, 'particular', null, 500, 'pendente'),
  ('44444444-0000-0000-0000-000000000002', 'Lentes', 3, 'particular', null, 8000, 'pendente');

create temp table r (n serial, ok boolean, texto text);
grant all on r to authenticated;
grant usage, select on sequence r_n_seq to authenticated;

-- ADMIN
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
do $$
declare j jsonb;
begin
  j := public.dashboard_roda('2031-01-01', '2031-12-31');
  insert into r (ok, texto) values ((j->>'entrada')::int = 3 and (j->>'entrada_convenio')::int = 2 and (j->>'entrada_particular')::int = 1,
    'entrada: 3 pessoas, 2 de convênio, 1 particular (' || (j->>'entrada') || '/' || (j->>'entrada_convenio') || ')');
  insert into r (ok, texto) values ((j->>'avaliados')::int = 2, 'avaliados com odontograma: 2 (' || (j->>'avaliados') || ')');
  insert into r (ok, texto) values ((j->>'planos_apresentados')::int = 2 and (j->>'planos_aprovados')::int = 1,
    'planos: 2 apresentados, 1 aprovado em parte');
  insert into r (ok, texto) values ((j->>'convertidos')::int = 1, 'conversão: 1 paciente de convênio aprovou particular');
  insert into r (ok, texto) values ((j->>'particular_apresentado')::numeric = 11400,
    'particular apresentado: 3.500 + (8.000 − 100 de desconto) = 11.400 (' || (j->>'particular_apresentado') || ')');
  insert into r (ok, texto) values ((j->>'particular_aprovado')::numeric = 3000 and (j->>'ticket_medio')::numeric = 3000,
    'particular aprovado 3.000; ticket médio 3.000');
  insert into r (ok, texto)
  select particular_aprovado = 3000 and planos_apresentados = 2 and planos_aprovados = 1 and novos = 2,
         'por convênio: Convênio Teste — 2 novos, 2 planos, 1 aprovado, R$ 3.000'
    from public.dashboard_roda_convenios('2031-01-01', '2031-12-31') where convenio = 'Convênio Teste';
end $$;
reset role;

-- RECEPÇÃO com Dashboard mas sem Valores: vê as contagens, não o dinheiro.
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare j jsonb;
begin
  j := public.dashboard_roda('2031-01-01', '2031-12-31');
  insert into r (ok, texto) values (j->'particular_aprovado' = 'null'::jsonb and j->'ticket_medio' = 'null'::jsonb and (j->>'entrada')::int = 3,
    'sem Valores: contagens sim, dinheiro não');
end $$;
reset role;

insert into r (ok, texto)
select not has_function_privilege('anon', 'public.dashboard_roda(timestamptz, timestamptz)', 'execute'),
       'a chave pública não chama o painel';

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
