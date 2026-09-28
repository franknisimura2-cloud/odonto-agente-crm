-- =============================================================================
-- 0031 — Níveis de acesso: dona, recepção, profissional
-- =============================================================================
--
-- ATÉ AQUI, todo usuário com login lia e alterava tudo: as políticas diziam
-- `using (true)`. A partir daqui cada usuário tem um PAPEL e, por cima dele,
-- permissões ligadas ou desligadas uma a uma. Quem decide é a dona.
--
-- ⚠️ A TRAVA É AQUI, NO BANCO — não na tela. Esconder um menu não impede
-- ninguém: a sessão do navegador fala com o Supabase direto. Cada política
-- abaixo pergunta `public.pode('...')`, e a tela só acompanha.
--
-- ── AS PERMISSÕES ───────────────────────────────────────────────────────────
--
--   dashboard      os números do Dashboard
--   valores        o valor pago de cada pessoa (o faturamento)
--   conversas      ler e responder as conversas do WhatsApp
--   agenda_todas   ver a agenda de todas as profissionais
--   agenda_editar  marcar, remarcar, cancelar, dar baixa (na agenda que vê)
--   pessoas        Leads, Clientes e as fichas
--   crm            o funil
--   exportar       CSV e PDF
--   configurar     Configurações, Serviços, Profissionais, Atendente, Token
--   equipe         convidar pessoas e mudar os acessos
--
-- A profissional ligada a um cadastro de Profissionais (`profissional_id`)
-- vê SEMPRE a própria agenda e as fichas de quem ela atende — sem precisar
-- de permissão para isso.
--
-- ── OS PAPÉIS (o ponto de partida; a dona ajusta por pessoa) ────────────────
--
--   dona          tudo, sempre — as permissões individuais não a limitam
--   recepcao      conversas, agenda_todas, agenda_editar, pessoas
--   profissional  nada além da própria agenda
--
-- ── QUEM JÁ EXISTIA ─────────────────────────────────────────────────────────
--
-- Todo usuário que existia antes desta migração vira DONA: ninguém perde
-- acesso no dia da atualização. A dona ajusta a equipe depois.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. O usuário ganha papel, permissões, o vínculo com a profissional e a chave
--    de desligar
-- -----------------------------------------------------------------------------

alter table public.usuarios
  add column if not exists papel text not null default 'profissional',
  add column if not exists permissoes jsonb not null default '{}'::jsonb,
  add column if not exists profissional_id uuid references public.profissionais(id) on delete set null,
  add column if not exists ativo boolean not null default true;

alter table public.usuarios drop constraint if exists usuarios_papel_valido;
alter table public.usuarios add constraint usuarios_papel_valido
  check (papel in ('dona', 'recepcao', 'profissional'));

-- `permissoes` é um objeto { "valores": true, "crm": false }: só o que a dona
-- mudou em relação ao papel. Chave ausente = vale o padrão do papel.
alter table public.usuarios drop constraint if exists usuarios_permissoes_objeto;
alter table public.usuarios add constraint usuarios_permissoes_objeto
  check (jsonb_typeof(permissoes) = 'object');

-- Uma profissional, um login. Dois logins na mesma agenda seria uma pessoa
-- com duas senhas — e o dia em que uma sai, a outra continua entrando.
create unique index if not exists usuarios_profissional_unico
  on public.usuarios (profissional_id) where profissional_id is not null;

-- Quem já estava aqui vira dona (ver o cabeçalho).
update public.usuarios set papel = 'dona';


-- -----------------------------------------------------------------------------
-- 2. As perguntas que as políticas fazem
-- -----------------------------------------------------------------------------

-- O padrão de cada papel. `immutable`: é uma tabela escrita em código.
create or replace function public.permissao_padrao(p_papel text, p_permissao text)
returns boolean
language sql
immutable
as $$
  select case p_papel
    when 'dona'         then true
    when 'recepcao'     then p_permissao in ('conversas', 'agenda_todas', 'agenda_editar', 'pessoas')
    when 'profissional' then false
    else false
  end
