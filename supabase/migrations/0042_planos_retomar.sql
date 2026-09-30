-- =============================================================================
-- 0042 — A Letícia retoma o plano de tratamento que não foi aprovado
-- =============================================================================
--
-- O ponto de maior retorno do produto: o paciente recebeu o plano, viu o que
-- o convênio cobre e o que é particular — e não respondeu. A Letícia volta a
-- falar, sem pressão, puxando pelo que ainda falta decidir.
--
-- Mesmo desenho do follow-up (0030) e dos lembretes (0037): TODA a regra em
-- `planos_retomar_pendentes()`; o relógio (`pg_cron`, `npm run planos:ligar`)
-- chama `disparar_planos_retomar()` a cada minuto, que só acorda a função
-- `whatsapp` (rota /planos-retomar) quando há fila.
--
-- ── AS TRAVAS ───────────────────────────────────────────────────────────────
--
--   · Só plano APRESENTADO ou APROVADO EM PARTE, com item ainda pendente e
--     dentro da validade. Aprovou, recusou, venceu: acabou.
--   · O prazo conta do mais recente entre: a apresentação, o último toque e a
--     última mensagem do paciente. Quem está conversando não é "retomado" —
--     a conversa já está acontecendo.
--   · No máximo N toques (padrão 2), com o mesmo intervalo entre eles.
--   · Só dentro da janela de horário do follow-up.
--   · Conversa pausada ou assumida pela equipe, `nao_perturbe`, agente
--     desligada ou modo teste (fora dos números de teste): não sai.
--
-- ── O LINK ──────────────────────────────────────────────────────────────────
--
-- O banco não sabe em que endereço a clínica atende (cada uma tem o seu). A
-- tela grava a origem ao apresentar o plano (`link_base`); sem ela, a Letícia
-- retoma sem mandar link — e diz que a recepção reenvia.
--
-- ── NASCE DESLIGADO ─────────────────────────────────────────────────────────
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Configuração e o endereço do link
-- -----------------------------------------------------------------------------

alter table public.configuracoes_agente
  add column if not exists planos_retomar_ativo  boolean  not null default false,
  add column if not exists planos_retomar_dias   integer  not null default 3,
  add column if not exists planos_retomar_toques smallint not null default 2;

alter table public.configuracoes_agente drop constraint if exists configuracoes_agente_planos_retomar_check;
alter table public.configuracoes_agente add constraint configuracoes_agente_planos_retomar_check check (
  planos_retomar_dias between 1 and 30 and planos_retomar_toques between 1 and 3
);

alter table public.planos_tratamento add column if not exists link_base text;

comment on column public.planos_tratamento.link_base is
  'A origem do sistema (https://clinica.dominio) no momento de apresentar. '
  'O link do paciente e link_base || /orcamento/ || token.';


-- -----------------------------------------------------------------------------
-- 2. O registro dos toques
-- -----------------------------------------------------------------------------

create table if not exists public.agente_planos_retomadas (
  id         uuid        primary key default gen_random_uuid(),
  plano_id   uuid        not null references public.planos_tratamento(id) on delete cascade,
  toque      smallint    not null check (toque between 1 and 3),
  enviado_em timestamptz not null default now(),
  texto      text,
  unique (plano_id, toque)
);

alter table public.agente_planos_retomadas enable row level security;

-- Vê quem vê o plano (o `exists` passa pelo RLS dos planos).
drop policy if exists "agente_planos_retomadas_le" on public.agente_planos_retomadas;
create policy "agente_planos_retomadas_le" on public.agente_planos_retomadas
  for select to authenticated
  using (exists (select 1 from public.planos_tratamento p where p.id = agente_planos_retomadas.plano_id));

revoke all on public.agente_planos_retomadas from anon;


-- -----------------------------------------------------------------------------
-- 3. A fila
-- -----------------------------------------------------------------------------

create or replace function public.planos_retomar_pendentes()
returns table (
  plano_id   uuid,
  lead_id    uuid,
  whatsapp   text,
  nome       text,
  toque      smallint,
  link       text,
  dias       integer
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
  toques as (
    select r.plano_id, max(r.toque) as ultimo, max(r.enviado_em) as ultimo_em
      from public.agente_planos_retomadas r group by r.plano_id
  ),
  base as (
    select p.id, p.lead_id, l.whatsapp_lead, l.nome_lead, p.token, p.link_base,
           coalesce(t.ultimo, 0) + 1 as proximo,
           greatest(
             coalesce(t.ultimo_em, p.apresentado_em),
             p.apresentado_em,
             coalesce((select max(m.criada_em) from public.mensagens_whatsapp m
                        where m.lead_id = p.lead_id and m.autor = 'paciente'), p.apresentado_em)
           ) as desde
      from public.planos_tratamento p
      join public.crm_clinica_dados l on l.id = p.lead_id
      left join toques t on t.plano_id = p.id
      cross join cfg cross join clinica
     where cfg.ativo
       and cfg.planos_retomar_ativo
       and p.status in ('apresentado', 'parcial')
       and p.apresentado_em is not null
       and exists (select 1 from public.plano_itens i where i.plano_id = p.id and i.status = 'pendente')
       and (p.validade is null or p.validade >= (now() at time zone clinica.tz)::date)
       and l.whatsapp_lead is not null
       and not l.nao_perturbe
       and not l.agente_pausado
       and l.assumido_por is null
       and public.agente_deve_responder(l.whatsapp_lead)
  )
  select b.id, b.lead_id, b.whatsapp_lead, b.nome_lead, b.proximo::smallint,
         case when nullif(trim(b.link_base), '') is not null
              then rtrim(b.link_base, '/') || '/orcamento/' || b.token end,
         floor(extract(epoch from now() - b.desde) / 86400)::integer
    from base b
    cross join cfg cross join clinica
   where b.proximo <= cfg.planos_retomar_toques
     and now() >= b.desde + make_interval(days => cfg.planos_retomar_dias)
     and (now() at time zone clinica.tz)::time between cfg.followup_inicio and cfg.followup_fim
$$;

comment on function public.planos_retomar_pendentes() is
  'Planos apresentados e nao aprovados que a agente deve retomar agora. Toda '
  'a politica mora aqui; a Edge Function so executa.';


-- -----------------------------------------------------------------------------
-- 4. O disparo — o que o relógio chama
-- -----------------------------------------------------------------------------

create or replace function public.disparar_planos_retomar()
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
  if not exists (select 1 from public.planos_retomar_pendentes()) then
    return null;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'planos_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'followup_segredo';

  if v_url is null or v_segredo is null then
    raise warning 'planos: falta endereco ou segredo no Vault. Rode npm run planos:ligar.';
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

revoke execute on function public.planos_retomar_pendentes() from public, anon, authenticated;
revoke execute on function public.disparar_planos_retomar()  from public, anon, authenticated;
grant execute on function public.planos_retomar_pendentes() to service_role;
grant execute on function public.disparar_planos_retomar()  to service_role;
