-- Teste da 0038 — convênios: a regra da consulta, quem vê o repasse, e o que a
-- Letícia lê. Desfaz tudo no fim.

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       v.email, '{}'::jsonb, now(), now()
from (values
  ('d0000000-0000-0000-0000-00000000000d', 'teste-dona@odonto.test'),
  ('a0000000-0000-0000-0000-00000000000a', 'teste-recepcao@odonto.test')
) as v (id, email);
update public.usuarios set papel = 'dona'     where id = 'd0000000-0000-0000-0000-00000000000d';
update public.usuarios set papel = 'recepcao' where id = 'a0000000-0000-0000-0000-00000000000a';

-- Um serviço coberto (o primeiro) e um não coberto (o segundo).
create temp table s as
select (array_agg(id order by created_at))[1] as coberto_id,   (array_agg(nome order by created_at))[1] as coberto,
       (array_agg(id order by created_at))[2] as descoberto_id, (array_agg(nome order by created_at))[2] as descoberto
  from public.servicos_clinica where ativo;
grant select on s to authenticated;

insert into public.convenios (id, nome) values
  ('c0000000-0000-0000-0000-00000000000c', 'Convênio Teste'),
  ('c1000000-0000-0000-0000-00000000000c', 'Convênio Inativo');
update public.convenios set ativo = false where id = 'c1000000-0000-0000-0000-00000000000c';
insert into public.convenio_coberturas (convenio_id, servico_id)
select 'c0000000-0000-0000-0000-00000000000c'::uuid, coberto_id from s
union all
select 'c1000000-0000-0000-0000-00000000000c'::uuid, descoberto_id from s;
insert into public.convenio_repasses (convenio_id, servico_id, valor)
select 'c0000000-0000-0000-0000-00000000000c'::uuid, coberto_id, 87.50 from s;

insert into public.profissionais (id, nome, sobrenome, cor)
values ('f0000000-0000-0000-0000-00000000000f', 'Prof', 'Teste', '#123456');

-- Ana: convênio. Bia: particular. Caio: ficha em branco.
insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status, forma_pagamento, convenio_id) values
  ('11111111-0000-0000-0000-000000000001', 'Ana Teste',  '5511900000001', 'conversando', 'convenio', 'c0000000-0000-0000-0000-00000000000c'),
  ('11111111-0000-0000-0000-000000000002', 'Bia Teste',  '5511900000002', 'conversando', 'particular', null),
  ('11111111-0000-0000-0000-000000000003', 'Caio Teste', '5511900000003', 'conversando', null, null);

insert into public.consultas (id, lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, status)
select v.id::uuid, v.lead::uuid, 'f0000000-0000-0000-0000-00000000000f',
       case v.qual when 'c' then s.coberto else s.descoberto end,
       v.quando::timestamptz, 15, 'agendada'
  from s, (values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'c', '2031-01-06 13:00+00'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'd', '2031-01-06 14:00+00'),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000002', 'c', '2031-01-06 15:00+00'),
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000003', 'c', '2031-01-06 16:00+00')
) as v (id, lead, qual, quando);

create temp table r (n serial, ok boolean, texto text);
grant all on r to authenticated;
grant usage, select on sequence r_n_seq to authenticated;

-- A REGRA DA CONSULTA
insert into r (ok, texto)
select forma_pagamento = 'convenio' and convenio_id = 'c0000000-0000-0000-0000-00000000000c',
       'convênio + serviço coberto → consulta pelo convênio'
  from public.consultas where id = '22222222-0000-0000-0000-000000000001';
insert into r (ok, texto)
select forma_pagamento = 'particular' and convenio_id is null,
       'convênio + serviço NÃO coberto → particular (a conversão)'
  from public.consultas where id = '22222222-0000-0000-0000-000000000002';
insert into r (ok, texto)
select forma_pagamento = 'particular', 'ficha particular → particular'
  from public.consultas where id = '22222222-0000-0000-0000-000000000003';
insert into r (ok, texto)
select forma_pagamento is null, 'ficha em branco → consulta em branco'
  from public.consultas where id = '22222222-0000-0000-0000-000000000004';

-- A ficha preenchida depois completa a consulta futura em branco.
update public.crm_clinica_dados set forma_pagamento = 'convenio', convenio_id = 'c0000000-0000-0000-0000-00000000000c'
 where id = '11111111-0000-0000-0000-000000000003';
insert into r (ok, texto)
select forma_pagamento = 'convenio', 'ficha preenchida depois completa a consulta futura em branco'
  from public.consultas where id = '22222222-0000-0000-0000-000000000004';

-- …mas nunca mexe no que já foi escolhido.
update public.crm_clinica_dados set forma_pagamento = 'particular', convenio_id = null
 where id = '11111111-0000-0000-0000-000000000001';
insert into r (ok, texto)
select forma_pagamento = 'convenio', 'trocar a ficha não muda consulta que já tinha forma'
  from public.consultas where id = '22222222-0000-0000-0000-000000000001';