$$;

-- "O usuário desta sessão pode X?"
--
-- SECURITY INVOKER de propósito: ela só lê `usuarios`, que toda a equipe já
-- pode ler. Assim não entra na lista de funções que passam por cima do RLS
-- (a conferência da seção 10 do DATABASE.md).
--
-- Usuário desligado (`ativo = false`) ou sem linha em `usuarios` não pode
-- nada. Sessão sem usuário (a chave pública) também não.
create or replace function public.pode(p_permissao text)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((
    select case
      when u.papel = 'dona' then true
      else coalesce((u.permissoes ->> p_permissao)::boolean,
                    public.permissao_padrao(u.papel, p_permissao))
    end
    from public.usuarios u
    where u.id = auth.uid() and u.ativo
  ), false)
$$;

-- O cadastro de Profissionais ligado a este login — `null` para quem não é
-- profissional. É o que faz o "só a minha agenda".
create or replace function public.meu_profissional()
returns uuid
language sql
stable
set search_path = public
as $$
  select u.profissional_id from public.usuarios u where u.id = auth.uid() and u.ativo
$$;

revoke all on function public.pode(text) from public, anon;
revoke all on function public.meu_profissional() from public, anon;
revoke all on function public.permissao_padrao(text, text) from public, anon;
grant execute on function public.pode(text) to authenticated, service_role;
grant execute on function public.meu_profissional() to authenticated, service_role;
grant execute on function public.permissao_padrao(text, text) to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 3. Ninguém muda o próprio acesso — e a última dona não sai
-- -----------------------------------------------------------------------------
--
-- A política `usuarios_update_own` deixa cada um editar a própria linha (nome,
-- foto). Sem esta trava, "editar a própria linha" incluiria `papel = 'dona'`.
-- Política não escolhe coluna; gatilho escolhe.
--
-- Quem é barrado é o PAPEL `authenticated` — a equipe, pelo site. O próprio
-- sistema (a função com a chave de serviço, o SQL Editor, as migrações) roda
-- com outro papel e passa.
--
-- ⚠️ Não troque por "`auth.uid()` nulo = sistema". O SQL Editor e a API de
-- gerenciamento mandam uma identificação de sessão mesmo sem usuário do
-- sistema, e a trava barraria o próprio dono do banco — foi o que o teste da
-- 0031 pegou.

create or replace function public.usuarios_protege_acesso()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.papel, new.permissoes, new.profissional_id, new.ativo)
     is distinct from (old.papel, old.permissoes, old.profissional_id, old.ativo) then

    if current_user = 'authenticated' and not public.pode('equipe') then
      raise exception 'sem_permissao: só quem gerencia a equipe muda os acessos'
        using errcode = '42501';
    end if;

    if old.papel = 'dona' and old.ativo
       and (new.papel <> 'dona' or not new.ativo)
       and not exists (
         select 1 from public.usuarios u
          where u.papel = 'dona' and u.ativo and u.id <> old.id
       ) then
      raise exception 'ultima_dona: a empresa precisa de pelo menos uma dona ativa'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists usuarios_protege_acesso on public.usuarios;
create trigger usuarios_protege_acesso
  before update on public.usuarios
  for each row execute function public.usuarios_protege_acesso();

-- Quem gerencia a equipe edita a linha dos outros (o gatilho acima continua
-- valendo para os campos de acesso).
drop policy if exists "usuarios_update_equipe" on public.usuarios;
create policy "usuarios_update_equipe" on public.usuarios
  for update to authenticated
  using ((select public.pode('equipe'))) with check ((select public.pode('equipe')));


