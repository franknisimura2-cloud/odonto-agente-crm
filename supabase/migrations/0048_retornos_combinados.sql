-- =============================================================================
-- 0048 — Retorno combinado: "fale comigo de novo em março"
-- =============================================================================
--
-- O follow-up retoma uma conversa que parou, e por isso o prazo dele vai até
-- 60 dias. Seis meses depois, aquela conversa já não faz sentido. O que faz
-- sentido é um contato COM MOTIVO: a pessoa pediu para ser procurada depois da
-- viagem, vai pensar no tratamento até o fim do ano, quer saber quando a
-- promoção voltar.
--
-- A equipe marca na ficha uma DATA e o MOTIVO. No dia, a Letícia escreve uma
-- mensagem sobre aquele assunto — não sobre a conversa antiga — e manda uma
-- vez só. Se a pessoa responder, a conversa segue normal, com a ficha contando
-- à Letícia por que ela chamou.
--
-- ── UMA MENSAGEM, NÃO UMA RÉGUA ─────────────────────────────────────────────
--
-- Quem foi procurado e não respondeu não recebe um segundo toque. O retorno
-- foi combinado com a pessoa; insistir é o que transforma combinado em spam.
-- E é a denúncia de spam que derruba um número da uazapi.
--
-- ── AS TRAVAS (as mesmas das outras mensagens automáticas) ──────────────────
--
--   · agente ligada, chave própria ligada (nasce DESLIGADA), modo teste;
--   · só na janela de horário (`followup_inicio`/`followup_fim`);
--   · quem pediu para não ser procurado, conversa pausada ou assumida: não;
--   · quem falou com a clínica nas últimas 24 h: espera — está conversando, e
--     a chamada sai quando a conversa esfriar;
--   · um por pessoa por rodada;
--   · atraso de mais de 14 dias não sai sozinho (a agente estava desligada,
--     por exemplo): aparece como ATRASADO na lista, e a equipe decide.
--
-- ── QUEM MEXE ───────────────────────────────────────────────────────────────
--
-- Cria e cancela quem cuida das pessoas ou das conversas. Ninguém apaga: o
-- cancelado fica, com quem cancelou e quando. Só o servidor marca "enviado".
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. A tabela
-- -----------------------------------------------------------------------------

