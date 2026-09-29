-- =============================================================================
-- 0038 — Convênios: a porta de entrada do fluxo
-- =============================================================================
--
-- A roda da clínica odontológica: o convênio traz o paciente, o odontograma
-- mostra o que ele precisa, o plano de tratamento converte o que o convênio
-- não cobre em particular, e o retorno semestral traz de volta. Esta é a
-- primeira peça.
--
--   convenios             os convênios que a clínica aceita
--   convenio_coberturas   quais serviços cada um cobre (a linha existir = cobre)
--   convenio_repasses     quanto a clínica recebe do convênio por serviço —
--                         DINHEIRO: só quem tem `valores` vê ou altera
--
-- Na pessoa: se é particular ou convênio, qual, a carteirinha e a validade.
-- Na consulta: se ela é particular ou pelo convênio — preenchido SOZINHO na
-- marcação (gatilho abaixo), inclusive quando quem marca é a Letícia ou a API.
--
-- ── A REGRA DA CONSULTA ─────────────────────────────────────────────────────
--
-- Marcou sem dizer como paga? Vale a ficha da pessoa:
--
--   · ficha "convênio X" e o serviço é coberto por X   → convênio X
--   · ficha "convênio X" e o serviço NÃO é coberto     → particular
--     (é exatamente o paciente de convênio virando particular: a conversão)
--   · ficha "particular"                               → particular
--   · ficha em branco                                  → em branco
--
-- A ficha preenchida DEPOIS da marcação completa as consultas futuras que
-- ficaram em branco. A equipe pode trocar à mão a qualquer momento.
--
-- ── CONVÊNIO NÃO SE APAGA, SE DESATIVA ──────────────────────────────────────
--
-- Pessoa e consulta apontam para o convênio com ON DELETE RESTRICT: apagar um
-- convênio em uso é recusado. Desativado, ele some da Letícia e das listas de
-- escolha, e o histórico continua dizendo a verdade.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. As tabelas
-- -----------------------------------------------------------------------------

create table if not exists public.convenios (
  id          uuid        primary key default gen_random_uuid(),
  nome        text        not null check (length(trim(nome)) between 1 and 80),
  ativo       boolean     not null default true,
  observacoes text,
  created_at  timestamptz not null default now()
);

create unique index if not exists convenios_nome_unico on public.convenios (lower(trim(nome)));

create table if not exists public.convenio_coberturas (
  convenio_id uuid not null references public.convenios(id) on delete cascade,
  servico_id  uuid not null references public.servicos_clinica(id) on delete cascade,
  primary key (convenio_id, servico_id)
);

create table if not exists public.convenio_repasses (
  convenio_id uuid          not null references public.convenios(id) on delete cascade,
  servico_id  uuid          not null references public.servicos_clinica(id) on delete cascade,
  valor       numeric(10,2) not null check (valor >= 0),
  primary key (convenio_id, servico_id)
);

comment on table public.convenio_repasses is
  'Quanto a clinica recebe do convenio por servico. Dinheiro: so quem tem a '
  'permissao valores le ou altera (RLS).';


-- -----------------------------------------------------------------------------
-- 2. Quem vê e quem mexe
-- -----------------------------------------------------------------------------
--
-- Convênios e coberturas são CADASTRO, como os serviços: toda a equipe lê (a
-- recepção precisa saber o que o convênio cobre), só quem configura altera.
-- O repasse é dinheiro: `valores`, para ler e para alterar.

alter table public.convenios           enable row level security;
alter table public.convenio_coberturas enable row level security;
alter table public.convenio_repasses   enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['convenios', 'convenio_coberturas'] loop
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

drop policy if exists "convenio_repasses_valores" on public.convenio_repasses;
create policy "convenio_repasses_valores" on public.convenio_repasses
  for all to authenticated
  using ((select public.pode('valores'))) with check ((select public.pode('valores')));

-- A chave pública não tem o que fazer aqui (0028).
revoke all on public.convenios, public.convenio_coberturas, public.convenio_repasses from anon;


-- -----------------------------------------------------------------------------
-- 3. Na pessoa
-- -----------------------------------------------------------------------------

alter table public.crm_clinica_dados
  add column if not exists forma_pagamento      text,
  add column if not exists convenio_id          uuid references public.convenios(id) on delete restrict,
  add column if not exists convenio_carteirinha text,
  add column if not exists convenio_validade    date;