-- -----------------------------------------------------------------------------
-- 4. O usuário novo: a primeira pessoa é dona; as seguintes nascem sem nada
-- -----------------------------------------------------------------------------
--
-- "Sem nada" é o papel profissional sem cadastro ligado: entra e não vê dado
-- nenhum até a dona escolher o acesso. Nascer com acesso e depois perder é o
-- contrário do que se quer num sistema com dados de saúde.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    case when exists (select 1 from public.usuarios where papel = 'dona' and ativo)
         then 'profissional' else 'dona' end
  );
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. O gatilho da agenda passa a rodar como o sistema
-- -----------------------------------------------------------------------------
--
-- Ele atualiza a ficha do lead quando uma consulta muda. Rodando como quem
-- editou, uma profissional com `agenda_editar` e sem acesso às fichas daria
-- baixa numa consulta e o UPDATE da ficha seria filtrado pelo RLS — ZERO
-- linhas, sem erro. A ficha ficaria parada em "Agendou" para sempre.

alter function public.sincronizar_agendamento_lead() security definer;
alter function public.sincronizar_agendamento_lead() set search_path = public;


-- -----------------------------------------------------------------------------
-- 6. As políticas, tabela por tabela
-- -----------------------------------------------------------------------------
--
-- `(select public.pode('x'))`, entre parênteses: o Postgres calcula uma vez
-- por consulta, e não uma vez por linha.

-- As tabelas de CADASTRO: toda a equipe lê (a agenda precisa dos horários, a
-- conversa precisa do nome da empresa); só quem configura altera.
do $$
declare
  t text;
  antiga text;
begin
  for t, antiga in values
    ('configuracoes_clinica',  'clinica_all'),
    ('horario_comercial',      'horario_all'),
    ('servicos_clinica',       'servicos_all'),
    ('profissionais',          'profissionais_all'),
    ('profissional_horarios',  'profissional_horarios_all'),
    ('profissional_servicos',  'profissional_servicos_all'),
    ('configuracoes_agente',   'configuracoes_agente_all')
  loop
    execute format('drop policy if exists %I on public.%I', antiga, t);
    execute format('drop policy if exists %I on public.%I', t || '_le', t);
    execute format('drop policy if exists %I on public.%I', t || '_altera', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_le', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using ((select public.pode(''configurar''))) with check ((select public.pode(''configurar'')))',
      t || '_altera', t);
  end loop;
end $$;

-- Bloqueios (férias, almoço): quem configura OU quem mexe na agenda.
drop policy if exists "profissional_bloqueios_all" on public.profissional_bloqueios;
drop policy if exists "profissional_bloqueios_le" on public.profissional_bloqueios;
drop policy if exists "profissional_bloqueios_altera" on public.profissional_bloqueios;
create policy "profissional_bloqueios_le" on public.profissional_bloqueios
  for select to authenticated using (true);
create policy "profissional_bloqueios_altera" on public.profissional_bloqueios
  for all to authenticated
  using ((select public.pode('configurar')) or (select public.pode('agenda_editar')))
  with check ((select public.pode('configurar')) or (select public.pode('agenda_editar')));

-- Tokens da API: só quem configura, até para ver.
drop policy if exists "api_tokens_all" on public.api_tokens;
drop policy if exists "api_tokens_configurar" on public.api_tokens;
create policy "api_tokens_configurar" on public.api_tokens
  for all to authenticated
  using ((select public.pode('configurar'))) with check ((select public.pode('configurar')));

-- Mensagens do WhatsApp: quem atende as conversas.
drop policy if exists "mensagens_whatsapp_all" on public.mensagens_whatsapp;
drop policy if exists "mensagens_whatsapp_conversas" on public.mensagens_whatsapp;
create policy "mensagens_whatsapp_conversas" on public.mensagens_whatsapp
  for all to authenticated
  using ((select public.pode('conversas'))) with check ((select public.pode('conversas')));