create table if not exists public.retornos_combinados (
  id            uuid        primary key default gen_random_uuid(),
  lead_id       uuid        not null references public.crm_clinica_dados(id) on delete cascade,
  para_data     date        not null,
  motivo        text        not null check (char_length(btrim(motivo)) between 3 and 300),
  situacao      text        not null default 'agendado' check (situacao in ('agendado', 'enviado', 'cancelado')),
  criado_por    uuid        references public.usuarios(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  enviado_em    timestamptz,
  texto         text,
  cancelado_em  timestamptz,
  cancelado_por uuid        references public.usuarios(id) on delete set null
);

create index if not exists retornos_combinados_fila on public.retornos_combinados (situacao, para_data);
create index if not exists retornos_combinados_lead on public.retornos_combinados (lead_id);

comment on table public.retornos_combinados is
  'Contato com data e motivo, marcado pela equipe na ficha. A agente manda uma mensagem so, no dia (0048).';
comment on column public.retornos_combinados.motivo is
  'Anotacao da equipe sobre o assunto do contato. A agente usa o assunto, nao copia o texto.';


-- -----------------------------------------------------------------------------
-- 2. A guarda: o que a tela pode fazer
-- -----------------------------------------------------------------------------
--
-- A tela cria (agendado, data de hoje em diante), edita data e motivo enquanto
-- está agendado, e cancela. "Enviado" é só do servidor, e o que já saiu ou foi
-- cancelado não muda mais.

create or replace function public.retornos_combinados_guarda()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tz      text := coalesce((select nullif(fuso_horario, '') from public.configuracoes_clinica limit 1), 'America/Sao_Paulo');
  v_hoje    date := (now() at time zone v_tz)::date;
  v_servidor boolean := coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin');
begin
  new.motivo := btrim(new.motivo);

  if tg_op = 'INSERT' then
    if not v_servidor then
      new.situacao := 'agendado';
      new.enviado_em := null; new.texto := null; new.cancelado_em := null; new.cancelado_por := null;
      new.criado_por := auth.uid();
    end if;
    if new.situacao = 'agendado' and new.para_data < v_hoje then
      raise exception 'A data do retorno não pode ser no passado.' using errcode = '22023';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.situacao <> 'agendado' and not v_servidor then
    raise exception 'Este retorno já foi %; não muda mais.', old.situacao using errcode = '22023';
  end if;
  new.lead_id := old.lead_id;
  new.criado_por := old.criado_por;
  new.created_at := old.created_at;

  if not v_servidor then
    if new.situacao = 'enviado' then
      raise exception 'Só o sistema marca um retorno como enviado.' using errcode = '42501';
    end if;
    new.enviado_em := old.enviado_em;
    new.texto := old.texto;
    if new.situacao = 'cancelado' then
      new.cancelado_em := now();
      new.cancelado_por := auth.uid();
    end if;
    if new.situacao = 'agendado' and new.para_data is distinct from old.para_data and new.para_data < v_hoje then
      raise exception 'A data do retorno não pode ser no passado.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists retornos_combinados_guarda on public.retornos_combinados;
create trigger retornos_combinados_guarda
  before insert or update on public.retornos_combinados
  for each row execute function public.retornos_combinados_guarda();


-- -----------------------------------------------------------------------------
-- 3. Acesso
-- -----------------------------------------------------------------------------

alter table public.retornos_combinados enable row level security;

drop policy if exists "retornos_combinados_le" on public.retornos_combinados;
create policy "retornos_combinados_le" on public.retornos_combinados
  for select to authenticated
  using ((select public.pode('pessoas')) or (select public.pode('conversas')));

drop policy if exists "retornos_combinados_cria" on public.retornos_combinados;
create policy "retornos_combinados_cria" on public.retornos_combinados
  for insert to authenticated
  with check ((select public.pode('pessoas')) or (select public.pode('conversas')));

drop policy if exists "retornos_combinados_altera" on public.retornos_combinados;
create policy "retornos_combinados_altera" on public.retornos_combinados
  for update to authenticated
  using ((select public.pode('pessoas')) or (select public.pode('conversas')))
  with check ((select public.pode('pessoas')) or (select public.pode('conversas')));

-- Sem política de DELETE: ninguém apaga pela tela. (Apagar a pessoa leva junto.)
revoke all on public.retornos_combinados from anon;
grant select, insert, update on public.retornos_combinados to authenticated;


-- -----------------------------------------------------------------------------
-- 4. A chave na tela
-- -----------------------------------------------------------------------------

alter table public.configuracoes_agente
  add column if not exists retornos_combinados_ativo boolean not null default false;

comment on column public.configuracoes_agente.retornos_combinados_ativo is
  'Retorno combinado (0048): a agente chama no dia marcado. Nasce desligado.';


-- -----------------------------------------------------------------------------
-- 5. A fila
-- -----------------------------------------------------------------------------

create or replace function public.retornos_combinados_pendentes()
returns table (
  id        uuid,
  lead_id   uuid,
  whatsapp  text,
  nome      text,
  para_data date,
  motivo    text
)
language sql
stable
set search_path = public
as $$
  with cfg as (
    select * from public.configuracoes_agente limit 1
  ),
  clinica as (
    select coalesce(nullif(fuso_horario, ''), 'America/Sao_Paulo') as tz
      from public.configuracoes_clinica limit 1
  ),
  hoje as (
    select (now() at time zone coalesce((select tz from clinica), 'America/Sao_Paulo'))::date as d,
           (now() at time zone coalesce((select tz from clinica), 'America/Sao_Paulo'))::time as h
  )
  select distinct on (r.lead_id)
         r.id, r.lead_id, l.whatsapp_lead, l.nome_lead, r.para_data, r.motivo
    from public.retornos_combinados r
    join public.crm_clinica_dados l on l.id = r.lead_id
    cross join cfg cross join hoje
   where cfg.ativo
     and cfg.retornos_combinados_ativo
     and r.situacao = 'agendado'
     and r.para_data <= hoje.d
     and r.para_data >= hoje.d - 14
     and hoje.h between cfg.followup_inicio and cfg.followup_fim
     and l.whatsapp_lead is not null
     and not l.nao_perturbe
     and not l.agente_pausado
     and l.assumido_por is null
     -- Falou com a clínica há pouco: está conversando. Sai quando esfriar.
     and not exists (
       select 1 from public.mensagens_whatsapp m
        where m.lead_id = l.id and m.autor = 'paciente' and m.criada_em > now() - interval '24 hours'
     )
     and public.agente_deve_responder(l.whatsapp_lead)
   order by r.lead_id, r.para_data, r.created_at
$$;

comment on function public.retornos_combinados_pendentes() is
  'Os retornos combinados que a agente deve mandar agora. Toda a politica mora aqui; a Edge Function so executa.';


-- -----------------------------------------------------------------------------
-- 6. Reservar e devolver (o servidor marca antes de escrever, para dois
--    disparos do relógio nunca mandarem o mesmo retorno duas vezes)
-- -----------------------------------------------------------------------------

create or replace function public.retorno_combinado_reservar(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with feito as (
    update public.retornos_combinados
       set situacao = 'enviado', enviado_em = now()
     where id = p_id and situacao = 'agendado'
    returning 1
  )
  select exists (select 1 from feito)
$$;

create or replace function public.retorno_combinado_devolver(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.retornos_combinados
     set situacao = 'agendado', enviado_em = null, texto = null
   where id = p_id and situacao = 'enviado' and texto is null
$$;


-- -----------------------------------------------------------------------------
-- 7. O disparo
-- -----------------------------------------------------------------------------

create or replace function public.disparar_retornos_combinados()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url     text;
  v_segredo text;
  v_pedido  bigint;
begin
  if not exists (select 1 from public.retornos_combinados_pendentes()) then
    return null;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'retornos_combinados_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'followup_segredo';

  if v_url is null or v_segredo is null then
    raise warning 'retornos combinados: falta endereco ou segredo no Vault. Rode npm run combinados:ligar.';
    return null;
  end if;

  select net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-segredo', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 8000
  ) into v_pedido;

  return v_pedido;
end;
$$;

revoke execute on function public.retornos_combinados_pendentes() from public, anon, authenticated;
revoke execute on function public.retorno_combinado_reservar(uuid) from public, anon, authenticated;
revoke execute on function public.retorno_combinado_devolver(uuid) from public, anon, authenticated;
revoke execute on function public.disparar_retornos_combinados() from public, anon, authenticated;
grant execute on function public.retornos_combinados_pendentes() to service_role;
grant execute on function public.retorno_combinado_reservar(uuid) to service_role;
grant execute on function public.retorno_combinado_devolver(uuid) to service_role;
grant execute on function public.disparar_retornos_combinados() to service_role;
