-- Teste da 0041 — plano de tratamento: cobertura sozinha, status sozinho, o
-- link do paciente e quem vê. Desfaz tudo no fim.

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       v.email, '{}'::jsonb, now(), now()
from (values
  ('d0000000-0000-0000-0000-00000000000d', 'teste-dona@odonto.test'),
  ('a0000000-0000-0000-0000-00000000000a', 'teste-recepcao@odonto.test'),
  ('b0000000-0000-0000-0000-00000000000b', 'teste-profissional@odonto.test')
) as v (id, email);
insert into public.profissionais (id, nome, sobrenome, cor)
values ('f0000000-0000-0000-0000-00000000000f', 'Prof', 'Teste', '#123456');
update public.usuarios set papel = 'dona'     where id = 'd0000000-0000-0000-0000-00000000000d';
update public.usuarios set papel = 'recepcao' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.usuarios set papel = 'profissional', profissional_id = 'f0000000-0000-0000-0000-00000000000f'
 where id = 'b0000000-0000-0000-0000-00000000000b';

-- Dois serviços: o coberto pelo convênio e o outro (com preço "a partir de").
create temp table s as
select (array_agg(id order by created_at))[1] as coberto_id,   (array_agg(nome order by created_at))[1] as coberto,
       (array_agg(id order by created_at))[2] as descoberto_id, (array_agg(nome order by created_at))[2] as descoberto
  from public.servicos_clinica where ativo;
update public.servicos_clinica set preco_a_partir_de = 1200 where id = (select descoberto_id from s);

insert into public.convenios (id, nome) values ('c0000000-0000-0000-0000-00000000000c', 'Convênio Teste');
insert into public.convenio_coberturas (convenio_id, servico_id)
select 'c0000000-0000-0000-0000-00000000000c'::uuid, coberto_id from s;

insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status, forma_pagamento, convenio_id) values
  ('11111111-0000-0000-0000-000000000001', 'Ana Maria Teste', '5511900000001', 'conversando', 'convenio', 'c0000000-0000-0000-0000-00000000000c');
-- A profissional atende a Ana.
insert into public.consultas (id, lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, status)
select '22222222-0000-0000-0000-000000000001'::uuid, '11111111-0000-0000-0000-000000000001'::uuid, 'f0000000-0000-0000-0000-00000000000f'::uuid,
       coberto, '2031-01-06 13:00+00', 30, 'agendada' from s;

insert into public.planos_tratamento (id, lead_id, token)
values ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001');

insert into public.plano_itens (id, plano_id, servico_id, procedimento, dente, etapa)
select '66666666-0000-0000-0000-000000000001'::uuid, '44444444-0000-0000-0000-000000000001'::uuid, coberto_id, coberto, 16, 1 from s
union all
select '66666666-0000-0000-0000-000000000002'::uuid, '44444444-0000-0000-0000-000000000001'::uuid, descoberto_id, descoberto, 11, 3 from s;

create temp table r (n serial, ok boolean, texto text);
grant all on r to authenticated, anon;
grant usage, select on sequence r_n_seq to authenticated, anon;

-- A COBERTURA SOZINHA
insert into r (ok, texto)
select cobertura = 'convenio' and convenio_id = 'c0000000-0000-0000-0000-00000000000c' and valor = 0,
       'serviço coberto pelo convênio da ficha → convênio, valor 0 para o paciente'
  from public.plano_itens where id = '66666666-0000-0000-0000-000000000001';
insert into r (ok, texto)
select cobertura = 'particular' and valor = 1200,
       'serviço não coberto → particular, com o "a partir de" do serviço (' || valor || ')'
  from public.plano_itens where id = '66666666-0000-0000-0000-000000000002';

-- O LINK: rascunho não aparece
insert into r (ok, texto)
select public.plano_publico('55555555-0000-0000-0000-000000000001') is null, 'plano em rascunho não aparece no link';

update public.planos_tratamento set status = 'apresentado', apresentado_em = now()
 where id = '44444444-0000-0000-0000-000000000001';

