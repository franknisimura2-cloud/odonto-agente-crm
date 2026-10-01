-- Teste da 0046 — follow-up em três etapas: cada etapa no seu prazo, sem
-- atropelar a outra, e a chave geral. Desfaz tudo no fim.

update public.configuracoes_agente
   set ativo = true, modo_teste = false,
       followup_ativo = true,
       followup_1_ativo = true, followup_1_minutos = 10,
       followup_2_ativo = true, followup_2_horas = 24,
       followup_3_ativo = true, followup_3_dias = 3,
       followup_inicio = '00:00', followup_fim = '23:59';

insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status) values
  ('11111111-0000-0000-0000-00000000000a', 'Ana Teste',  '5511900000001', 'conversando'),
  ('11111111-0000-0000-0000-00000000000b', 'Bia Teste',  '5511900000002', 'conversando'),
  ('11111111-0000-0000-0000-00000000000c', 'Caio Teste', '5511900000003', 'conversando'),
  ('11111111-0000-0000-0000-00000000000e', 'Edu Teste',  '5511900000005', 'conversando');

-- A pessoa escreveu há X; a clínica respondeu logo depois (a última palavra é da clínica).
-- A: 20 min · B: 30 h · C: 4 dias · E: 4 dias, e já recebeu a etapa 3.
insert into public.mensagens_whatsapp (lead_id, autor, tipo, conteudo, criada_em)
select v.lead::uuid, a.autor, 'texto', 'oi', now() - v.ha::interval + a.depois::interval
from (values
  ('11111111-0000-0000-0000-00000000000a', '20 minutes'),
  ('11111111-0000-0000-0000-00000000000b', '30 hours'),
  ('11111111-0000-0000-0000-00000000000c', '4 days'),
  ('11111111-0000-0000-0000-00000000000e', '4 days')
) as v (lead, ha)
cross join (values ('paciente', '0 seconds'), ('agente', '1 minute')) as a (autor, depois);

insert into public.agente_followups (lead_id, etapa, enviado_em)
values ('11111111-0000-0000-0000-00000000000e', 3, now() - interval '1 hour');

create temp table r (n serial, ok boolean, texto text);

insert into r (ok, texto)
select count(*) = 1 and bool_and(etapa = 1 and not ultima), 'A (20 min) → etapa 1'
  from public.followups_pendentes() where lead_id = '11111111-0000-0000-0000-00000000000a';
insert into r (ok, texto)
select count(*) = 1 and bool_and(etapa = 2 and not ultima), 'B (30 h) → etapa 2, e não é a última (a 3 está ligada)'
  from public.followups_pendentes() where lead_id = '11111111-0000-0000-0000-00000000000b';
insert into r (ok, texto)
select count(*) = 1 and bool_and(etapa = 3 and ultima), 'C (4 dias) → só a etapa 3, a última — sem receber a 2 junto'
  from public.followups_pendentes() where lead_id = '11111111-0000-0000-0000-00000000000c';
insert into r (ok, texto)
select count(*) = 0, 'E (já recebeu a 3) → nada'
  from public.followups_pendentes() where lead_id = '11111111-0000-0000-0000-00000000000e';

-- Etapa 3 desligada: C (4 dias) cai na etapa 2, que vira a última.
update public.configuracoes_agente set followup_3_ativo = false;
insert into r (ok, texto)
select count(*) = 1 and bool_and(etapa = 2 and ultima), 'etapa 3 desligada: C → etapa 2, agora a última'
  from public.followups_pendentes() where lead_id = '11111111-0000-0000-0000-00000000000c';

-- Etapa 1 desligada: A (20 min) não recebe nada.
update public.configuracoes_agente set followup_1_ativo = false;
insert into r (ok, texto)
select count(*) = 0, 'etapa 1 desligada: A (20 min) → nada'
  from public.followups_pendentes() where lead_id = '11111111-0000-0000-0000-00000000000a';

-- Chave geral desligada: ninguém.
update public.configuracoes_agente set followup_1_ativo = true, followup_3_ativo = true, followup_ativo = false;
insert into r (ok, texto)
select count(*) = 0, 'follow-up desligado → fila vazia'
  from public.followups_pendentes() where lead_id::text like '11111111-%';

-- Prazos fora de ordem são recusados.
do $$
begin
  update public.configuracoes_agente set followup_2_horas = 100, followup_3_dias = 2;
  insert into r (ok, texto) values (false, 'ERRO: aceitou etapa 2 (100 h) depois da etapa 3 (2 dias)');
exception when check_violation then
  insert into r (ok, texto) values (true, 'prazos fora de ordem recusados (etapa 2 depois da 3)');
end $$;

insert into r (ok, texto)
select not has_function_privilege('authenticated', 'public.followups_pendentes()', 'execute')
   and not has_function_privilege('anon', 'public.followups_pendentes()', 'execute'),
       'a fila continua fechada para a equipe e a chave pública';

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