-- Convênio em uso não se apaga.
do $$
begin
  delete from public.convenios where id = 'c0000000-0000-0000-0000-00000000000c';
  insert into r (ok, texto) values (false, 'ERRO: apagou um convênio em uso');
exception when foreign_key_violation then
  insert into r (ok, texto) values (true, 'convênio em uso não se apaga (desativa-se)');
end $$;

-- "convênio" sem dizer qual é recusado.
do $$
begin
  update public.crm_clinica_dados set forma_pagamento = 'convenio', convenio_id = null
   where id = '11111111-0000-0000-0000-000000000002';
  insert into r (ok, texto) values (false, 'ERRO: aceitou convênio sem convênio');
exception when check_violation then
  insert into r (ok, texto) values (true, 'forma "convênio" exige dizer qual');
end $$;

-- O QUE A LETÍCIA LÊ
insert into r (ok, texto)
select count(*) = 1, 'a empresa lista os convênios ativos (e só eles)'
  from public.informacoes_clinica_agente
 where informacao like 'Convênios aceitos: %Convênio Teste%' and informacao not like '%Convênio Inativo%';
insert into r (ok, texto)
select count(*) = 1, 'o serviço coberto diz qual convênio cobre'
  from public.procedimentos_clinica_agente, s
 where procedimento like s.coberto || '%Cobertura de convênio: %Convênio Teste%';
insert into r (ok, texto)
select count(*) = 0, 'convênio inativo não aparece na cobertura'
  from public.procedimentos_clinica_agente
 where procedimento like '%Convênio Inativo%';

-- RECEPÇÃO: vê convênios e coberturas, NÃO vê repasse, não configura
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into r (ok, texto) select count(*) = 2, 'recepção vê os convênios' from public.convenios where id::text like 'c%-0000-0000-0000-00000000000c';
  insert into r (ok, texto) select count(*) = 2, 'recepção vê as coberturas'
    from public.convenio_coberturas where convenio_id::text like 'c%-0000-0000-0000-00000000000c';
  insert into r (ok, texto) select count(*) = 0, 'recepção NÃO vê o repasse' from public.convenio_repasses;
  insert into r (ok, texto) select count(*) = 1, 'recepção lê a ficha com o convênio (nome pela visão)'
    from public.crm_clinica where id = '11111111-0000-0000-0000-000000000003' and convenio_nome = 'Convênio Teste';
end $$;
-- Bloco à parte: a exceção esperada desfaz o que o bloco gravou antes dela.
do $$
begin
  insert into public.convenios (nome) values ('Tentativa da recepção');
  insert into r (ok, texto) values (false, 'ERRO: recepção criou convênio');
exception when insufficient_privilege then
  insert into r (ok, texto) values (true, 'recepção não cria convênio');
end $$;
-- A recepção troca a ficha, e a consulta futura dela acompanha (gatilho com
-- direitos próprios, mesmo que ela não visse a consulta).
do $$
begin
  update public.crm_clinica_dados set forma_pagamento = 'particular', convenio_id = null, convenio_carteirinha = '123'
   where id = '11111111-0000-0000-0000-000000000002';
  insert into r (ok, texto) select count(*) = 1, 'recepção grava forma e carteirinha na ficha'
    from public.crm_clinica where id = '11111111-0000-0000-0000-000000000002' and convenio_carteirinha = '123';
end $$;
reset role;

-- ADMIN: vê e grava o repasse
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into r (ok, texto) select count(*) = 1 and sum(valor) = 87.50, 'admin vê o repasse'
    from public.convenio_repasses where convenio_id = 'c0000000-0000-0000-0000-00000000000c';
  update public.convenio_repasses set valor = 90 where convenio_id = 'c0000000-0000-0000-0000-00000000000c';
  insert into r (ok, texto) select sum(valor) = 90, 'admin altera o repasse'
    from public.convenio_repasses where convenio_id = 'c0000000-0000-0000-0000-00000000000c';
end $$;
reset role;

-- A ESTRUTURA
insert into r (ok, texto)
select count(*) filter (where schemaname = 'public') = 41,
       'políticas em public: ' || count(*) filter (where schemaname = 'public') || ' (esperado 41)'
  from pg_policies where schemaname in ('public', 'storage');
insert into r (ok, texto)
select coalesce(array_agg(p.proname order by p.proname), '{}')
         = array['definir_valor_pago', 'definir_valor_pago_consulta', 'plano_aprovar', 'plano_publico', 'valor_pago_visivel', 'valores_das_consultas']::name[],
       'funções que furam o RLS e a equipe chama: continuam só as quatro dos valores'
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.prosecdef
   and p.prorettype <> 'trigger'::regtype
   and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
insert into r (ok, texto)
select not has_table_privilege('anon', 'public.convenio_repasses', 'select')
   and not has_table_privilege('anon', 'public.convenios', 'select'),
       'a chave pública não alcança as tabelas de convênio';

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
