-- =============================================================================
-- 0041 — Plano de tratamento em etapas (o orçamento)
-- =============================================================================
--
-- O que converte o paciente de convênio em particular: o dentista monta o
-- plano a partir do odontograma, em etapas (saúde primeiro, estética por
-- último), e o plano mostra, item por item, o que o convênio cobre e o que é
-- particular. O paciente recebe um LINK e aprova o plano inteiro ou por etapa.
--
--   planos_tratamento   o plano: status, desconto, validade, o token do link
--   plano_itens         cada procedimento: dente, faces, etapa, cobertura,
--                       valor, status — e a consulta que o executa
--
-- ── A COBERTURA SE PREENCHE SOZINHA ─────────────────────────────────────────
--
-- Item novo sem cobertura dita: se a ficha é de convênio e o convênio cobre o
-- serviço → convênio (valor 0 para o paciente); senão → particular, com o
-- valor "a partir de" do serviço como ponto de partida. A equipe ajusta.
--
-- ── O STATUS DO PLANO SE CALCULA SOZINHO ────────────────────────────────────
--
-- Depois de apresentado, o plano segue os itens: todos aprovados → aprovado;
-- alguns → parcial; todos recusados → recusado; todos feitos → concluído.
-- A consulta ligada a um item que recebe baixa "compareceu" marca o item como
-- feito.
--
-- ── O LINK DO PACIENTE ──────────────────────────────────────────────────────
--
-- `plano_publico(token)` e `plano_aprovar(token, etapas)` são chamadas SEM
-- login (a chave pública), por isso SECURITY DEFINER e abertas ao `anon`. É a
-- exceção documentada nº 5 e 6 da conferência de funções (DATABASE.md, seção
-- 10). O que elas protegem:
--   · o token é um uuid aleatório (122 bits) — não se adivinha;
--   · plano em rascunho não aparece;
--   · só sai o PRIMEIRO nome do paciente e o nome da clínica — nada de
--     telefone, ficha ou odontograma;
--   · aprovar só vale para plano apresentado ou parcial, dentro da validade,
--     e só muda itens pendentes daquele plano.
--
-- ── QUEM VÊ E QUEM MEXE ─────────────────────────────────────────────────────
--
-- A permissão nova `orcamentos` (só a Admin, por padrão: a recepção que
-- apresenta orçamentos ganha na aba Equipe) OU `odontograma` (o dentista, que
-- monta o plano) — sempre de quem a pessoa vê a ficha.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. A permissão nova (nas três funções — ver a 0040)
-- -----------------------------------------------------------------------------

create or replace function public.minhas_permissoes()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'papel', (select u.papel from public.usuarios u where u.id = auth.uid() and u.ativo),
    'profissional_id', public.meu_profissional(),
    'permissoes', (
      select jsonb_object_agg(p, public.pode(p))
        from unnest(array[
          'dashboard', 'valores', 'conversas', 'agenda_todas', 'agenda_editar',
          'pessoas', 'crm', 'exportar', 'configurar', 'equipe', 'odontograma', 'orcamentos'
        ]) as p
    )
  )
$$;

create or replace function public.equipe()
returns table (
  id uuid,
  nome text,
  email text,
  papel text,
  profissional_id uuid,
  ativo boolean,
  permissoes jsonb,
  efetivas jsonb,
  created_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select u.id, u.nome, u.email, u.papel, u.profissional_id, u.ativo, u.permissoes,
         (select jsonb_object_agg(p, public.permissao_efetiva(u.papel, u.permissoes, p))
            from unnest(array[
              'dashboard', 'valores', 'conversas', 'agenda_todas', 'agenda_editar',
              'pessoas', 'crm', 'exportar', 'configurar', 'equipe', 'odontograma', 'orcamentos'
            ]) as p),
         u.created_at
    from public.usuarios u
   where public.pode('equipe')
   order by u.ativo desc, (u.papel = 'dona') desc, u.nome
$$;
-- `permissao_padrao` não muda: `orcamentos` fica fora da recepção e da
-- profissional (a Admin tem tudo).


-- -----------------------------------------------------------------------------
-- 2. As tabelas
-- -----------------------------------------------------------------------------

create table if not exists public.planos_tratamento (
  id             uuid          primary key default gen_random_uuid(),
  lead_id        uuid          not null references public.crm_clinica_dados(id) on delete cascade,
  status         text          not null default 'rascunho' check (status in (
                   'rascunho', 'apresentado', 'parcial', 'aprovado', 'recusado', 'concluido')),
  observacoes    text,
  desconto       numeric(10,2) not null default 0 check (desconto >= 0),
  validade       date,
  token          uuid          not null unique default gen_random_uuid(),
  criado_por     uuid          default auth.uid() references public.usuarios(id) on delete set null,
  created_at     timestamptz   not null default now(),
  apresentado_em timestamptz,
  decidido_em    timestamptz,
  updated_at     timestamptz   not null default now()
);

create index if not exists planos_tratamento_lead_idx on public.planos_tratamento (lead_id, created_at desc);
create index if not exists planos_tratamento_status_idx on public.planos_tratamento (status);

comment on column public.planos_tratamento.token is
  'O segredo do link do paciente (/orcamento/<token>). Trocar o token invalida o link antigo.';

create table if not exists public.plano_itens (
  id           uuid          primary key default gen_random_uuid(),
  plano_id     uuid          not null references public.planos_tratamento(id) on delete cascade,
  registro_id  uuid          references public.odontograma_registros(id) on delete set null,
  servico_id   uuid          references public.servicos_clinica(id) on delete set null,
  procedimento text          not null check (length(trim(procedimento)) > 0),
  dente        smallint      check (dente is null or public.dente_fdi_valido(dente)),
  faces        text[]        not null default '{}' check (faces <@ array['M', 'D', 'O', 'V', 'L']::text[]),
  etapa        smallint      not null default 1 check (etapa between 1 and 5),
  cobertura    text          check (cobertura in ('particular', 'convenio')),
  convenio_id  uuid          references public.convenios(id) on delete restrict,
  valor        numeric(10,2) check (valor >= 0),
  status       text          not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'feito')),
  consulta_id  uuid          references public.consultas(id) on delete set null,
  observacao   text,
  ordem        integer       not null default 0,
  created_at   timestamptz   not null default now(),
  constraint plano_itens_cobertura_convenio check (
    cobertura is null
    or (cobertura = 'particular' and convenio_id is null)
    or (cobertura = 'convenio' and convenio_id is not null)
  )
);

