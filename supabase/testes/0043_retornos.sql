-- Teste da 0043 — o retorno: a data que anda sozinha e quem a Letícia chama.
-- Desfaz tudo no fim.

update public.configuracoes_agente
   set ativo = true, modo_teste = false,
       retornos_ativo = true, retornos_antecedencia = 7, retornos_intervalo_dias = 7, retornos_toques = 2,
       followup_inicio = '00:00', followup_fim = '23:59';

-- O serviço com retorno (6 meses) e um sem.
create temp table s as
select (array_agg(id order by created_at))[1] as limpeza_id, (array_agg(nome order by created_at))[1] as limpeza,
       (array_agg(nome order by created_at))[2] as outro
  from public.servicos_clinica where ativo;
update public.servicos_clinica set retorno_meses = 6 where id = (select limpeza_id from s);
update public.servicos_clinica set retorno_meses = null where nome = (select outro from s);

insert into public.profissionais (id, nome, sobrenome, cor)
values ('f0000000-0000-0000-0000-00000000000f', 'Prof', 'Teste', '#123456');

insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status) values
  ('11111111-0000-0000-0000-00000000000a', 'Ana Teste',  '5511900000001', 'consulta_realizada'),
  ('11111111-0000-0000-0000-00000000000b', 'Bia Teste',  '5511900000002', 'consulta_realizada'),
  ('11111111-0000-0000-0000-00000000000c', 'Caio Teste', '5511900000003', 'consulta_realizada'),
  ('11111111-0000-0000-0000-00000000000d', 'Dani Teste', '5511900000004', 'consulta_realizada');

create temp table r (n serial, ok boolean, texto text);

-- A: limpeza agendada há 6 meses e 3 dias; recebe baixa agora.
insert into public.consultas (id, lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, status)
select '22222222-0000-0000-0000-00000000000a'::uuid, '11111111-0000-0000-0000-00000000000a'::uuid, 'f0000000-0000-0000-0000-00000000000f'::uuid,
       limpeza, now() - interval '6 months 3 days', 30, 'agendada' from s;
update public.consultas set status = 'realizada' where id = '22222222-0000-0000-0000-00000000000a';
insert into r (ok, texto)
select proximo_retorno = ((now() - interval '6 months 3 days') at time zone 'America/Sao_Paulo')::date + interval '6 months'
       and retorno_servico = (select limpeza from s),
       'baixa da limpeza → próximo retorno = data + 6 meses (' || proximo_retorno || ')'
  from public.crm_clinica_dados where id = '11111111-0000-0000-0000-00000000000a';

-- B: serviço SEM retorno, realizado: nada muda.
insert into public.consultas (lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, status)
select '11111111-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-00000000000f', outro, now() - interval '200 days', 30, 'realizada' from s;
insert into r (ok, texto)
select proximo_retorno is null, 'serviço sem retorno não marca data'
  from public.crm_clinica_dados where id = '11111111-0000-0000-0000-00000000000b';

-- Uma limpeza MAIS ANTIGA lançada depois não faz a data voltar.
insert into public.consultas (lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, status)
select '11111111-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-00000000000f', limpeza, now() - interval '2 years', 30, 'realizada' from s;
insert into r (ok, texto)
select proximo_retorno > current_date - 10, 'limpeza antiga lançada depois não faz a data voltar'
  from public.crm_clinica_dados where id = '11111111-0000-0000-0000-00000000000a';

-- A FILA
-- A: retorno vencido há ~3 dias → chamar (toque 1).
insert into r (ok, texto)
select count(*) = 1 and bool_and(toque = 1), 'A (retorno vencido) → toque 1'
  from public.retornos_pendentes() where lead_id = '11111111-0000-0000-0000-00000000000a';

-- C: retorno daqui a 30 dias → cedo.  D: vence em 3 dias mas já tem consulta marcada → nada.
update public.crm_clinica_dados set proximo_retorno = current_date + 30, retorno_servico = 'Limpeza'
 where id = '11111111-0000-0000-0000-00000000000c';
update public.crm_clinica_dados set proximo_retorno = current_date + 3, retorno_servico = 'Limpeza'
 where id = '11111111-0000-0000-0000-00000000000d';
insert into public.consultas (lead_id, profissional_id, procedimento, data_consulta, duracao_minutos, status)
select '11111111-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-00000000000f', limpeza, now() + interval '5 days', 30, 'agendada' from s;
insert into r (ok, texto)
select count(*) = 0, 'C (retorno daqui a 30 dias) → cedo'
  from public.retornos_pendentes() where lead_id = '11111111-0000-0000-0000-00000000000c';
insert into r (ok, texto)
select count(*) = 0, 'D (já tem consulta marcada) → nada'
  from public.retornos_pendentes() where lead_id = '11111111-0000-0000-0000-00000000000d';

-- Depois do toque 1: nada antes do intervalo; toque 2 depois dele; nada depois do 2.
insert into public.agente_retornos (lead_id, para_data, toque, enviado_em)
select id, proximo_retorno, 1, now() - interval '2 days' from public.crm_clinica_dados where id = '11111111-0000-0000-0000-00000000000a';
insert into r (ok, texto)
select count(*) = 0, 'A, 2 dias depois do toque 1 → espera o intervalo'
  from public.retornos_pendentes() where lead_id = '11111111-0000-0000-0000-00000000000a';
update public.agente_retornos set enviado_em = now() - interval '8 days' where lead_id = '11111111-0000-0000-0000-00000000000a';
insert into r (ok, texto)
select count(*) = 1 and bool_and(toque = 2), 'A, 8 dias depois → toque 2'
  from public.retornos_pendentes() where lead_id = '11111111-0000-0000-0000-00000000000a';
insert into public.agente_retornos (lead_id, para_data, toque, enviado_em)
select id, proximo_retorno, 2, now() - interval '30 days' from public.crm_clinica_dados where id = '11111111-0000-0000-0000-00000000000a';
insert into r (ok, texto)
select count(*) = 0, 'A depois do toque 2 → nada (máximo 2)'
  from public.retornos_pendentes() where lead_id = '11111111-0000-0000-0000-00000000000a';

-- Falou ontem à noite: está conversando.
update public.crm_clinica_dados set proximo_retorno = current_date - 1 where id = '11111111-0000-0000-0000-00000000000c';
insert into public.mensagens_whatsapp (lead_id, autor, tipo, conteudo, criada_em)
values ('11111111-0000-0000-0000-00000000000c', 'paciente', 'texto', 'Oi', now() - interval '3 hours');
insert into r (ok, texto)
select count(*) = 0, 'C (falou há 3 horas) → nada: está conversando'
  from public.retornos_pendentes() where lead_id = '11111111-0000-0000-0000-00000000000c';

update public.configuracoes_agente set retornos_ativo = false;
insert into r (ok, texto)
select count(*) = 0, 'desligado → fila vazia'
  from public.retornos_pendentes() where lead_id::text like '11111111-%';

-- A ESTRUTURA
insert into r (ok, texto)
select count(*) filter (where schemaname = 'public') = 43,
       'políticas em public: ' || count(*) filter (where schemaname = 'public') || ' (esperado 43)'
  from pg_policies where schemaname in ('public', 'storage');
insert into r (ok, texto)
select not has_function_privilege('authenticated', 'public.retornos_pendentes()', 'execute')
   and not has_function_privilege('anon', 'public.disparar_retornos()', 'execute'),
       'fila e disparo fechados para a equipe e a chave pública';

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
