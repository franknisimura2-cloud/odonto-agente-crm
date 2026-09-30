-- Teste da 0042 — quem a Letícia retoma, e quando. Desfaz tudo no fim.

update public.configuracoes_agente
   set ativo = true, modo_teste = false,
       planos_retomar_ativo = true, planos_retomar_dias = 3, planos_retomar_toques = 2,
       followup_inicio = '00:00', followup_fim = '23:59';

insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status, agente_pausado) values
  ('11111111-0000-0000-0000-00000000000a', 'Ana Teste',  '5511900000001', 'consulta_realizada', false),
  ('11111111-0000-0000-0000-00000000000b', 'Bia Teste',  '5511900000002', 'consulta_realizada', false),
  ('11111111-0000-0000-0000-00000000000c', 'Caio Teste', '5511900000003', 'consulta_realizada', false),
  ('11111111-0000-0000-0000-00000000000d', 'Dani Teste', '5511900000004', 'consulta_realizada', false),
  ('11111111-0000-0000-0000-00000000000e', 'Edu Teste',  '5511900000005', 'consulta_realizada', false),
  ('11111111-0000-0000-0000-00000000000f', 'Fábio Teste','5511900000006', 'consulta_realizada', false),
  ('11111111-0000-0000-0000-000000000010', 'Gil Teste',  '5511900000007', 'consulta_realizada', true);

-- A: apresentado há 5 dias, calada          → toque 1, com link
-- B: apresentado há 5 dias, escreveu ontem  → nada (está conversando)
-- C: apresentado ontem                      → nada (cedo)
-- D: aprovado                               → nada
-- E: toque 1 há 4 dias                      → toque 2; depois dele, nada (máximo 2)
-- F: vencido                                → nada
-- G: conversa pausada                       → nada
insert into public.planos_tratamento (id, lead_id, status, apresentado_em, link_base, validade)
select v.id::uuid, v.lead::uuid, v.status, now() - v.ha::interval, 'https://clinica.teste', v.validade::date
from (values
  ('44444444-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-00000000000a', 'apresentado', '5 days', null),
  ('44444444-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-00000000000b', 'apresentado', '5 days', null),
  ('44444444-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-00000000000c', 'apresentado', '1 day',  null),
  ('44444444-0000-0000-0000-00000000000d', '11111111-0000-0000-0000-00000000000d', 'aprovado',    '5 days', null),
  ('44444444-0000-0000-0000-00000000000e', '11111111-0000-0000-0000-00000000000e', 'apresentado', '9 days', null),
  ('44444444-0000-0000-0000-00000000000f', '11111111-0000-0000-0000-00000000000f', 'apresentado', '5 days', '2020-01-01'),
  ('44444444-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000010', 'apresentado', '5 days', null)
) as v (id, lead, status, ha, validade);

-- Um item pendente em cada (no D, aprovado).
insert into public.plano_itens (plano_id, procedimento, etapa, cobertura, valor, status)
select id, 'Teste', 1, 'particular', 100, case when status = 'aprovado' then 'aprovado' else 'pendente' end
  from public.planos_tratamento where id::text like '44444444-%';
-- (o gatilho de status recalcula; D continua aprovado, os outros apresentados)

insert into public.mensagens_whatsapp (lead_id, autor, tipo, conteudo, criada_em)
values ('11111111-0000-0000-0000-00000000000b', 'paciente', 'texto', 'Vou pensar', now() - interval '1 day');
insert into public.agente_planos_retomadas (plano_id, toque, enviado_em)
values ('44444444-0000-0000-0000-00000000000e', 1, now() - interval '4 days');

create temp table r (n serial, ok boolean, texto text);

insert into r (ok, texto)
select count(*) = 1 and bool_and(toque = 1 and link = 'https://clinica.teste/orcamento/' || (select token from public.planos_tratamento where id = '44444444-0000-0000-0000-00000000000a')),
       'A (5 dias calada) → toque 1, com o link completo'
  from public.planos_retomar_pendentes() where plano_id = '44444444-0000-0000-0000-00000000000a';
insert into r (ok, texto)
select count(*) = 0, 'B (escreveu ontem) → nada: está conversando'
  from public.planos_retomar_pendentes() where plano_id = '44444444-0000-0000-0000-00000000000b';
insert into r (ok, texto)
select count(*) = 0, 'C (apresentado ontem) → nada: cedo'
  from public.planos_retomar_pendentes() where plano_id = '44444444-0000-0000-0000-00000000000c';
insert into r (ok, texto)
select count(*) = 0, 'D (aprovado) → nada'
  from public.planos_retomar_pendentes() where plano_id = '44444444-0000-0000-0000-00000000000d';
insert into r (ok, texto)
select count(*) = 1 and bool_and(toque = 2), 'E (toque 1 há 4 dias) → toque 2'
  from public.planos_retomar_pendentes() where plano_id = '44444444-0000-0000-0000-00000000000e';
insert into r (ok, texto)
select count(*) = 0, 'F (vencido) → nada'
  from public.planos_retomar_pendentes() where plano_id = '44444444-0000-0000-0000-00000000000f';
insert into r (ok, texto)
select count(*) = 0, 'G (conversa pausada) → nada'
  from public.planos_retomar_pendentes() where plano_id = '44444444-0000-0000-0000-000000000010';

insert into public.agente_planos_retomadas (plano_id, toque, enviado_em)
values ('44444444-0000-0000-0000-00000000000e', 2, now() - interval '10 days');
insert into r (ok, texto)
select count(*) = 0, 'E depois do toque 2 → nada (máximo de 2 toques)'
  from public.planos_retomar_pendentes() where plano_id = '44444444-0000-0000-0000-00000000000e';

update public.configuracoes_agente set planos_retomar_ativo = false;
insert into r (ok, texto)
select count(*) = 0, 'desligado → fila vazia'
  from public.planos_retomar_pendentes() where plano_id::text like '44444444-%';

-- A ESTRUTURA
insert into r (ok, texto)
select count(*) filter (where schemaname = 'public') = 42,
       'políticas em public: ' || count(*) filter (where schemaname = 'public') || ' (esperado 42)'
  from pg_policies where schemaname in ('public', 'storage');
insert into r (ok, texto)
select not has_function_privilege('authenticated', 'public.planos_retomar_pendentes()', 'execute')
   and not has_function_privilege('anon', 'public.disparar_planos_retomar()', 'execute'),
       'fila e disparo fechados para a equipe e a chave pública';

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