create index if not exists plano_itens_plano_idx on public.plano_itens (plano_id, etapa, ordem);
create index if not exists plano_itens_consulta_idx on public.plano_itens (consulta_id) where consulta_id is not null;


-- -----------------------------------------------------------------------------
-- 3. A cobertura e o valor, sozinhos (ver o cabeçalho)
-- -----------------------------------------------------------------------------

create or replace function public.plano_itens_padrao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead      uuid;
  v_forma     text;
  v_convenio  uuid;
  v_preco     numeric;
begin
  if new.servico_id is not null then
    select s.preco_a_partir_de into v_preco from public.servicos_clinica s where s.id = new.servico_id;
  end if;

  if new.cobertura is null then
    select p.lead_id into v_lead from public.planos_tratamento p where p.id = new.plano_id;
    select l.forma_pagamento, l.convenio_id into v_forma, v_convenio
      from public.crm_clinica_dados l where l.id = v_lead;

    if v_forma = 'convenio' and new.servico_id is not null and exists (
         select 1 from public.convenio_coberturas cc
           join public.convenios cv on cv.id = cc.convenio_id and cv.ativo
          where cc.convenio_id = v_convenio and cc.servico_id = new.servico_id) then
      new.cobertura   := 'convenio';
      new.convenio_id := v_convenio;
    else
      new.cobertura   := 'particular';
      new.convenio_id := null;
    end if;
  end if;

  if new.valor is null then
    new.valor := case when new.cobertura = 'convenio' then 0 else coalesce(v_preco, 0) end;
  end if;
  return new;
end;
$$;

drop trigger if exists plano_itens_padrao on public.plano_itens;
create trigger plano_itens_padrao
  before insert on public.plano_itens
  for each row execute function public.plano_itens_padrao();


-- -----------------------------------------------------------------------------
-- 4. O status do plano, sozinho
-- -----------------------------------------------------------------------------