-- O PACIENTE, SEM LOGIN
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare j jsonb; st text;
begin
  j := public.plano_publico('55555555-0000-0000-0000-000000000001');
  insert into r (ok, texto) values (j ->> 'paciente' = 'Ana', 'o link mostra só o primeiro nome (' || coalesce(j ->> 'paciente', 'nada') || ')');
  insert into r (ok, texto) values (jsonb_array_length(j -> 'itens') = 2 and not (j ? 'whatsapp'), 'o link traz os itens e nada de telefone');
  insert into r (ok, texto) values (public.plano_publico(gen_random_uuid()) is null, 'token errado não mostra nada');
  st := public.plano_aprovar('55555555-0000-0000-0000-000000000001', array[1]::smallint[]);
  insert into r (ok, texto) values (st = 'parcial', 'aprovar só a etapa 1 → plano parcial (' || st || ')');
  st := public.plano_aprovar('55555555-0000-0000-0000-000000000001', array[3]::smallint[]);
  insert into r (ok, texto) values (st = 'aprovado', 'aprovar a etapa 3 também → aprovado (' || st || ')');
  begin
    perform 1 from public.planos_tratamento;
    insert into r (ok, texto) values (false, 'ERRO: a chave pública leu a tabela de planos');
  exception when insufficient_privilege then
    insert into r (ok, texto) values (true, 'a chave pública não lê a tabela de planos (só pelo link)');
  end;
end $$;
do $$
begin
  perform public.plano_aprovar('55555555-0000-0000-0000-000000000001', array[1]::smallint[]);
  insert into r (ok, texto) values (false, 'ERRO: aprovou de novo um plano já aprovado');
exception when raise_exception then
  insert into r (ok, texto) values (true, 'plano já decidido não se aprova de novo');
end $$;
reset role;

-- A BAIXA DA CONSULTA MARCA O ITEM COMO FEITO
update public.plano_itens set consulta_id = '22222222-0000-0000-0000-000000000001'
 where id = '66666666-0000-0000-0000-000000000001';
update public.consultas set status = 'realizada' where id = '22222222-0000-0000-0000-000000000001';
insert into r (ok, texto)
select status = 'feito', 'consulta do item com baixa "compareceu" → item feito'
  from public.plano_itens where id = '66666666-0000-0000-0000-000000000001';
update public.plano_itens set status = 'feito' where id = '66666666-0000-0000-0000-000000000002';
insert into r (ok, texto)
select status = 'concluido', 'todos os itens feitos → plano concluído'
  from public.planos_tratamento where id = '44444444-0000-0000-0000-000000000001';

-- Vencido não se aprova.
insert into public.planos_tratamento (id, lead_id, token, status, validade)
values ('44444444-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001',
        '55555555-0000-0000-0000-000000000002', 'apresentado', current_date - 10);
insert into public.plano_itens (plano_id, procedimento, etapa)
values ('44444444-0000-0000-0000-000000000002', 'Teste', 1);
do $$
begin
  perform public.plano_aprovar('55555555-0000-0000-0000-000000000002', array[1]::smallint[]);
  insert into r (ok, texto) values (false, 'ERRO: aprovou plano vencido');
exception when raise_exception then
  insert into r (ok, texto) values (true, 'plano vencido não se aprova pelo link');
end $$;

-- QUEM VÊ
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into r (ok, texto) select count(*) = 0, 'recepção sem a permissão Orçamentos não vê planos'
    from public.planos_tratamento where lead_id = '11111111-0000-0000-0000-000000000001';
end $$;
reset role;
update public.usuarios set permissoes = '{"orcamentos": true}' where id = 'a0000000-0000-0000-0000-00000000000a';
set local role authenticated;
do $$
begin
  insert into r (ok, texto) select count(*) = 2, 'recepção com Orçamentos ligado vê os planos'
    from public.planos_tratamento where lead_id = '11111111-0000-0000-0000-000000000001';
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into public.planos_tratamento (lead_id) values ('11111111-0000-0000-0000-000000000001');
  insert into r (ok, texto) values (true, 'a profissional (odontograma) cria plano para a paciente dela');
end $$;
reset role;

-- A ESTRUTURA
insert into r (ok, texto)
select count(*) filter (where schemaname = 'public') = 41,
       'políticas em public: ' || count(*) filter (where schemaname = 'public') || ' (esperado 41)'
  from pg_policies where schemaname in ('public', 'storage');
insert into r (ok, texto)
select coalesce(array_agg(p.proname order by p.proname), '{}')
         = array['definir_valor_pago', 'definir_valor_pago_consulta', 'plano_aprovar', 'plano_publico',
                 'valor_pago_visivel', 'valores_das_consultas']::name[],
       'funções que furam o RLS e se chamam de fora: as quatro dos valores + as duas do link'
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.prosecdef
   and p.prorettype <> 'trigger'::regtype
   and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