alter table public.crm_clinica_dados drop constraint if exists crm_clinica_dados_forma_pagamento_check;
alter table public.crm_clinica_dados add constraint crm_clinica_dados_forma_pagamento_check check (
  forma_pagamento is null
  or (forma_pagamento = 'particular')
  or (forma_pagamento = 'convenio' and convenio_id is not null)
);

comment on column public.crm_clinica_dados.forma_pagamento is
  'particular | convenio | nulo (ainda nao se sabe). Com convenio, convenio_id '
  'diz qual.';

-- Permissão por coluna desde a 0031: coluna nova nasce invisível.
grant select (forma_pagamento, convenio_id, convenio_carteirinha, convenio_validade),
      update (forma_pagamento, convenio_id, convenio_carteirinha, convenio_validade)
   on public.crm_clinica_dados to authenticated;


-- -----------------------------------------------------------------------------
-- 4. Na consulta
-- -----------------------------------------------------------------------------

alter table public.consultas
  add column if not exists forma_pagamento text,
  add column if not exists convenio_id     uuid references public.convenios(id) on delete restrict;

alter table public.consultas drop constraint if exists consultas_forma_pagamento_check;
alter table public.consultas add constraint consultas_forma_pagamento_check check (
  forma_pagamento is null
  or (forma_pagamento = 'particular' and convenio_id is null)
  or (forma_pagamento = 'convenio' and convenio_id is not null)
);

-- Idem, desde a 0033 (e a tela lista as colunas em COLUNAS_CONSULTA).
grant select (forma_pagamento, convenio_id),
      insert (forma_pagamento, convenio_id),
      update (forma_pagamento, convenio_id)
   on public.consultas to authenticated;

create index if not exists consultas_convenio_idx on public.consultas (convenio_id) where convenio_id is not null;


-- -----------------------------------------------------------------------------
-- 5. A regra da consulta (ver o cabeçalho)
-- -----------------------------------------------------------------------------

create or replace function public.forma_pagamento_padrao(p_lead uuid, p_procedimento text)
returns table (forma_pagamento text, convenio_id uuid)
language sql
stable
set search_path = public
as $$
  select case
           when l.forma_pagamento = 'convenio' and exists (
             select 1
               from public.convenio_coberturas cc
               join public.servicos_clinica s on s.id = cc.servico_id
               join public.convenios cv on cv.id = cc.convenio_id and cv.ativo
              where cc.convenio_id = l.convenio_id
                and lower(trim(s.nome)) = lower(trim(p_procedimento))
           ) then 'convenio'
           when l.forma_pagamento is not null then 'particular'
         end,
         case
           when l.forma_pagamento = 'convenio' and exists (
             select 1
               from public.convenio_coberturas cc
               join public.servicos_clinica s on s.id = cc.servico_id
               join public.convenios cv on cv.id = cc.convenio_id and cv.ativo
              where cc.convenio_id = l.convenio_id
                and lower(trim(s.nome)) = lower(trim(p_procedimento))
           ) then l.convenio_id
         end
    from public.crm_clinica_dados l
   where l.id = p_lead
$$;

create or replace function public.consultas_forma_pagamento_padrao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  if new.forma_pagamento is null and new.lead_id is not null then
    select * into v from public.forma_pagamento_padrao(new.lead_id, new.procedimento);
    new.forma_pagamento := v.forma_pagamento;
    new.convenio_id     := v.convenio_id;
  end if;
  return new;
end;
$$;

drop trigger if exists consultas_forma_pagamento_padrao on public.consultas;
create trigger consultas_forma_pagamento_padrao
  before insert on public.consultas
  for each row execute function public.consultas_forma_pagamento_padrao();

-- A ficha preenchida depois: completa as consultas FUTURAS que ficaram em
-- branco. Nunca mexe no que alguém já escolheu.
create or replace function public.leads_completa_forma_pagamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.forma_pagamento is distinct from old.forma_pagamento
     or new.convenio_id is distinct from old.convenio_id then
    update public.consultas c
       set forma_pagamento = (select f.forma_pagamento from public.forma_pagamento_padrao(new.id, c.procedimento) f),
           convenio_id     = (select f.convenio_id     from public.forma_pagamento_padrao(new.id, c.procedimento) f)
     where c.lead_id = new.id
       and c.forma_pagamento is null
       and c.status = 'agendada'
       and c.data_consulta > now();
  end if;
  return new;
