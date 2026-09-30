-- =============================================================================
-- Teste da 0031 — cada papel, pelo BANCO (e não pela tela)
-- =============================================================================
--
-- Roda DEPOIS da migração, na mesma transação (`scripts/testar-sql.mjs` junta
-- os dois), e termina com um `raise exception` que carrega o resultado: o
-- erro desfaz TUDO — migração, usuários e dados de teste. Nada fica no banco.
--
-- Cada linha do resultado é ✔ (como devia) ou ✖ (errado).
-- =============================================================================

-- Os personagens (ids fixos, fáceis de achar no resultado)
--   D  dona                 R  recepção             S  sem nada
--   P  profissional ligada a "Prof Teste"
--   Q  recepção com `valores` ligado por cima do papel

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       v.email, '{}'::jsonb, now(), now()
from (values
  ('d0000000-0000-0000-0000-00000000000d', 'teste-dona@nucleo.test'),
  ('a0000000-0000-0000-0000-00000000000a', 'teste-recepcao@nucleo.test'),
  ('b0000000-0000-0000-0000-00000000000b', 'teste-profissional@nucleo.test'),
  ('c0000000-0000-0000-0000-00000000000c', 'teste-semnada@nucleo.test'),
  ('e0000000-0000-0000-0000-00000000000e', 'teste-recepcao-valores@nucleo.test')
) as v (id, email);

-- O gatilho criou as linhas em `usuarios` — como `profissional`, porque já
-- existe dona. Aqui, como o sistema, cada um recebe o papel do teste.
insert into public.profissionais (id, nome, sobrenome, cor)
values ('f0000000-0000-0000-0000-00000000000f', 'Prof', 'Teste', '#123456'),
       ('f1000000-0000-0000-0000-00000000000f', 'Outra', 'Teste', '#654321');

update public.usuarios set papel = 'dona'         where id = 'd0000000-0000-0000-0000-00000000000d';
update public.usuarios set papel = 'recepcao'     where id = 'a0000000-0000-0000-0000-00000000000a';
update public.usuarios set papel = 'profissional',
       profissional_id = 'f0000000-0000-0000-0000-00000000000f'
                                                  where id = 'b0000000-0000-0000-0000-00000000000b';
update public.usuarios set papel = 'recepcao', permissoes = '{"valores": true}'
                                                  where id = 'e0000000-0000-0000-0000-00000000000e';

-- Duas pessoas: L1 atendida pela Prof Teste, L2 pela Outra.
insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status, valor_pago_acumulado)
values ('11111111-0000-0000-0000-000000000001', 'Lead Um Teste',   '5511900000001', 'conversando', 123.45),
       ('11111111-0000-0000-0000-000000000002', 'Lead Dois Teste', '5511900000002', 'conversando', 50);

insert into public.consultas (id, lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, status)
select v.id::uuid, v.lead::uuid, v.prof::uuid,
       (select nome from public.servicos_clinica where ativo order by created_at limit 1),
       v.quando::timestamptz, 30, 'agendada'
from (values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000f', '2031-01-06 13:00+00'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-00000000000f', '2031-01-06 14:00+00')
) as v (id, lead, prof, quando);

insert into public.mensagens_whatsapp (lead_id, autor, tipo, conteudo)
values ('11111111-0000-0000-0000-000000000001', 'paciente', 'texto', 'mensagem de teste');

create temp table r (n serial, ok boolean, texto text);
grant all on r to authenticated, anon;
grant usage, select on sequence r_n_seq to authenticated, anon;

-- ===================== A ESTRUTURA =====================
insert into r (ok, texto)
select count(*) filter (where schemaname = 'public') = 43 and count(*) filter (where schemaname = 'storage') = 10,
       'políticas: ' || count(*) filter (where schemaname = 'public') || ' em public (esperado 43), '
       || count(*) filter (where schemaname = 'storage') || ' em storage (esperado 10)'
  from pg_policies where schemaname in ('public', 'storage');

