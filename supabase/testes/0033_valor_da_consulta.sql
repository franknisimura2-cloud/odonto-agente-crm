-- Teste da 0033 — o valor de cada consulta, por papel. Roda depois da 0031,
-- 0032 e 0033 (`scripts/testar-sql.mjs` junta), e desfaz tudo no fim.

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       v.email, '{}'::jsonb, now(), now()
from (values
  ('d0000000-0000-0000-0000-00000000000d', 'teste-dona@nucleo.test'),
  ('a0000000-0000-0000-0000-00000000000a', 'teste-recepcao@nucleo.test'),
  ('b0000000-0000-0000-0000-00000000000b', 'teste-profissional@nucleo.test')
) as v (id, email);

insert into public.profissionais (id, nome, sobrenome, cor)
values ('f0000000-0000-0000-0000-00000000000f', 'Prof', 'Teste', '#123456'),
       ('f1000000-0000-0000-0000-00000000000f', 'Outra', 'Teste', '#654321');

update public.usuarios set papel = 'dona'     where id = 'd0000000-0000-0000-0000-00000000000d';
update public.usuarios set papel = 'recepcao' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.usuarios set papel = 'profissional', profissional_id = 'f0000000-0000-0000-0000-00000000000f',
       permissoes = '{"valores": true}'   where id = 'b0000000-0000-0000-0000-00000000000b';

insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status)
values ('11111111-0000-0000-0000-000000000001', 'Lead Um Teste', '5511900000001', 'conversando');

insert into public.consultas (id, lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, status, valor_pago)
select v.id::uuid, '11111111-0000-0000-0000-000000000001', v.prof::uuid,
       (select nome from public.servicos_clinica where ativo order by created_at limit 1),
       v.quando::timestamptz, 30, 'agendada', v.valor
from (values
  ('22222222-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000f', '2031-01-06 13:00+00', 300.00),
  ('22222222-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-00000000000f', '2031-01-06 14:00+00', 500.00)
) as v (id, prof, quando, valor);

create temp table r (n serial, ok boolean, texto text);
grant all on r to authenticated;
grant usage, select on sequence r_n_seq to authenticated;

insert into r (ok, texto)
select coalesce(array_agg(p.proname order by p.proname), '{}')
         = array['definir_valor_pago', 'definir_valor_pago_consulta', 'plano_aprovar', 'plano_publico', 'valor_pago_visivel', 'valores_das_consultas']::name[],
       'funções que passam por cima do RLS e a equipe chama: '
       || coalesce(string_agg(p.proname, ', ' order by p.proname), 'nenhuma') || ' (esperado: as quatro dos valores)'
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.prosecdef
   and p.prorettype <> 'trigger'::regtype
   and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));

-- DONA
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into r (ok, texto) select count(*) = 2, 'dona lê as consultas pelas colunas listadas (sem o valor)'
    from (select id, lead_id, procedimento, data_consulta, status, observacoes, profissional_id, duracao_minutos,
                 origem, chave_externa, cancelado_em, motivo_cancelamento, created_at, updated_at, data_fim, interesse
            from public.consultas where id::text like '22222222-%') x;
  insert into r (ok, texto) select sum(valor_pago) = 800, 'dona vê os valores das duas consultas'
    from public.valores_das_consultas(array['22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002']::uuid[]);
  perform public.definir_valor_pago_consulta('22222222-0000-0000-0000-000000000001', 350);
  insert into r (ok, texto) select valor_pago = 350, 'dona grava o valor de uma consulta'
    from public.valores_das_consultas(array['22222222-0000-0000-0000-000000000001']::uuid[]);
  begin
    perform c.valor_pago from public.consultas c limit 1;
    insert into r (ok, texto) values (false, 'ERRO: a coluna do valor da consulta está aberta');
  exception when insufficient_privilege then
    insert into r (ok, texto) values (true, 'coluna do valor da consulta fechada na tabela');
  end;
  begin
    perform * from public.consultas limit 1;
    insert into r (ok, texto) values (false, 'ERRO: select * em consultas ainda funciona (a coluna não fechou)');
  exception when insufficient_privilege then
    insert into r (ok, texto) values (true, 'select * em consultas recusado — a tela precisa listar as colunas');
  end;
end $$;
reset role;

-- RECEPÇÃO (sem valores)
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into r (ok, texto) select count(*) = 0, 'recepção NÃO vê o valor das consultas'
    from public.valores_das_consultas(array['22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002']::uuid[]);
  begin
    perform public.definir_valor_pago_consulta('22222222-0000-0000-0000-000000000001', 1);
    insert into r (ok, texto) values (false, 'ERRO: recepção gravou valor de consulta');
  exception when insufficient_privilege then
    insert into r (ok, texto) values (true, 'recepção NÃO grava valor de consulta');
  end;
  begin
    insert into public.consultas (lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, valor_pago)
    values ('11111111-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-00000000000f',
            (select nome from public.servicos_clinica where ativo order by created_at limit 1),
            '2031-01-07 13:00+00', 30, 999);
    insert into r (ok, texto) values (false, 'ERRO: recepção criou consulta já com valor');
  exception when insufficient_privilege then
    insert into r (ok, texto) values (true, 'recepção NÃO cria consulta com valor embutido');
  end;
end $$;
reset role;

-- PROFISSIONAL com "valores" ligado: só o valor das consultas DELA
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into r (ok, texto) select count(*) = 1 and min(valor_pago) = 350,
         'profissional com "valores" vê só o valor da própria consulta (viu ' || count(*) || ')'
    from public.valores_das_consultas(array['22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002']::uuid[]);
end $$;
reset role;

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
