-- =============================================================================
-- 0040 — Odontograma
-- =============================================================================
--
-- O mapa da boca do paciente: dente por dente, face por face, o que existe, o
-- que precisa de tratamento e o que já foi tratado. É dele que sai o plano de
-- tratamento em etapas (a próxima fase): tudo o que está "a tratar" vira item.
--
--   odontogramas              um por paciente: se mostra os dentes de leite
--   odontograma_registros     cada achado: dente, faces, condição, situação
--   odontograma_historico     quem marcou, mudou ou apagou o quê, e quando
--
-- Numeração FDI (a do Brasil): permanentes 11–18, 21–28, 31–38, 41–48;
-- decíduos (de leite) 51–55, 61–65, 71–75, 81–85. Faces: M (mesial),
-- D (distal), O (oclusal/incisal), V (vestibular), L (lingual/palatina).
-- Sem face = o dente inteiro (ausente, implante, coroa, canal…).
--
-- ── QUEM VÊ E QUEM MEXE ─────────────────────────────────────────────────────
--
-- Vê quem vê a ficha da pessoa — a política pergunta à própria tabela de
-- pessoas, e o RLS dela decide (a profissional vê quem ela atende).
-- Mexe quem tem a permissão nova `odontograma`: por padrão a Admin e a
-- profissional; a recepção só consulta. A Admin muda isso por pessoa, na aba
-- Equipe, como as outras.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. A permissão nova
-- -----------------------------------------------------------------------------
--
-- ⚠️ A lista de permissões mora em TRÊS funções (a regra por papel, a
-- `minhas_permissoes` e a `equipe`) e no `src/lib/acesso.ts` + `equipe.ts`.
-- Permissão nova entra em todos.

create or replace function public.permissao_padrao(p_papel text, p_permissao text)
returns boolean
language sql
immutable
as $$
  select case p_papel
    when 'dona'         then true
    when 'recepcao'     then p_permissao in ('conversas', 'agenda_todas', 'agenda_editar', 'pessoas')
    when 'profissional' then p_permissao in ('odontograma')
    else false
  end
$$;

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
          'pessoas', 'crm', 'exportar', 'configurar', 'equipe', 'odontograma'
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
              'pessoas', 'crm', 'exportar', 'configurar', 'equipe', 'odontograma'
            ]) as p),
         u.created_at
    from public.usuarios u
   where public.pode('equipe')
   order by u.ativo desc, (u.papel = 'dona') desc, u.nome
$$;


-- -----------------------------------------------------------------------------
-- 2. As tabelas
-- -----------------------------------------------------------------------------

create or replace function public.dente_fdi_valido(p_dente smallint)
returns boolean
language sql
immutable
as $$
  select (p_dente / 10 between 1 and 4 and p_dente % 10 between 1 and 8)
      or (p_dente / 10 between 5 and 8 and p_dente % 10 between 1 and 5)
$$;

create table if not exists public.odontogramas (
  lead_id        uuid        primary key references public.crm_clinica_dados(id) on delete cascade,
  deciduos       boolean     not null default false,
  observacoes    text,
  atualizado_em  timestamptz not null default now()
);

comment on column public.odontogramas.deciduos is
  'Mostra os dentes de leite (51-85). Liga-se por paciente: odontopediatria.';

create table if not exists public.odontograma_registros (
  id             uuid        primary key default gen_random_uuid(),
  lead_id        uuid        not null references public.crm_clinica_dados(id) on delete cascade,
  dente          smallint    not null check (public.dente_fdi_valido(dente)),
  faces          text[]      not null default '{}'
                             check (faces <@ array['M', 'D', 'O', 'V', 'L']::text[]),
  condicao       text        not null check (condicao in (
                   'carie', 'restauracao', 'selante', 'fratura', 'canal', 'coroa',
                   'implante', 'protese', 'ausente', 'extracao', 'outro')),
  situacao       text        not null default 'a_tratar'
                             check (situacao in ('a_tratar', 'existente', 'tratado')),
  observacao     text,
  criado_por     uuid        default auth.uid() references public.usuarios(id) on delete set null,
  created_at     timestamptz not null default now(),
  atualizado_por uuid        default auth.uid() references public.usuarios(id) on delete set null,
  updated_at     timestamptz not null default now()
);

create index if not exists odontograma_registros_lead_idx on public.odontograma_registros (lead_id, dente);