end;
$$;

drop trigger if exists leads_completa_forma_pagamento on public.crm_clinica_dados;
create trigger leads_completa_forma_pagamento
  after update of forma_pagamento, convenio_id on public.crm_clinica_dados
  for each row execute function public.leads_completa_forma_pagamento();

-- SECURITY DEFINER nos dois gatilhos, e é necessário: quem marca a consulta
-- (agenda) pode não enxergar a ficha da pessoa, e quem edita a ficha (pessoas)
-- pode não ter permissão de mexer na agenda. Sem isso, a regra falharia calada
-- justamente para a recepção. Gatilho não é chamável por ninguém, e a regra em
-- si fica fechada: só a chave de serviço (e os gatilhos, como donos) a usam.
revoke all on function public.forma_pagamento_padrao(uuid, text) from public, anon, authenticated;
grant execute on function public.forma_pagamento_padrao(uuid, text) to service_role;


-- -----------------------------------------------------------------------------
-- 6. A visão que a tela e a Letícia leem — a da 0031, com cinco colunas no fim
-- -----------------------------------------------------------------------------

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
    nao_perturbe_motivo,
    forma_pagamento,
    convenio_id,
    convenio_carteirinha,
    convenio_validade,
    (select cv.nome from public.convenios cv where cv.id = d.convenio_id) as convenio_nome
  from public.crm_clinica_dados d;

revoke all on public.crm_clinica from anon;


-- -----------------------------------------------------------------------------
-- 7. O que a Letícia lê
-- -----------------------------------------------------------------------------
--
-- A empresa ganha a linha "Convênios aceitos"; cada serviço, os convênios que
-- o cobrem. O prompt não muda de marcador: as duas visões já entram nele.

create or replace view public.informacoes_clinica_agente
with (security_invoker = true) as
select v.informacao
  from public.configuracoes_clinica c
  cross join lateral (
    values
      (1, 'Nome: '                || nullif(trim(c.nome_clinica), '')),
      (2, 'Rua: '                 || nullif(trim(c.endereco), '')),
      (3, 'Bairro: '              || nullif(trim(c.bairro), '')),
      (4, 'Cidade: '              || nullif(concat_ws('/',
                                       nullif(trim(c.cidade), ''),
                                       nullif(trim(c.estado), '')), '')),
      (5, 'CEP: '                 || regexp_replace(nullif(trim(c.cep), ''),
                                       '^(\d{5})(\d{3})$', '\1-\2')),
      (6, 'Atendimento: '         || public.jornada_texto(null)),
      (7, 'Link do Google Maps: ' || nullif(trim(c.google_maps_url), '')),
      (8, 'Instagram: '           || nullif(trim(c.instagram_url), '')),
      (9, 'Site: '                || nullif(trim(c.site_url), '')),
      (10, 'Convênios aceitos: '  || (select string_agg(cv.nome, ', ' order by cv.nome)
                                        from public.convenios cv where cv.ativo)
                                  || '. Quem não tem convênio é atendido no particular.')
  ) as v (ordem, informacao)
 where v.informacao is not null
 order by v.ordem;

create or replace view public.procedimentos_clinica_agente
with (security_invoker = true) as
select
  s.nome
  || coalesce(': ' || nullif(trim(s.descricao), ''), '')
  || case
       when s.exige_avaliacao and porta.nome is not null then
         '. Antes deste, marque ' || porta.nome || '.'
       when s.preco_a_partir_de = 0 then '. Sem custo.'
       when s.preco_a_partir_de > 0 then '. A partir de ' || public.reais(s.preco_a_partir_de) || '.'
       else ''
     end
  || coalesce(' Cobertura de convênio: ' || cob.nomes || '.', '') as procedimento
from public.servicos_clinica s
left join lateral (
  select a.nome
    from public.servicos_clinica a
   where a.e_avaliacao and a.ativo and a.id <> s.id
   limit 1
) porta on true
left join lateral (
  select string_agg(cv.nome, ', ' order by cv.nome) as nomes
    from public.convenio_coberturas cc
    join public.convenios cv on cv.id = cc.convenio_id and cv.ativo
   where cc.servico_id = s.id
) cob on true
where s.ativo
order by s.created_at;