insert into r (ok, texto)
-- As duas da 0031 e as duas da 0033: o teste roda contra o banco de hoje.
select coalesce(array_agg(p.proname order by p.proname), '{}')
         = array['definir_valor_pago', 'definir_valor_pago_consulta', 'plano_aprovar', 'plano_publico', 'valor_pago_visivel', 'valores_das_consultas']::name[],
       'funções que passam por cima do RLS e a equipe chama: '
       || coalesce(string_agg(p.proname, ', ' order by p.proname), 'nenhuma')
       || ' (esperado: as quatro dos valores pagos + as duas do link do plano)'
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.prosecdef
   and p.prorettype <> 'trigger'::regtype
   and (has_function_privilege('anon', p.oid, 'execute')
     or has_function_privilege('authenticated', p.oid, 'execute'));

insert into r (ok, texto)
select count(*) = 0, 'tabelas de public sem RLS: ' || count(*)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;


-- ===================== DONA =====================
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  insert into r (ok, texto) select count(*) = 2, 'dona vê as 2 pessoas (viu ' || count(*) || ')'
    from public.crm_clinica where id::text like '11111111-%';
  insert into r (ok, texto) select valor_pago_acumulado = 123.45, 'dona vê o valor pago'
    from public.crm_clinica where id = '11111111-0000-0000-0000-000000000001';
  insert into r (ok, texto) select count(*) = 2, 'dona vê as 2 consultas'
    from public.consultas where id::text like '22222222-%';
  insert into r (ok, texto) select count(*) = 1, 'dona vê as mensagens'
    from public.mensagens_whatsapp where lead_id = '11111111-0000-0000-0000-000000000001';

  perform public.definir_valor_pago('11111111-0000-0000-0000-000000000001', 200);
  insert into r (ok, texto) select valor_pago_acumulado = 200, 'dona grava o valor pago'
    from public.crm_clinica where id = '11111111-0000-0000-0000-000000000001';

  update public.configuracoes_clinica set nome_clinica = nome_clinica;
  get diagnostics n = row_count;
  insert into r (ok, texto) values (n >= 1, 'dona altera as configurações');

  begin
    perform d.valor_pago_acumulado from public.crm_clinica_dados d limit 1;
    insert into r (ok, texto) values (false, 'ERRO: a coluna do valor está aberta na tabela');
  exception when insufficient_privilege then
    insert into r (ok, texto) values (true, 'coluna do valor fechada na tabela, até para a dona (só pela função)');
  end;
end $$;
reset role;


-- ===================== RECEPÇÃO =====================
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  insert into r (ok, texto) select count(*) = 2, 'recepção vê as 2 pessoas'
    from public.crm_clinica where id::text like '11111111-%';
  insert into r (ok, texto) select valor_pago_acumulado is null, 'recepção NÃO vê o valor pago (veio nulo)'
    from public.crm_clinica where id = '11111111-0000-0000-0000-000000000001';
  insert into r (ok, texto) select count(*) = 2, 'recepção vê a agenda de todas'
    from public.consultas where id::text like '22222222-%';
  insert into r (ok, texto) select count(*) = 1, 'recepção vê as mensagens'
    from public.mensagens_whatsapp where lead_id = '11111111-0000-0000-0000-000000000001';
  insert into r (ok, texto) select count(*) = 0, 'recepção NÃO vê os tokens da API'
    from public.api_tokens;

  update public.configuracoes_clinica set nome_clinica = nome_clinica;
  get diagnostics n = row_count;
  insert into r (ok, texto) values (n = 0, 'recepção NÃO altera as configurações');

  update public.servicos_clinica set descricao = descricao;
  get diagnostics n = row_count;
  insert into r (ok, texto) values (n = 0, 'recepção NÃO altera os serviços');

  begin
    perform public.definir_valor_pago('11111111-0000-0000-0000-000000000001', 1);
    insert into r (ok, texto) values (false, 'ERRO: recepção gravou o valor pago');
  exception when insufficient_privilege then
    insert into r (ok, texto) values (true, 'recepção NÃO grava o valor pago');
  end;

  begin
    update public.usuarios set papel = 'dona' where id = 'a0000000-0000-0000-0000-00000000000a';
    insert into r (ok, texto) values (false, 'ERRO: recepção se promoveu a dona');
  exception when insufficient_privilege then
    insert into r (ok, texto) values (true, 'recepção NÃO se promove a dona');
  end;

  begin
    update public.usuarios set permissoes = '{"valores": true}' where id = 'a0000000-0000-0000-0000-00000000000a';
    insert into r (ok, texto) values (false, 'ERRO: recepção ligou a própria permissão');
  exception when insufficient_privilege then
    insert into r (ok, texto) values (true, 'recepção NÃO liga permissão para si');
  end;

  update public.usuarios set nome = 'Recepção Teste' where id = 'a0000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  insert into r (ok, texto) values (n = 1, 'recepção muda o próprio nome');

  update public.consultas set status = status where id = '22222222-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  insert into r (ok, texto) values (n = 1, 'recepção altera a agenda de outra profissional');
