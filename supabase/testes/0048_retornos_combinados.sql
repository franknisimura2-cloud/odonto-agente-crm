-- Teste da 0048 — o retorno combinado: a fila, a reserva e o que a equipe pode fazer. Desfaz tudo no fim.

-- Agente ligada, sem modo teste, chave do retorno ligada e janela o dia
-- inteiro (a janela não é o que se testa aqui).
update public.configuracoes_agente
   set ativo = true, modo_teste = false, retornos_combinados_ativo = true,
       followup_inicio = '00:00', followup_fim = '23:59';

-- "Hoje" é o da clínica, como na função (o banco roda em UTC).
create temp table hoje as
  select (now() at time zone coalesce((select nullif(fuso_horario, '') from public.configuracoes_clinica limit 1), 'America/Sao_Paulo'))::date as d;
grant select on hoje to authenticated;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       v.email, '{}'::jsonb, now(), now()
from (values
  ('a0000000-0000-0000-0000-00000000000a', 'teste-recepcao@odonto.test'),
  ('b0000000-0000-0000-0000-00000000000b', 'teste-profissional@odonto.test')
) as v (id, email);
update public.usuarios set papel = 'recepcao' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.usuarios set papel = 'profissional' where id = 'b0000000-0000-0000-0000-00000000000b';

insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status, nao_perturbe)
values ('11111111-0000-0000-0000-000000000001', 'Ana Teste',  '5511900000001', 'conversando', false),
       ('11111111-0000-0000-0000-000000000002', 'Bia Teste',  '5511900000002', 'conversando', true),
       ('11111111-0000-0000-0000-000000000003', 'Caio Teste', '5511900000003', 'conversando', false),
       ('11111111-0000-0000-0000-000000000004', 'Dani Teste', '5511900000004', 'conversando', false),
       ('11111111-0000-0000-0000-000000000005', 'Edu Teste',  '5511900000005', 'conversando', false),
       ('11111111-0000-0000-0000-000000000006', 'Fê Teste',   '5511900000006', 'conversando', false),
       ('11111111-0000-0000-0000-000000000007', 'Gil Teste',  '5511900000007', 'conversando', false);

-- Caio falou com a clínica há 2 horas.
insert into public.mensagens_whatsapp (lead_id, autor, tipo, conteudo, criada_em)
values ('11111111-0000-0000-0000-000000000003', 'paciente', 'texto', 'oi', now() - interval '2 hours');

-- Os retornos. Os de data passada nascem para amanhã e o servidor (este
-- teste roda como dono do banco) puxa a data para trás.
insert into public.retornos_combinados (id, lead_id, para_data, motivo, created_at)
select v.id::uuid, v.lead::uuid, (select d from hoje) + 1, v.motivo, now() - v.criado::interval
from (values
  ('33333333-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000001', 'Depois da viagem',        '3 days'),
  ('33333333-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-000000000002', 'Pediu para ligar depois', '3 days'),
  ('33333333-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-000000000003', 'Pensar no tratamento',    '3 days'),
  ('33333333-0000-0000-0000-0000000000d1', '11111111-0000-0000-0000-000000000004', 'Primeiro assunto',        '3 days'),
  ('33333333-0000-0000-0000-0000000000d2', '11111111-0000-0000-0000-000000000004', 'Segundo assunto',         '1 day'),
  ('33333333-0000-0000-0000-00000000000e', '11111111-0000-0000-0000-000000000005', 'Promoção de verão',       '3 days'),
  ('33333333-0000-0000-0000-00000000000f', '11111111-0000-0000-0000-000000000006', 'Atrasado demais',         '3 days'),
  ('33333333-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000007', 'Ainda não chegou o dia',  '3 days')
) as v (id, lead, motivo, criado);

update public.retornos_combinados set para_data = (select d from hoje)
 where id in ('33333333-0000-0000-0000-00000000000a', '33333333-0000-0000-0000-00000000000b',
              '33333333-0000-0000-0000-00000000000c', '33333333-0000-0000-0000-0000000000d1',
              '33333333-0000-0000-0000-0000000000d2');