create or replace function public.plano_recalcula(p_plano uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status   text;
  v_total    int;
  v_aprov    int;
  v_recus    int;
  v_feito    int;
  v_novo     text;
begin
  select status into v_status from public.planos_tratamento where id = p_plano;
  -- Rascunho é da equipe: nada se calcula antes de o paciente ver.
  if v_status is null or v_status = 'rascunho' then return; end if;

  select count(*),
         count(*) filter (where status in ('aprovado', 'feito')),
         count(*) filter (where status = 'recusado'),
         count(*) filter (where status = 'feito')
    into v_total, v_aprov, v_recus, v_feito
    from public.plano_itens where plano_id = p_plano;

  v_novo := case
    when v_total = 0                                   then v_status
    when v_feito > 0 and v_feito = v_total - v_recus   then 'concluido'
    when v_recus = v_total                             then 'recusado'
    when v_aprov > 0 and v_aprov = v_total - v_recus
         and v_total - v_recus > 0                     then 'aprovado'
    when v_aprov > 0                                   then 'parcial'
    else 'apresentado'
  end;

  update public.planos_tratamento
     set status      = v_novo,
         decidido_em = case when v_novo in ('parcial', 'aprovado', 'recusado', 'concluido')
                            then coalesce(decidido_em, now()) else decidido_em end,
         updated_at  = now()
   where id = p_plano and status is distinct from v_novo;
end;
$$;

create or replace function public.plano_itens_recalcula()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.plano_recalcula(coalesce(new.plano_id, old.plano_id));
  return null;
end;
$$;

drop trigger if exists plano_itens_recalcula on public.plano_itens;
create trigger plano_itens_recalcula
  after insert or update of status or delete on public.plano_itens
  for each row execute function public.plano_itens_recalcula();

-- A consulta do item recebeu baixa "compareceu": o item está feito.
create or replace function public.consultas_marca_item_feito()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'realizada' and old.status is distinct from 'realizada' then
    update public.plano_itens set status = 'feito'
     where consulta_id = new.id and status in ('aprovado', 'pendente');
  end if;
  return new;
end;
$$;

drop trigger if exists consultas_marca_item_feito on public.consultas;
create trigger consultas_marca_item_feito
  after update of status on public.consultas
  for each row execute function public.consultas_marca_item_feito();

revoke all on function public.plano_recalcula(uuid) from public, anon, authenticated;
grant execute on function public.plano_recalcula(uuid) to service_role;


-- -----------------------------------------------------------------------------
-- 5. Quem vê e quem mexe
-- -----------------------------------------------------------------------------

alter table public.planos_tratamento enable row level security;
alter table public.plano_itens       enable row level security;

drop policy if exists "planos_tratamento_acesso" on public.planos_tratamento;
create policy "planos_tratamento_acesso" on public.planos_tratamento
  for all to authenticated
  using (
    ((select public.pode('orcamentos')) or (select public.pode('odontograma')))
    and exists (select 1 from public.crm_clinica_dados l where l.id = planos_tratamento.lead_id)
  )
  with check (
    ((select public.pode('orcamentos')) or (select public.pode('odontograma')))
    and exists (select 1 from public.crm_clinica_dados l where l.id = planos_tratamento.lead_id)
  );

-- Item: vale o acesso ao plano dele (o `exists` passa pelo RLS acima).
drop policy if exists "plano_itens_acesso" on public.plano_itens;
create policy "plano_itens_acesso" on public.plano_itens
  for all to authenticated
  using (exists (select 1 from public.planos_tratamento p where p.id = plano_itens.plano_id))
  with check (exists (select 1 from public.planos_tratamento p where p.id = plano_itens.plano_id));

revoke all on public.planos_tratamento, public.plano_itens from anon;


-- -----------------------------------------------------------------------------
-- 6. O link do paciente
-- -----------------------------------------------------------------------------

create or replace function public.plano_publico(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'clinica',     (select nome_clinica from public.configuracoes_clinica limit 1),
    'paciente',    nullif(split_part(trim(coalesce(l.nome_lead, '')), ' ', 1), ''),
    'status',      p.status,
    'validade',    p.validade,
    'vencido',     p.validade is not null and p.validade < (now() at time zone
                     coalesce((select nullif(fuso_horario, '') from public.configuracoes_clinica limit 1), 'America/Sao_Paulo'))::date,
    'observacoes', p.observacoes,
    'desconto',    p.desconto,
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'etapa', i.etapa, 'procedimento', i.procedimento,
               'dente', i.dente, 'faces', i.faces, 'cobertura', i.cobertura,
               'convenio', cv.nome, 'valor', i.valor, 'status', i.status)
             order by i.etapa, i.ordem, i.dente nulls last, i.created_at)
        from public.plano_itens i
        left join public.convenios cv on cv.id = i.convenio_id
       where i.plano_id = p.id), '[]'::jsonb)
  )
  from public.planos_tratamento p
  join public.crm_clinica_dados l on l.id = p.lead_id
  where p.token = p_token and p.status <> 'rascunho'
$$;

create or replace function public.plano_aprovar(p_token uuid, p_etapas smallint[])
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano   record;
  v_hoje    date;
begin
  select * into v_plano from public.planos_tratamento where token = p_token;
  if not found or v_plano.status = 'rascunho' then
    raise exception 'plano_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_plano.status not in ('apresentado', 'parcial') then
    raise exception 'plano_ja_decidido' using errcode = 'P0001';
  end if;
  v_hoje := (now() at time zone coalesce((select nullif(fuso_horario, '') from public.configuracoes_clinica limit 1),
                                         'America/Sao_Paulo'))::date;
  if v_plano.validade is not null and v_plano.validade < v_hoje then
    raise exception 'plano_vencido' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_etapas, 1), 0) = 0 then
    raise exception 'nenhuma_etapa' using errcode = 'P0001';
  end if;

  update public.plano_itens set status = 'aprovado'
   where plano_id = v_plano.id and status = 'pendente' and etapa = any(p_etapas);

  return (select status from public.planos_tratamento where id = v_plano.id);
end;
$$;

revoke all on function public.plano_publico(uuid) from public;
revoke all on function public.plano_aprovar(uuid, smallint[]) from public;
grant execute on function public.plano_publico(uuid) to anon, authenticated, service_role;
grant execute on function public.plano_aprovar(uuid, smallint[]) to anon, authenticated, service_role;
