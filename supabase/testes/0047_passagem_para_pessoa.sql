-- Teste da 0047 — a passagem para uma pessoa: a marca aparece na lista e na
-- ficha, e some sozinha quando alguém assume ou devolve. Desfaz tudo no fim.

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'teste-recepcao@crm.test', '{}'::jsonb, now(), now());
update public.usuarios set papel = 'recepcao', nome = 'Recepção Teste' where id = 'a0000000-0000-0000-0000-00000000000a';

insert into public.crm_clinica_dados (id, nome_lead, whatsapp_lead, status) values
  ('11111111-0000-0000-0000-00000000000a', 'Ana Teste', '5511900000001', 'conversando'),
  ('11111111-0000-0000-0000-00000000000b', 'Bia Teste', '5511900000002', 'conversando');
insert into public.mensagens_whatsapp (lead_id, autor, tipo, conteudo) values
  ('11111111-0000-0000-0000-00000000000a', 'paciente', 'texto', 'Quero falar com alguém'),
  ('11111111-0000-0000-0000-00000000000b', 'paciente', 'texto', 'Tenho uma reclamação');

-- O que a ferramenta faz (pela chave de serviço): pausa e marca.
update public.crm_clinica_dados
   set agente_pausado = true, passagem_em = now(), passagem_motivo = 'Pediu para falar com uma pessoa'
 where id in ('11111111-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-00000000000b');

create temp table r (n serial, ok boolean, texto text);
grant all on r to authenticated;
grant usage, select on sequence r_n_seq to authenticated;

-- A RECEPÇÃO vê a marca na lista e na ficha
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into r (ok, texto) select count(*) = 2, 'a lista de conversas mostra as duas esperando a equipe'
    from public.conversas_lista where passagem_em is not null and lead_id::text like '11111111-%';
  insert into r (ok, texto) select passagem_motivo = 'Pediu para falar com uma pessoa', 'a ficha traz o motivo'
    from public.crm_clinica where id = '11111111-0000-0000-0000-00000000000a';

  -- Assumir apaga a marca.
  update public.crm_clinica set assumido_por = 'a0000000-0000-0000-0000-00000000000a', assumido_em = now()
   where id = '11111111-0000-0000-0000-00000000000a';
  insert into r (ok, texto) select passagem_em is null and passagem_motivo is null and agente_pausado,
         'assumir apaga a marca (e a conversa segue pausada, com quem assumiu)'
    from public.crm_clinica where id = '11111111-0000-0000-0000-00000000000a';

  -- Devolver para a atendente também apaga.
  update public.crm_clinica set agente_pausado = false where id = '11111111-0000-0000-0000-00000000000b';
  insert into r (ok, texto) select passagem_em is null, 'devolver para a atendente apaga a marca'
    from public.crm_clinica where id = '11111111-0000-0000-0000-00000000000b';
end $$;
reset role;

-- Pausar de novo NÃO apaga uma marca nova (é o que a ferramenta faz).
update public.crm_clinica_dados set agente_pausado = true, passagem_em = now(), passagem_motivo = 'Urgência'
 where id = '11111111-0000-0000-0000-00000000000b';
insert into r (ok, texto)
select passagem_em is not null, 'pausar e marcar de novo mantém a marca nova'
  from public.crm_clinica_dados where id = '11111111-0000-0000-0000-00000000000b';

insert into r (ok, texto)
select (select passagem_avisar from public.configuracoes_agente limit 1) is not null, 'a lista de quem avisar existe (vazia por padrão)';
insert into r (ok, texto)
select not has_table_privilege('anon', 'public.conversas_lista', 'select'), 'a chave pública não lê a lista de conversas';

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
