-- Teste da 0040 — odontograma: quem vê, quem mexe, o histórico e as travas
-- de numeração. Desfaz tudo no fim.

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

-- Ana é paciente da profissional (tem consulta com ela). Bia não.
insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status) values
  ('11111111-0000-0000-0000-000000000001', 'Ana Teste', '5511900000001', 'conversando'),
  ('11111111-0000-0000-0000-000000000002', 'Bia Teste', '5511900000002', 'conversando');
insert into public.consultas (lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, status)
select '11111111-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000f',
       (select nome from public.servicos_clinica where ativo order by created_at limit 1),
       '2031-01-06 13:00+00', 30, 'agendada';

-- Um achado da Bia, gravado pela chave de serviço (a profissional não a vê).
insert into public.odontograma_registros (id, lead_id, dente, faces, condicao, situacao)
values ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 26, '{O}', 'carie', 'a_tratar');

create temp table r (n serial, ok boolean, texto text);
grant all on r to authenticated;
grant usage, select on sequence r_n_seq to authenticated;

-- AS TRAVAS DE NUMERAÇÃO
do $$
begin
  insert into public.odontograma_registros (lead_id, dente, condicao) values ('11111111-0000-0000-0000-000000000001', 19, 'carie');
  insert into r (ok, texto) values (false, 'ERRO: aceitou o dente 19');
exception when check_violation then
  insert into r (ok, texto) values (true, 'dente 19 não existe (FDI) — recusado');
end $$;
do $$
begin
  insert into public.odontograma_registros (lead_id, dente, condicao) values ('11111111-0000-0000-0000-000000000001', 56, 'carie');
  insert into r (ok, texto) values (false, 'ERRO: aceitou o dente de leite 56');
exception when check_violation then
  insert into r (ok, texto) values (true, 'dente de leite 56 não existe — recusado');
end $$;
do $$
begin
  insert into public.odontograma_registros (lead_id, dente, faces, condicao) values ('11111111-0000-0000-0000-000000000001', 16, '{X}', 'carie');
  insert into r (ok, texto) values (false, 'ERRO: aceitou a face X');
exception when check_violation then
  insert into r (ok, texto) values (true, 'face inexistente recusada');
end $$;

-- PROFISSIONAL: marca na paciente dela, não enxerga a outra
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into public.odontograma_registros (id, lead_id, dente, faces, condicao, situacao)
  values ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 16, '{M,O,D}', 'carie', 'a_tratar');
  insert into r (ok, texto) values (true, 'profissional marca cárie MOD no 16 da paciente dela');
  update public.odontograma_registros set situacao = 'tratado', condicao = 'restauracao'
   where id = '33333333-0000-0000-0000-000000000001';
  insert into r (ok, texto) select situacao = 'tratado', 'profissional muda para tratado'
    from public.odontograma_registros where id = '33333333-0000-0000-0000-000000000001';
  insert into public.odontogramas (lead_id, deciduos) values ('11111111-0000-0000-0000-000000000001', true);
  insert into public.odontograma_registros (lead_id, dente, condicao) values ('11111111-0000-0000-0000-000000000001', 55, 'carie');
  insert into r (ok, texto) values (true, 'profissional liga os dentes de leite e marca o 55');
  insert into r (ok, texto) select count(*) = 0, 'profissional NÃO vê o odontograma de quem ela não atende'
    from public.odontograma_registros where lead_id = '11111111-0000-0000-0000-000000000002';
  insert into r (ok, texto) select count(*) = 3, 'o histórico registrou criou, alterou e criou (' || count(*) || ')'
    from public.odontograma_historico where lead_id = '11111111-0000-0000-0000-000000000001';
  insert into r (ok, texto) select bool_and(por = 'b0000000-0000-0000-0000-00000000000b'), 'o histórico diz quem fez'
    from public.odontograma_historico where lead_id = '11111111-0000-0000-0000-000000000001';
end $$;
do $$
begin
  insert into public.odontograma_registros (lead_id, dente, condicao) values ('11111111-0000-0000-0000-000000000002', 11, 'carie');
  insert into r (ok, texto) values (false, 'ERRO: profissional marcou em quem ela não atende');
exception when insufficient_privilege then
  insert into r (ok, texto) values (true, 'profissional não marca em quem ela não atende');
end $$;
do $$
begin
  insert into public.odontograma_historico (lead_id, acao) values ('11111111-0000-0000-0000-000000000001', 'criou');
  insert into r (ok, texto) values (false, 'ERRO: alguém da equipe escreveu no histórico');
exception when insufficient_privilege then
  insert into r (ok, texto) values (true, 'ninguém escreve no histórico à mão');
end $$;
reset role;

-- RECEPÇÃO: vê, não mexe
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into r (ok, texto) select count(*) = 3, 'recepção vê o odontograma das duas (' || count(*) || ' achados)'
    from public.odontograma_registros where lead_id::text like '11111111-%';
end $$;
do $$
declare n int;
begin
  update public.odontograma_registros set situacao = 'existente' where id = '33333333-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  insert into r (ok, texto) values (n = 0, 'recepção não altera o odontograma (' || n || ' linha)');
end $$;
do $$
begin
  insert into public.odontograma_registros (lead_id, dente, condicao) values ('11111111-0000-0000-0000-000000000002', 11, 'carie');
  insert into r (ok, texto) values (false, 'ERRO: recepção marcou no odontograma');
exception when insufficient_privilege then
  insert into r (ok, texto) values (true, 'recepção não marca no odontograma');
end $$;
reset role;

-- A PERMISSÃO NOVA
insert into r (ok, texto)
select public.permissao_efetiva('profissional', '{}', 'odontograma')
   and not public.permissao_efetiva('recepcao', '{}', 'odontograma')
   and public.permissao_efetiva('recepcao', '{"odontograma": true}', 'odontograma'),
       'padrão: profissional mexe, recepção não — e a Admin liga por pessoa';

-- Apagar a pessoa leva o odontograma junto, sem tropeçar no histórico.
delete from public.crm_clinica_dados where id = '11111111-0000-0000-0000-000000000001';
insert into r (ok, texto)
select count(*) = 0, 'apagar a pessoa apaga o odontograma e o histórico dela'
  from public.odontograma_historico where lead_id = '11111111-0000-0000-0000-000000000001';

-- A ESTRUTURA
insert into r (ok, texto)
select count(*) filter (where schemaname = 'public') = 42,
       'políticas em public: ' || count(*) filter (where schemaname = 'public') || ' (esperado 42)'
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
select not has_table_privilege('anon', 'public.odontograma_registros', 'select'),
       'a chave pública não alcança o odontograma';

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
