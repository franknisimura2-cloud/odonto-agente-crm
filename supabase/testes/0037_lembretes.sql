-- Teste da 0037 — as regras dos lembretes e a confirmação. Desfaz tudo no fim.

-- Configuração do teste: lembretes ligados, agente ligada, sem modo teste e
-- com janela o dia inteiro (a regra da janela não é o que se testa aqui).
update public.configuracoes_agente
   set lembretes_ativo = true, ativo = true, modo_teste = false,
       lembrete_vespera_ativo = true, lembrete_vespera_horas = 24,
       lembrete_antes_ativo = true, lembrete_antes_minutos = 30,
       lembrete_pedir_confirmacao = true,
       followup_inicio = '00:00', followup_fim = '23:59';

insert into public.profissionais (id, nome, sobrenome, cor)
values ('f0000000-0000-0000-0000-00000000000f', 'Prof', 'Teste', '#123456');

insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status, nao_perturbe)
values ('11111111-0000-0000-0000-000000000001', 'Ana Teste',  '5511900000001', 'conversando', false),
       ('11111111-0000-0000-0000-000000000002', 'Bia Teste',  '5511900000002', 'conversando', false),
       ('11111111-0000-0000-0000-000000000003', 'Caio Teste', '5511900000003', 'conversando', false),
       ('11111111-0000-0000-0000-000000000004', 'Dani Teste', '5511900000004', 'conversando', false),
       ('11111111-0000-0000-0000-000000000005', 'Edu Teste',  '5511900000005', 'conversando', true);

-- A: amanhã (20 h), marcada há 2 dias       → véspera, pedindo confirmação
-- B: daqui a 20 min, marcada há 2 dias      → só o "antes"
-- C: daqui a 50 min, marcada agora          → nada (acabou de combinar)
-- D: amanhã (21 h), cancelada               → nada
-- E: amanhã (22 h), pessoa com nao_perturbe → nada
insert into public.consultas (id, lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, status, created_at)
select v.id::uuid, v.lead::uuid, 'f0000000-0000-0000-0000-00000000000f',
       (select nome from public.servicos_clinica where ativo order by created_at limit 1),
       now() + v.daqui::interval, 15, v.status, now() - v.marcada::interval
from (values
  ('22222222-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000001', '20 hours',   'agendada',  '2 days'),
  ('22222222-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-000000000002', '20 minutes', 'agendada',  '2 days'),
  ('22222222-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-000000000003', '50 minutes', 'agendada',  '0 minutes'),
  ('22222222-0000-0000-0000-00000000000d', '11111111-0000-0000-0000-000000000004', '21 hours',   'cancelada', '2 days'),
  ('22222222-0000-0000-0000-00000000000e', '11111111-0000-0000-0000-000000000005', '22 hours',   'agendada',  '2 days')
) as v (id, lead, daqui, status, marcada);

create temp table r (n serial, ok boolean, texto text);

insert into r (ok, texto)
select count(*) = 1 and bool_and(etapa = 'vespera' and pedir_confirmacao),
       'A (amanhã, marcada antes) recebe a véspera, pedindo confirmação'
  from public.lembretes_pendentes() where consulta_id = '22222222-0000-0000-0000-00000000000a';
insert into r (ok, texto)
select count(*) = 1 and bool_and(etapa = 'antes'),
       'B (daqui a 20 min) recebe só o "antes" (' || count(*) || ')'
  from public.lembretes_pendentes() where consulta_id = '22222222-0000-0000-0000-00000000000b';
insert into r (ok, texto)
select count(*) = 0, 'C (marcada agora) não recebe nada'
  from public.lembretes_pendentes() where consulta_id = '22222222-0000-0000-0000-00000000000c';
insert into r (ok, texto)
select count(*) = 0, 'D (cancelada) não recebe nada'
  from public.lembretes_pendentes() where consulta_id = '22222222-0000-0000-0000-00000000000d';
insert into r (ok, texto)
select count(*) = 0, 'E (pediu para não ser procurada) não recebe nada'
  from public.lembretes_pendentes() where consulta_id = '22222222-0000-0000-0000-00000000000e';

-- Antes do lembrete, um SIM não confirma nada (ninguém pediu).
insert into r (ok, texto)
select count(*) = 0, 'SIM sem lembrete pedindo confirmação não confirma nada'
  from public.confirmar_presenca('11111111-0000-0000-0000-000000000001');

-- O lembrete da véspera sai (a função grava a reserva assim).
insert into public.agente_lembretes (consulta_id, etapa, para_data, pediu_confirmacao)
select id, 'vespera', data_consulta, true from public.consultas where id = '22222222-0000-0000-0000-00000000000a';

insert into r (ok, texto)
select count(*) = 0, 'depois de enviada, a véspera de A sai da fila'
  from public.lembretes_pendentes() where consulta_id = '22222222-0000-0000-0000-00000000000a';

insert into r (ok, texto)
select count(*) = 1, 'o SIM de A confirma a consulta dela'
  from public.confirmar_presenca('11111111-0000-0000-0000-000000000001');
insert into r (ok, texto)
select confirmada_em is not null, 'A aparece como confirmada'
  from public.consultas where id = '22222222-0000-0000-0000-00000000000a';
insert into r (ok, texto)
select count(*) = 0, 'um segundo SIM não confirma de novo'
  from public.confirmar_presenca('11111111-0000-0000-0000-000000000001');

-- Remarcou: a confirmação cai e a data nova ganha a véspera dela.
update public.consultas set data_consulta = data_consulta + interval '1 hour'
 where id = '22222222-0000-0000-0000-00000000000a';
insert into r (ok, texto)
select confirmada_em is null, 'remarcar apaga a confirmação'
  from public.consultas where id = '22222222-0000-0000-0000-00000000000a';
insert into r (ok, texto)
select count(*) = 1, 'a data nova volta a ter véspera'
  from public.lembretes_pendentes() where consulta_id = '22222222-0000-0000-0000-00000000000a';

-- Desligado, ninguém recebe.
update public.configuracoes_agente set lembretes_ativo = false;
insert into r (ok, texto)
select count(*) = 0, 'com os lembretes desligados, a fila fica vazia'
  from public.lembretes_pendentes() where consulta_id::text like '22222222-%';

-- A estrutura
insert into r (ok, texto)
select count(*) filter (where schemaname = 'public') = 42,
       'políticas em public: ' || count(*) filter (where schemaname = 'public') || ' (esperado 42)'
  from pg_policies where schemaname in ('public', 'storage');
insert into r (ok, texto)
select not has_function_privilege('authenticated', 'public.lembretes_pendentes()', 'execute')
   and not has_function_privilege('authenticated', 'public.confirmar_presenca(uuid)', 'execute')
   and not has_function_privilege('anon', 'public.disparar_lembretes()', 'execute'),
       'fila, confirmação e disparo fechados para a equipe e a chave pública';

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