update public.retornos_combinados set para_data = (select d from hoje) - 5  where id = '33333333-0000-0000-0000-00000000000e';
update public.retornos_combinados set para_data = (select d from hoje) - 20 where id = '33333333-0000-0000-0000-00000000000f';
update public.retornos_combinados set para_data = (select d from hoje) + 30 where id = '33333333-0000-0000-0000-000000000007';

create temp table r (n serial, ok boolean, texto text);
grant all on r to authenticated;
grant usage on sequence r_n_seq to authenticated;

create temp view fila as
  select * from public.retornos_combinados_pendentes() where lead_id::text like '11111111-%';

-- ── A fila ──────────────────────────────────────────────────────────────────
insert into r (ok, texto) select count(*) = 1, 'Ana (hoje) está na fila' from fila where nome = 'Ana Teste';
insert into r (ok, texto) select count(*) = 0, 'Bia (pediu para não ser procurada) não está' from fila where nome = 'Bia Teste';
insert into r (ok, texto) select count(*) = 0, 'Caio (falou há 2 h) espera a conversa esfriar' from fila where nome = 'Caio Teste';
insert into r (ok, texto)
select count(*) = 1 and bool_and(motivo = 'Primeiro assunto'), 'Dani (dois no mesmo dia) recebe um por vez, o mais antigo primeiro'
  from fila where nome = 'Dani Teste';
insert into r (ok, texto) select count(*) = 1, 'Edu (atrasado 5 dias) ainda sai' from fila where nome = 'Edu Teste';
insert into r (ok, texto) select count(*) = 0, 'Fê (atrasado 20 dias) não sai sozinho' from fila where nome = 'Fê Teste';
insert into r (ok, texto) select count(*) = 0, 'Gil (daqui a 30 dias) ainda não' from fila where nome = 'Gil Teste';

-- ── Reservar e devolver ─────────────────────────────────────────────────────
insert into r (ok, texto)
select public.retorno_combinado_reservar('33333333-0000-0000-0000-00000000000a'), 'a primeira reserva de Ana pega';
insert into r (ok, texto)
select not public.retorno_combinado_reservar('33333333-0000-0000-0000-00000000000a'), 'a segunda reserva de Ana não pega (sem mensagem dobrada)';
insert into r (ok, texto) select count(*) = 0, 'reservada, Ana sai da fila' from fila where nome = 'Ana Teste';
select public.retorno_combinado_devolver('33333333-0000-0000-0000-00000000000a');
insert into r (ok, texto) select count(*) = 1, 'o envio falhou e foi devolvido: Ana volta para a fila' from fila where nome = 'Ana Teste';

-- Dani: o primeiro saiu, o segundo vem na rodada seguinte.
select public.retorno_combinado_reservar('33333333-0000-0000-0000-0000000000d1');
update public.retornos_combinados set texto = 'Oi, Dani!' where id = '33333333-0000-0000-0000-0000000000d1';
insert into r (ok, texto)
select count(*) = 1 and bool_and(motivo = 'Segundo assunto'), 'depois do primeiro, Dani recebe o segundo'
  from fila where nome = 'Dani Teste';
select public.retorno_combinado_devolver('33333333-0000-0000-0000-0000000000d1');
insert into r (ok, texto)
select situacao = 'enviado', 'devolver não desfaz o que já saiu com texto'
  from public.retornos_combinados where id = '33333333-0000-0000-0000-0000000000d1';

-- ── A recepção, pela tela ───────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

insert into public.retornos_combinados (id, lead_id, para_data, motivo, situacao, texto)
values ('44444444-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000001', (select d from hoje) + 60, '  Avaliar a manutenção  ', 'enviado', 'forjado');
insert into r (ok, texto)
select situacao = 'agendado' and texto is null and criado_por = 'a0000000-0000-0000-0000-00000000000a' and motivo = 'Avaliar a manutenção',
       'a recepção cria: nasce agendado, com ela de autora (e não dá para forjar "enviado")'
  from public.retornos_combinados where id = '44444444-0000-0000-0000-00000000000a';