-- Follow-ups enviados: quem atende as conversas ou cuida das fichas.
drop policy if exists "agente_followups_le" on public.agente_followups;
create policy "agente_followups_le" on public.agente_followups
  for select to authenticated
  using ((select public.pode('conversas')) or (select public.pode('pessoas')));

-- AS PESSOAS (leads e clientes).
--
-- Vê quem cuida das fichas, das conversas ou do funil — e a profissional vê
-- quem ela atende (tem ou teve consulta com ela).
drop policy if exists "leads_all" on public.crm_clinica_dados;
drop policy if exists "leads_le" on public.crm_clinica_dados;
drop policy if exists "leads_cria" on public.crm_clinica_dados;
drop policy if exists "leads_altera" on public.crm_clinica_dados;
drop policy if exists "leads_apaga" on public.crm_clinica_dados;

create policy "leads_le" on public.crm_clinica_dados
  for select to authenticated
  using (
    (select public.pode('pessoas'))
    or (select public.pode('conversas'))
    or (select public.pode('crm'))
    or exists (
      select 1 from public.consultas c
       where c.lead_id = crm_clinica_dados.id
         and c.profissional_id = (select public.meu_profissional())
    )
  );

create policy "leads_cria" on public.crm_clinica_dados
  for insert to authenticated
  with check ((select public.pode('pessoas')));

-- Alterar: a ficha (pessoas), assumir e devolver a conversa (conversas),
-- mover de etapa (crm).
create policy "leads_altera" on public.crm_clinica_dados
  for update to authenticated
  using ((select public.pode('pessoas')) or (select public.pode('conversas')) or (select public.pode('crm')))
  with check ((select public.pode('pessoas')) or (select public.pode('conversas')) or (select public.pode('crm')));

create policy "leads_apaga" on public.crm_clinica_dados
  for delete to authenticated
  using ((select public.pode('pessoas')));

-- A AGENDA.
--
-- Vê: quem vê a agenda de todas; quem cuida das fichas ou das conversas (a
-- ficha e o painel mostram o histórico da pessoa); e a profissional, a dela.
-- Altera: quem tem `agenda_editar`, dentro da agenda que vê.
drop policy if exists "consultas_all" on public.consultas;
drop policy if exists "consultas_le" on public.consultas;
drop policy if exists "consultas_altera" on public.consultas;

create policy "consultas_le" on public.consultas
  for select to authenticated
  using (
    (select public.pode('agenda_todas'))
    or (select public.pode('pessoas'))
    or (select public.pode('conversas'))
    or profissional_id = (select public.meu_profissional())
  );

create policy "consultas_altera" on public.consultas
  for all to authenticated
  using (
    (select public.pode('agenda_editar'))
    and ((select public.pode('agenda_todas')) or profissional_id = (select public.meu_profissional()))
  )
  with check (
    (select public.pode('agenda_editar'))
    and ((select public.pode('agenda_todas')) or profissional_id = (select public.meu_profissional()))
  );

-- OS ARQUIVOS.
-- A logo é da empresa: quem configura. As mídias do WhatsApp: quem atende as
-- conversas. A foto de cada um continua sendo de cada um (não muda).
drop policy if exists "logos_team_insert" on storage.objects;
drop policy if exists "logos_team_update" on storage.objects;
drop policy if exists "logos_team_delete" on storage.objects;
create policy "logos_team_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and (select public.pode('configurar')));
create policy "logos_team_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and (select public.pode('configurar')));
create policy "logos_team_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and (select public.pode('configurar')));

drop policy if exists "midias_whatsapp_equipe_le" on storage.objects;
drop policy if exists "midias_whatsapp_equipe_grava" on storage.objects;
create policy "midias_whatsapp_equipe_le" on storage.objects
  for select to authenticated
  using (bucket_id = 'midias-whatsapp' and (select public.pode('conversas')));
create policy "midias_whatsapp_equipe_grava" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'midias-whatsapp' and (select public.pode('conversas')));