comment on table public.odontograma_registros is
  'Cada achado do odontograma. situacao a_tratar e o que vira item do plano '
  'de tratamento. faces vazio = o dente inteiro.';

create table if not exists public.odontograma_historico (
  id           uuid        primary key default gen_random_uuid(),
  lead_id      uuid        not null references public.crm_clinica_dados(id) on delete cascade,
  registro_id  uuid,
  acao         text        not null check (acao in ('criou', 'alterou', 'apagou')),
  antes        jsonb,
  depois       jsonb,
  por          uuid        references public.usuarios(id) on delete set null,
  em           timestamptz not null default now()
);

create index if not exists odontograma_historico_lead_idx on public.odontograma_historico (lead_id, em desc);


-- -----------------------------------------------------------------------------
-- 3. O histórico se escreve sozinho
-- -----------------------------------------------------------------------------
--
-- SECURITY DEFINER: ninguém da equipe escreve no histórico (não há política de
-- escrita) — só o gatilho. É o que faz dele um registro confiável.

create or replace function public.odontograma_registra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.odontograma_historico (lead_id, registro_id, acao, depois, por)
    values (new.lead_id, new.id, 'criou', to_jsonb(new), auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    new.updated_at := now();
    new.atualizado_por := coalesce(auth.uid(), new.atualizado_por);
    new.criado_por := old.criado_por;
    new.created_at := old.created_at;
    new.lead_id := old.lead_id;
    insert into public.odontograma_historico (lead_id, registro_id, acao, antes, depois, por)
    values (new.lead_id, new.id, 'alterou', to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  else
    -- Apagar a PESSOA apaga o odontograma em cascata; aí não há de quem
    -- guardar histórico (e a linha nova violaria a chave estrangeira).
    if exists (select 1 from public.crm_clinica_dados where id = old.lead_id) then
      insert into public.odontograma_historico (lead_id, registro_id, acao, antes, por)
      values (old.lead_id, old.id, 'apagou', to_jsonb(old), auth.uid());
    end if;
    return old;
  end if;
end;
$$;

drop trigger if exists odontograma_registra_ins on public.odontograma_registros;
drop trigger if exists odontograma_registra_upd on public.odontograma_registros;
drop trigger if exists odontograma_registra_del on public.odontograma_registros;
create trigger odontograma_registra_ins after insert on public.odontograma_registros
  for each row execute function public.odontograma_registra();
create trigger odontograma_registra_upd before update on public.odontograma_registros
  for each row execute function public.odontograma_registra();
create trigger odontograma_registra_del after delete on public.odontograma_registros
  for each row execute function public.odontograma_registra();


-- -----------------------------------------------------------------------------
-- 4. Quem vê e quem mexe
-- -----------------------------------------------------------------------------
--
-- "Vê a ficha" = a linha da pessoa passa pelo RLS de `crm_clinica_dados`. O
-- `exists` abaixo roda com os direitos de quem pergunta, então herda a regra
-- dela inteira (inclusive a da profissional, que vê quem ela atende).

alter table public.odontogramas          enable row level security;
alter table public.odontograma_registros enable row level security;
alter table public.odontograma_historico enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['odontogramas', 'odontograma_registros'] loop
    execute format('drop policy if exists %I on public.%I', t || '_le', t);
    execute format('drop policy if exists %I on public.%I', t || '_altera', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ('
      'exists (select 1 from public.crm_clinica_dados l where l.id = %I.lead_id))',
      t || '_le', t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using ((select public.pode(''odontograma'')) and exists (select 1 from public.crm_clinica_dados l where l.id = %I.lead_id)) '
      'with check ((select public.pode(''odontograma'')) and exists (select 1 from public.crm_clinica_dados l where l.id = %I.lead_id))',
      t || '_altera', t, t, t);
  end loop;
end $$;

drop policy if exists "odontograma_historico_le" on public.odontograma_historico;
create policy "odontograma_historico_le" on public.odontograma_historico
  for select to authenticated
  using (exists (select 1 from public.crm_clinica_dados l where l.id = odontograma_historico.lead_id));

revoke all on public.odontogramas, public.odontograma_registros, public.odontograma_historico from anon;
revoke insert, update, delete on public.odontograma_historico from authenticated;

revoke all on function public.dente_fdi_valido(smallint) from public, anon;
grant execute on function public.dente_fdi_valido(smallint) to authenticated, service_role;