do $$ begin
  insert into public.retornos_combinados (lead_id, para_data, motivo)
  values ('11111111-0000-0000-0000-000000000001', (select d from hoje) - 1, 'Ontem');
  insert into r (ok, texto) values (false, 'data no passado deveria ser recusada');
exception when others then
  insert into r (ok, texto) values (true, 'data no passado é recusada');
end $$;

do $$ begin
  update public.retornos_combinados set situacao = 'enviado' where id = '44444444-0000-0000-0000-00000000000a';
  insert into r (ok, texto) values (false, 'a tela marcar "enviado" deveria ser recusado');
exception when others then
  insert into r (ok, texto) values (true, 'a tela não marca "enviado"');
end $$;

update public.retornos_combinados set para_data = (select d from hoje) + 90, motivo = 'Avaliar a manutenção de março'
 where id = '44444444-0000-0000-0000-00000000000a';
insert into r (ok, texto)
select para_data = (select d from hoje) + 90, 'enquanto agendado, data e motivo mudam'
  from public.retornos_combinados where id = '44444444-0000-0000-0000-00000000000a';

update public.retornos_combinados set situacao = 'cancelado' where id = '44444444-0000-0000-0000-00000000000a';
insert into r (ok, texto)
select cancelado_em is not null and cancelado_por = 'a0000000-0000-0000-0000-00000000000a',
       'cancelar guarda quando e quem'
  from public.retornos_combinados where id = '44444444-0000-0000-0000-00000000000a';

do $$ begin
  update public.retornos_combinados set situacao = 'agendado' where id = '44444444-0000-0000-0000-00000000000a';
  insert into r (ok, texto) values (false, 'o cancelado deveria ficar cancelado');
exception when others then
  insert into r (ok, texto) values (true, 'o cancelado não volta pela tela');
end $$;

delete from public.retornos_combinados where id = '44444444-0000-0000-0000-00000000000a';
insert into r (ok, texto)
select count(*) = 1, 'ninguém apaga pela tela'
  from public.retornos_combinados where id = '44444444-0000-0000-0000-00000000000a';

-- ── A profissional (só a própria agenda) não vê nem cria ────────────────────
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
insert into r (ok, texto)
select count(*) = 0, 'a profissional não vê os retornos' from public.retornos_combinados;
do $$ begin
  insert into public.retornos_combinados (lead_id, para_data, motivo)
  values ('11111111-0000-0000-0000-000000000001', (select d from hoje) + 10, 'Tentativa');
  insert into r (ok, texto) values (false, 'a profissional não deveria criar');
exception when others then
  insert into r (ok, texto) values (true, 'a profissional não cria');
end $$;

reset role;

-- ── Desligado, ninguém recebe ───────────────────────────────────────────────
update public.configuracoes_agente set retornos_combinados_ativo = false;
insert into r (ok, texto) select count(*) = 0, 'com a chave desligada, a fila fica vazia' from fila;

-- ── A estrutura ─────────────────────────────────────────────────────────────
insert into r (ok, texto)
select not has_function_privilege('authenticated', 'public.retornos_combinados_pendentes()', 'execute')
   and not has_function_privilege('authenticated', 'public.retorno_combinado_reservar(uuid)', 'execute')
   and not has_function_privilege('authenticated', 'public.retorno_combinado_devolver(uuid)', 'execute')
   and not has_function_privilege('anon', 'public.disparar_retornos_combinados()', 'execute'),
       'fila, reserva e disparo fechados para a equipe e a chave pública';
insert into r (ok, texto)
select (select retornos_combinados_ativo from public.configuracoes_agente limit 1) is false
       and (select column_default from information_schema.columns
             where table_name = 'configuracoes_agente' and column_name = 'retornos_combinados_ativo') = 'false',
       'a chave nasce desligada';

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
