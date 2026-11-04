-- Teste da 0049 — o follow-up espera a baixa da consulta. Desfaz tudo no fim.

update public.configuracoes_agente set ativo = true, modo_teste = false, followup_ativo = true,
  followup_1_ativo = true, followup_1_minutos = 10, followup_2_ativo = true, followup_2_horas = 24,
  followup_3_ativo = false, followup_inicio = '00:00', followup_fim = '23:59';

create temp table r (n serial, ok boolean, texto text);

insert into public.profissionais (id, nome, sobrenome, cor)
values ('f0000000-0000-0000-0000-00000000000f', 'Prof', 'Teste', '#123456');

create temp table s as
select coalesce((select nome from public.servicos_clinica where ativo order by created_at limit 1), 'Avaliação') as serv;

insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status) values
  ('11111111-0000-0000-0000-0000000000a1', 'Lia Teste',  '5511900000011', 'consulta_agendada'),
  ('11111111-0000-0000-0000-0000000000a2', 'Mel Teste',  '5511900000012', 'consulta_agendada'),
  ('11111111-0000-0000-0000-0000000000a3', 'Nina Teste', '5511900000013', 'consulta_agendada'),
  ('11111111-0000-0000-0000-0000000000a4', 'Olga Teste', '5511900000014', 'conversando');

-- Lia: marcou há 5 dias; a consulta foi há 1 hora, sem baixa.
insert into public.mensagens_whatsapp (lead_id, autor, tipo, conteudo, criada_em) values
  ('11111111-0000-0000-0000-0000000000a1', 'paciente', 'texto', 'Obrigada!', now() - interval '5 days'),
  ('11111111-0000-0000-0000-0000000000a1', 'agente',   'texto', 'Até lá!',   now() - interval '5 days' + interval '1 minute');
insert into public.consultas (lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, status)
select '11111111-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-00000000000f', serv, now() - interval '1 hour', 30, 'agendada' from s;

-- Mel: respondeu ao lembrete de 30 min; a consulta começou há 20 min.
insert into public.mensagens_whatsapp (lead_id, autor, tipo, conteudo, criada_em) values
  ('11111111-0000-0000-0000-0000000000a2', 'paciente', 'texto', 'Ok, estou indo', now() - interval '50 minutes'),
  ('11111111-0000-0000-0000-0000000000a2', 'agente',   'texto', 'Te esperamos!',  now() - interval '49 minutes');
insert into public.consultas (lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, status)
select '11111111-0000-0000-0000-0000000000a2', 'f0000000-0000-0000-0000-00000000000f', serv, now() - interval '20 minutes', 30, 'agendada' from s;

-- Nina: consulta daqui a 3 dias.
insert into public.mensagens_whatsapp (lead_id, autor, tipo, conteudo, criada_em) values
  ('11111111-0000-0000-0000-0000000000a3', 'paciente', 'texto', 'Combinado', now() - interval '2 days'),
  ('11111111-0000-0000-0000-0000000000a3', 'agente',   'texto', 'Até lá!',   now() - interval '2 days' + interval '1 minute');
insert into public.consultas (lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, status)
select '11111111-0000-0000-0000-0000000000a3', 'f0000000-0000-0000-0000-00000000000f', serv, now() + interval '3 days', 30, 'agendada' from s;

-- Olga: nunca marcou, calada há 2 dias.
insert into public.mensagens_whatsapp (lead_id, autor, tipo, conteudo, criada_em) values
  ('11111111-0000-0000-0000-0000000000a4', 'paciente', 'texto', 'Vou pensar', now() - interval '2 days'),
  ('11111111-0000-0000-0000-0000000000a4', 'agente',   'texto', 'Claro!',     now() - interval '2 days' + interval '1 minute');

insert into r (ok, texto) select count(*) = 0, 'consulta que passou há 1 hora, sem baixa: nada'
  from public.followups_pendentes() where lead_id = '11111111-0000-0000-0000-0000000000a1';
insert into r (ok, texto) select count(*) = 0, 'consulta em andamento (começou há 20 min): nada'
  from public.followups_pendentes() where lead_id = '11111111-0000-0000-0000-0000000000a2';
insert into r (ok, texto) select count(*) = 0, 'consulta futura: nada (como antes)'
  from public.followups_pendentes() where lead_id = '11111111-0000-0000-0000-0000000000a3';
insert into r (ok, texto) select count(*) = 1 and min(etapa) = 2, 'quem nunca marcou continua recebendo o follow-up'
  from public.followups_pendentes() where lead_id = '11111111-0000-0000-0000-0000000000a4';

update public.consultas set status = 'faltou' where lead_id = '11111111-0000-0000-0000-0000000000a1';
insert into r (ok, texto) select count(*) = 1, 'baixa Faltou: o follow-up volta, para remarcar'
  from public.followups_pendentes() where lead_id = '11111111-0000-0000-0000-0000000000a1';

update public.consultas set status = 'realizada' where lead_id = '11111111-0000-0000-0000-0000000000a2';
insert into r (ok, texto) select count(*) = 0, 'baixa Compareceu: virou cliente, não recebe follow-up'
  from public.followups_pendentes() where lead_id = '11111111-0000-0000-0000-0000000000a2';

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