-- -----------------------------------------------------------------------------
-- 7. O valor pago: a coluna some para quem não tem `valores`
-- -----------------------------------------------------------------------------
--
-- Política decide LINHA, não COLUNA. Para quem pode ver a ficha mas não o
-- dinheiro, a coluna `valor_pago_acumulado` sai do alcance do papel
-- `authenticated` inteiro — e volta, filtrada, por duas funções:
--
--   valor_pago_visivel(lead)          o valor, ou nulo sem `valores`
--   definir_valor_pago(lead, valor)   grava, e recusa sem `valores`
--
-- A visão `crm_clinica` (que a tela lê) passa a mostrar o valor pela primeira.
--
-- ⚠️ COLUNA NOVA EM `crm_clinica_dados` PRECISA DE GRANT. As permissões agora
-- são por coluna: uma coluna criada depois desta migração nasce invisível para
-- a equipe, e a tela quebra com "permission denied for column". A migração que
-- criar a coluna faz o `grant select, update (coluna) ... to authenticated`.

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'crm_clinica_dados'
     and column_name <> 'valor_pago_acumulado';

  execute 'revoke select, update on public.crm_clinica_dados from authenticated';
  execute format('grant select (%s), update (%s) on public.crm_clinica_dados to authenticated', cols, cols);
end $$;

-- SECURITY DEFINER nas duas, e é o ponto delas: ler e gravar a coluna que o
-- papel não alcança. Cada uma confere `pode('valores')` antes. São as duas
-- exceções documentadas da conferência de funções na seção 10 do DATABASE.md.
create or replace function public.valor_pago_visivel(p_lead uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case when public.pode('valores') then d.valor_pago_acumulado end
    from public.crm_clinica_dados d
   where d.id = p_lead
$$;

create or replace function public.definir_valor_pago(p_lead uuid, p_valor numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pode('valores') then
    raise exception 'sem_permissao: sem acesso aos valores' using errcode = '42501';
  end if;
  update public.crm_clinica_dados set valor_pago_acumulado = p_valor where id = p_lead;
end;
$$;

revoke all on function public.valor_pago_visivel(uuid) from public, anon;
revoke all on function public.definir_valor_pago(uuid, numeric) from public, anon;
grant execute on function public.valor_pago_visivel(uuid) to authenticated, service_role;
grant execute on function public.definir_valor_pago(uuid, numeric) to authenticated, service_role;

-- A visão, idêntica à da 0030 — só o valor muda de origem. O `::numeric(10,2)`
-- mantém o tipo da coluna: sem ele o `create or replace view` recusa.
create or replace view public.crm_clinica with (security_invoker = true) as
  select
    id,
    nome_lead,
    whatsapp_lead,
    procedimentos_interesse,
    nullif(array_to_string(procedimentos_interesse, ', '), '') as procedimento_interesse,
    data_nascimento,
    anotacoes,
    resumo_conversa,
    inicio_atendimento,
    ultima_mensagem,
    status,
    follow_up_1,
    follow_up_2,
    follow_up_3,
    data_agendamento,
    data_marcacao_agendamento,
    id_agendamento,
    id_conta_chatwoot,
    id_conversa_chatwoot,
    id_lead_chatwoot,
    inbox_id_chatwoot,
    public.valor_pago_visivel(d.id)::numeric(10,2) as valor_pago_acumulado,
    created_at,
    agente_pausado,
    assumido_por,
    assumido_em,
    case
      when ultima_mensagem is null then null::integer
      else floor(extract(epoch from now() - ultima_mensagem) / 60)::integer
    end as minutos_ultima_mensagem,
    (select max(c.data_consulta) from public.consultas c
      where c.lead_id = d.id and c.status = 'realizada') as ultima_consulta,
    nao_perturbe,
    nao_perturbe_em,
    nao_perturbe_motivo
  from public.crm_clinica_dados d;

revoke all on public.crm_clinica from anon;