end $$;
reset role;


-- ===================== RECEPÇÃO COM "valores" LIGADO =====================
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into r (ok, texto) select valor_pago_acumulado is not null, 'recepção com "valores" ligado vê o valor'
    from public.crm_clinica where id = '11111111-0000-0000-0000-000000000001';
end $$;
reset role;


-- ===================== PROFISSIONAL =====================
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  insert into r (ok, texto) select count(*) = 1, 'profissional vê só a própria consulta (viu ' || count(*) || ')'
    from public.consultas where id::text like '22222222-%';
  insert into r (ok, texto) select count(*) = 1, 'profissional vê só a pessoa que ela atende (viu ' || count(*) || ')'
    from public.crm_clinica where id::text like '11111111-%';
  insert into r (ok, texto) select valor_pago_acumulado is null, 'profissional NÃO vê o valor pago'
    from public.crm_clinica where id = '11111111-0000-0000-0000-000000000001';
  insert into r (ok, texto) select count(*) = 0, 'profissional NÃO vê as mensagens'
    from public.mensagens_whatsapp;

  update public.consultas set status = 'realizada' where id = '22222222-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  insert into r (ok, texto) values (n = 0, 'profissional sem "agenda_editar" NÃO dá baixa');
end $$;
reset role;

-- A dona liga "agenda_editar" para a profissional (como o sistema, aqui).
update public.usuarios set permissoes = '{"agenda_editar": true}'
 where id = 'b0000000-0000-0000-0000-00000000000b';

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  update public.consultas set status = 'realizada' where id = '22222222-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  insert into r (ok, texto) values (n = 1, 'profissional com "agenda_editar" dá baixa na própria consulta');

  update public.consultas set status = 'realizada' where id = '22222222-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  insert into r (ok, texto) values (n = 0, 'profissional NÃO mexe na consulta de outra');
end $$;
reset role;

-- O gatilho (agora com a permissão do sistema) atualizou a ficha?
insert into r (ok, texto)
select d.status = 'consulta_realizada', 'a baixa da profissional atualizou a ficha (status ' || d.status || ')'
  from public.crm_clinica_dados d where d.id = '11111111-0000-0000-0000-000000000001';


-- ===================== SEM NADA =====================
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into r (ok, texto) select count(*) = 0, 'sem acesso NÃO vê pessoas'
    from public.crm_clinica where id::text like '11111111-%';
  insert into r (ok, texto) select count(*) = 0, 'sem acesso NÃO vê a agenda'
    from public.consultas where id::text like '22222222-%';
  insert into r (ok, texto) select count(*) = 0, 'sem acesso NÃO vê mensagens'
    from public.mensagens_whatsapp;
end $$;
reset role;


-- ===================== A ÚLTIMA DONA =====================
-- Desliga as outras donas (como o sistema) e a de teste tenta sair.
update public.usuarios set ativo = false
 where papel = 'dona' and id <> 'd0000000-0000-0000-0000-00000000000d';

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    update public.usuarios set papel = 'recepcao' where id = 'd0000000-0000-0000-0000-00000000000d';
    insert into r (ok, texto) values (false, 'ERRO: a última dona deixou de ser dona');
  exception when raise_exception then
    insert into r (ok, texto) values (true, 'a última dona NÃO sai');
  end;
end $$;
reset role;


-- ===================== A CHAVE PÚBLICA (sem login) =====================
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    perform 1 from public.crm_clinica limit 1;
    insert into r (ok, texto) values (false, 'ERRO: a chave pública lê pessoas');
  exception when insufficient_privilege then
    insert into r (ok, texto) values (true, 'chave pública continua sem acesso às pessoas');
  end;
end $$;
reset role;


-- ===================== RESULTADO (e desfaz tudo) =====================
do $$
declare
  falhas int;
  txt text;
begin
  select count(*) filter (where not ok),
         string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt
    from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
