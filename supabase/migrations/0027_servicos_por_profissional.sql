-- =============================================================================
-- 0027 — Os serviços que cada profissional faz
-- =============================================================================
--
-- Numa barbearia, o João corta e faz barba; a Ana só faz coloração. Até aqui a
-- agenda não sabia disso: `agenda_marcar` escolhia o primeiro profissional
-- livre em ordem alfabética (`order by p.nome limit 1`), e a atendente marcava
-- coloração com o João porque ele estava livre às 14h.
--
-- ── A REGRA, EM UMA FRASE ────────────────────────────────────────────────────
--
-- **Lista vazia = faz tudo.** Um profissional sem nenhuma linha aqui continua
-- como sempre foi: atende qualquer serviço. Com linhas, ele atende só aqueles.
--
-- É o que faz desta migração uma mudança sem susto: quem já usa o sistema não
-- precisa cadastrar nada, e nenhum agendamento muda de dono. A empresa só
-- preenche a lista de quem é especialista.
--
-- ── ONDE A REGRA VALE ────────────────────────────────────────────────────────
--
--   • `agenda_profissionais_livres` — a escolha automática de quem atende.
--   • `agenda_horarios_disponiveis` e `agenda_proxima_vaga` — os horários que
--     a atendente oferece, agora só de quem faz o serviço pedido.
--   • `agenda_marcar` — recusa com `profissional_nao_faz` quando alguém pede um
--     profissional específico que não faz aquilo, e diz quem faz.
--   • `agenda_remarcar` — idem, quando a remarcação troca de profissional.
--   • `profissionais_clinica_agente` — a lista que a atendente lê ganha
--     "Só faz: ..." em quem tem lista, para ela não oferecer o que o sistema
--     vai recusar.
--
-- ⚠️ A RECEPÇÃO PASSA POR FORA, como na porta de entrada (0018): o modal de
-- Novo Agendamento grava direto em `consultas`. A tela avisa, mas deixa marcar
-- — a regra existe para o agente não decidir pela empresa, não para impedir a
-- empresa de encaixar alguém.
--
-- ⚠️ TRÊS FUNÇÕES MUDAM DE ASSINATURA e vão com `drop` antes: acrescentar
-- parâmetro cria uma SOBRECARGA, não substitui — e com duas versões no catálogo
-- o PostgREST responde "function is not unique" e derruba as duas portas de uma
-- vez (a mesma armadilha da 0018). Os parâmetros novos têm padrão, então quem
-- chama sem eles continua funcionando igual.
--
-- ⚠️ E HÁ UM CONSERTO DE CARONA, na `agenda_marcar`: a porta de entrada nunca
-- manda marcar a si mesma. Se alguém ligasse `exige_avaliacao` na própria
-- porta por fora da tela, ela seria recusada com "marque a porta" — ela mesma —
-- e a atendente ficaria presa num círculo. A view já se protegia (0026).
-- =============================================================================

begin;


-- =============================================================================
-- 1. A TABELA
--
-- Ligação de muitos para muitos, e não uma coluna `text[]` em `profissionais`:
-- aqui o vínculo é por `id`, então renomear um serviço não quebra a lista de
-- ninguém — e apagar um serviço tira ele das listas sozinho (`cascade`).
--
-- ⚠️ CONSEQUÊNCIA DO CASCADE: se o serviço apagado era o ÚNICO da lista de
-- alguém, a lista fica vazia — e vazia quer dizer "faz tudo". É o caso raro de
-- apagar a especialidade inteira de um especialista. Desativar o serviço, em
-- vez de apagar, não tem esse efeito: a linha fica, e o profissional continua
-- restrito a ele.
-- =============================================================================

create table public.profissional_servicos (
  profissional_id uuid        not null references public.profissionais(id)    on delete cascade,
  servico_id      uuid        not null references public.servicos_clinica(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (profissional_id, servico_id)
);

-- A chave primária já cobre "os serviços do profissional X". Este cobre o
-- outro lado: "quem faz o serviço Y", que é a pergunta da agenda.
create index profissional_servicos_servico_idx
  on public.profissional_servicos (servico_id);

comment on table public.profissional_servicos is
  'Os servicos que cada profissional faz. Profissional SEM nenhuma linha faz '
  'todos -- a lista existe para restringir, e so quem tem lista e restrito. '
  'Lida pela agenda (profissional_faz) e pela view profissionais_clinica_agente.';

alter table public.profissional_servicos enable row level security;

create policy "profissional_servicos_all" on public.profissional_servicos
  for all to authenticated using (true) with check (true);


-- =============================================================================
-- 2. AS DUAS PERGUNTAS DE BASE
-- =============================================================================

-- "Este profissional faz este serviço?" — a regra inteira mora aqui. Compara
-- sem caixa e sem espaço nas pontas, como `procedimento_existe` (0022): o que
-- chega foi escrito por um modelo de linguagem.
--
-- Serviço nulo responde que sim: quem pergunta sem dizer o serviço está na
-- regra antiga, sem filtro.
create or replace function public.profissional_faz(p_profissional uuid, p_servico text)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_servico is null
      or not exists (
           select 1 from public.profissional_servicos ps
            where ps.profissional_id = p_profissional
         )
      or exists (
           select 1
             from public.profissional_servicos ps
             join public.servicos_clinica s on s.id = ps.servico_id
            where ps.profissional_id = p_profissional
              and lower(trim(s.nome)) = lower(trim(p_servico))
         );
$$;

comment on function public.profissional_faz(uuid, text) is
  'O profissional faz este servico? Sim quando a lista dele em '
  'profissional_servicos esta vazia (faz tudo) ou contem o servico. Servico '
  'nulo = sem filtro = sim.';

-- "Quem pede isto sai com o quê na agenda?" — o próprio serviço, ou a porta de
-- entrada quando ele passa por ela (0018, 0026). E quanto tempo ocupa.
--
-- Existe para a DISPONIBILIDADE: a atendente pergunta pelos horários de
-- "Lentes de Contato", mas o que vai para a agenda é a avaliação — com a
-- duração dela e os profissionais que fazem ela. Sem isto, os horários
-- oferecidos seriam os de quem faz lentes, e a marcação da avaliação poderia
-- não caber em nenhum deles.
--
-- Vazio quando o nome não é de um serviço ativo.
create or replace function public.servico_a_agendar(p_nome text)
returns table (nome text, duracao_minutos integer)
language sql
stable
set search_path = public
as $$
  select coalesce(porta.nome, s.nome),
         coalesce(porta.duracao_minutos, s.duracao_minutos)
    from public.servicos_clinica s
    left join lateral (
      select a.nome, a.duracao_minutos
        from public.servicos_clinica a
       where s.exige_avaliacao and a.e_avaliacao and a.ativo and a.id <> s.id
       limit 1
    ) porta on true
   where lower(trim(s.nome)) = lower(trim(p_nome))
     and s.ativo
   limit 1;
$$;

comment on function public.servico_a_agendar(text) is
  'O servico que vai de fato para a agenda quando alguem pede p_nome: a porta '
  'de entrada, se ele passa por ela; ele mesmo, nos outros casos. Com a '
  'duracao. Vazio se o nome nao e de um servico ativo.';


-- =============================================================================
-- 3. QUEM ESTÁ LIVRE — agora, quem está livre E faz o serviço
--
-- O `p_procedimento` aqui é LITERAL: quem chama já sabe o que vai marcar
-- (`agenda_marcar` só chega neste ponto depois de a porta ter sido resolvida).
-- =============================================================================

drop function if exists public.agenda_profissionais_livres(timestamptz, integer);

create function public.agenda_profissionais_livres(
  p_inicio       timestamptz,
  p_duracao      integer default 60,
  p_procedimento text    default null
)
returns table (profissional_id uuid, nome text)
language sql
stable
as $$
  with cfg as (
    select coalesce(max(fuso_horario), 'America/Sao_Paulo') as fuso
      from public.configuracoes_clinica
  ),
  janela as (
    select p_inicio as ini, p_inicio + make_interval(mins => p_duracao) as fim
  )
  select p.id, trim(p.nome || ' ' || p.sobrenome)
    from public.profissionais p
    join public.profissional_horarios h
      on h.profissional_id = p.id and h.ativo
   cross join cfg
   cross join janela j
   where p.ativo
     and public.profissional_faz(p.id, p_procedimento)
     and h.dia_semana = extract(dow from (j.ini at time zone cfg.fuso))::smallint
     and (j.ini at time zone cfg.fuso)::time >= h.hora_inicio
     and (j.fim at time zone cfg.fuso)::time <= h.hora_fim
     and not exists (
       select 1 from public.consultas c
        where c.profissional_id = p.id
          and c.status = 'agendada'
          and tstzrange(c.data_consulta, c.data_fim) && tstzrange(j.ini, j.fim)
     )
     and not exists (
       select 1 from public.profissional_bloqueios b
        where (b.profissional_id is null or b.profissional_id = p.id)
          and tstzrange(b.inicio, b.fim) && tstzrange(j.ini, j.fim)
     )
   order by p.nome;
$$;


-- =============================================================================
-- 4. OS HORÁRIOS DE UM DIA — só de quem faz o serviço, com a duração dele
--
-- `p_duracao` passou a ter padrão NULO: sem duração explícita, vale a do
-- serviço (a avaliação ocupa 30 minutos, e não 60). Sem serviço e sem duração,
-- continua 60 — exatamente o que era.
-- =============================================================================

drop function if exists public.agenda_horarios_disponiveis(date, uuid, integer, integer);

create function public.agenda_horarios_disponiveis(
  p_data         date,
  p_profissional uuid    default null,
  p_duracao      integer default null,
  p_passo        integer default 30,
  p_procedimento text    default null
)
returns table (horario timestamptz)
language sql
stable
as $$
  with cfg as (
    select coalesce(max(fuso_horario), 'America/Sao_Paulo') as fuso
      from public.configuracoes_clinica
  ),
  -- O que vai de fato para a agenda: a porta, quando o pedido passa por ela.
  -- Vazio sem serviço (ou com nome fora do catálogo): aí não há filtro.
  alvo as (
    select a.nome, a.duracao_minutos
      from public.servico_a_agendar(p_procedimento) a
  ),
  dur as (
    select coalesce(p_duracao, (select duracao_minutos from alvo), 60) as minutos
  ),
  jornada as (
    select h.profissional_id, h.hora_inicio, h.hora_fim
      from public.profissional_horarios h
      join public.profissionais p on p.id = h.profissional_id
     where h.ativo
       and p.ativo
       and h.dia_semana = extract(dow from p_data)::smallint
       and (p_profissional is null or h.profissional_id = p_profissional)
       and public.profissional_faz(h.profissional_id, (select nome from alvo))
  ),
  slots as (
    select j.profissional_id,
           (s at time zone cfg.fuso) as inicio
      from jornada j
     cross join cfg
     cross join dur
     cross join lateral generate_series(
       (p_data + j.hora_inicio)::timestamp,
       (p_data + j.hora_fim)::timestamp - make_interval(mins => dur.minutos),
       make_interval(mins => p_passo)
     ) as s
  )
  select distinct s.inicio
    from slots s
   cross join dur
   where s.inicio > now()
     and not exists (
       select 1 from public.consultas c
        where c.profissional_id = s.profissional_id
          and c.status = 'agendada'
          and tstzrange(c.data_consulta, c.data_fim)
              && tstzrange(s.inicio, s.inicio + make_interval(mins => dur.minutos))
     )
     and not exists (
       select 1 from public.profissional_bloqueios b
        where (b.profissional_id is null or b.profissional_id = s.profissional_id)
          and tstzrange(b.inicio, b.fim)
              && tstzrange(s.inicio, s.inicio + make_interval(mins => dur.minutos))
     )
   order by 1;
$$;


-- =============================================================================
-- 5. O PRÓXIMO DIA COM VAGA — passando o serviço adiante
-- =============================================================================

drop function if exists public.agenda_proxima_vaga(date, uuid, integer);

create function public.agenda_proxima_vaga(
  p_a_partir_de  date,
  p_profissional uuid    default null,
  p_duracao      integer default null,
  p_procedimento text    default null
)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_dia date;
  v_horario timestamptz;
begin
  for i in 0..60 loop
    v_dia := p_a_partir_de + i;
    select h.horario into v_horario
      from public.agenda_horarios_disponiveis(
             p_data         => v_dia,
             p_profissional => p_profissional,
             p_duracao      => p_duracao,
             p_procedimento => p_procedimento
           ) h
     limit 1;
    if v_horario is not null then
      return v_horario;
    end if;
  end loop;
  return null;
end;
$$;


-- =============================================================================
-- 6. QUEM FAZ — a resposta que acompanha a recusa
--
-- "A Ana não faz corte" sem dizer quem faz é uma recusa sem saída. Os
-- profissionais ATIVOS que podem receber o pedido, já resolvida a porta.
-- =============================================================================

create or replace function public.agenda_quem_faz(p_procedimento text)
returns table (profissional_id uuid, nome text)
language sql
stable
set search_path = public
as $$
  select p.id, trim(p.nome || ' ' || coalesce(p.sobrenome, ''))
    from public.profissionais p
   where p.ativo
     and public.profissional_faz(
           p.id,
           (select a.nome from public.servico_a_agendar(p_procedimento) a)
         )
   order by p.nome, p.sobrenome;
$$;

comment on function public.agenda_quem_faz(text) is
  'Profissionais ativos que podem receber um pedido deste servico (ja '
  'resolvida a porta de entrada). E o que acompanha a recusa '
  'profissional_nao_faz.';


-- =============================================================================
-- 7. MARCAR
--
-- Gerada da definição que estava no banco (0023, pelo `pg_get_functiondef()`).
-- Três mudanças, marcadas com "0027" no corpo:
--
--   1. A escolha automática passa o serviço para `agenda_profissionais_livres`.
--   2. Profissional pedido que não faz o serviço é recusado com
--      `profissional_nao_faz`, e `sugestao` diz quem faz.
--   3. A porta de entrada não manda marcar a si mesma.
--
-- Assinatura e retorno iguais: `create or replace` basta, sem `drop`.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.agenda_marcar(p_nome text, p_whatsapp text, p_procedimento text, p_data_hora timestamp with time zone, p_profissional_id uuid DEFAULT NULL::uuid, p_duracao integer DEFAULT NULL::integer, p_chave_externa text DEFAULT NULL::text, p_interesse text DEFAULT NULL::text)
 RETURNS TABLE(ok boolean, motivo text, consulta_id uuid, data_hora timestamp with time zone, profissional text, sugestao text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_whats  text;
  v_lead   uuid;
  v_prof   uuid;
  v_nome   text;
  v_id     uuid;
  v_fuso   text;
  v_dia    date;
  v_serv   record;
  v_porta  text;
  v_dur    integer;
begin
  -- IDEMPOTÊNCIA: mesma chave, mesma consulta. Retry do n8n não duplica.
  if p_chave_externa is not null then
    select c.id, c.data_consulta, trim(coalesce(pr.nome,'') || ' ' || coalesce(pr.sobrenome,''))
      into v_id, data_hora, v_nome
      from public.consultas c
      left join public.profissionais pr on pr.id = c.profissional_id
     where c.chave_externa = p_chave_externa;
    if v_id is not null then
      return query select true, null::text, v_id, data_hora, nullif(v_nome,''), null::text;
      return;
    end if;
  end if;

  v_whats := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  if length(v_whats) < 10 then
    return query select false, 'whatsapp_invalido', null::uuid, null::timestamptz, null::text, null::text;
    return;
  end if;

  if p_data_hora is null or p_procedimento is null or trim(p_procedimento) = '' then
    return query select false, 'dados_invalidos', null::uuid, null::timestamptz, null::text, null::text;
    return;
  end if;

  -- A PORTA DE ENTRADA. Casa por nome, sem diferenciar maiúscula nem espaço
  -- sobrando: o que chega aqui foi escrito por um modelo de linguagem.
  select s.id, s.nome, s.exige_avaliacao, s.duracao_minutos, s.e_avaliacao
    into v_serv
    from public.servicos_clinica s
   where lower(trim(s.nome)) = lower(trim(p_procedimento))
     and s.ativo
   limit 1;

  -- PROCEDIMENTO QUE NÃO EXISTE É RECUSA, NÃO É PADRÃO.
  --
  -- Antes, `not found` seguia adiante com 60 minutos e SEM conferir a
  -- avaliação. Marcar "Lente de Contato" no singular passava por fora da porta
  -- de entrada, calado — a trava existia e escapava pela grafia.
  --
  -- A trigger `consultas_procedimento_valido` já barraria isso, mas com uma
  -- exceção `23514`: para quem chama pela ferramenta, exceção vira "não
  -- consegui acessar a agenda", que manda procurar defeito no lugar errado.
  -- Recusa de negócio tem que voltar como recusa, com motivo.
  if not found then
    return query select false, 'procedimento_desconhecido', null::uuid,
                        null::timestamptz, null::text, null::text;
    return;
  end if;

  -- E o nome vai gravado como está no catálogo, não como veio escrito.
  p_procedimento := v_serv.nome;

  if v_serv.exige_avaliacao then
    -- 0027: `a.id <> v_serv.id` — a porta nunca manda marcar a si mesma.
    select a.nome into v_porta
      from public.servicos_clinica a
     where a.e_avaliacao and a.ativo and a.id <> v_serv.id
     limit 1;
    -- Sem porta cadastrada não há para onde mandar, e recusar deixaria o
    -- paciente sem saída. Marca como antes.
    if v_porta is not null then
      return query select false, 'exige_avaliacao', null::uuid, null::timestamptz, null::text, v_porta;
      return;
    end if;
  end if;

  v_dur := coalesce(p_duracao, v_serv.duracao_minutos, 60);

  select coalesce(max(fuso_horario), 'America/Sao_Paulo') into v_fuso
    from public.configuracoes_clinica;
  v_dia := (p_data_hora at time zone v_fuso)::date;

  -- Escolha do profissional
  if p_profissional_id is null then
    -- 0027: só entre quem faz o serviço.
    select l.profissional_id, l.nome into v_prof, v_nome
      from public.agenda_profissionais_livres(p_data_hora, v_dur, v_serv.nome) l
     limit 1;
    if v_prof is null then
      return query select false, 'sem_profissional_livre', null::uuid, null::timestamptz, null::text, null::text;
      return;
    end if;
  else
    if not exists (select 1 from public.profissionais where id = p_profissional_id and ativo) then
      return query select false, 'profissional_inexistente', null::uuid, null::timestamptz, null::text, null::text;
      return;
    end if;
    -- 0027: PEDIU ALGUÉM QUE NÃO FAZ ISSO. Antes de olhar a agenda dele: não
    -- adianta dizer "ele está ocupado" para quem nunca poderia fazer. E a
    -- recusa diz quem faz, em `sugestao` — sem isso ela não tem saída.
    if not public.profissional_faz(p_profissional_id, v_serv.nome) then
      return query select false, 'profissional_nao_faz', null::uuid, null::timestamptz, null::text,
        (select string_agg(q.nome, ', ' order by q.nome) from public.agenda_quem_faz(v_serv.nome) q);
      return;
    end if;
    -- Motivo preciso: o agente precisa saber SE é horário ocupado (oferece
    -- outro) ou fora de expediente (oferece outro dia). "Não deu" não serve.
    if not exists (
      select 1 from public.profissional_horarios h
       where h.profissional_id = p_profissional_id and h.ativo
         and h.dia_semana = extract(dow from (p_data_hora at time zone v_fuso))::smallint
         and (p_data_hora at time zone v_fuso)::time >= h.hora_inicio
         and ((p_data_hora + make_interval(mins => v_dur)) at time zone v_fuso)::time <= h.hora_fim
    ) then
      return query select false, 'fora_expediente', null::uuid, null::timestamptz, null::text, null::text;
      return;
    end if;
    if exists (
      select 1 from public.profissional_bloqueios b
       where (b.profissional_id is null or b.profissional_id = p_profissional_id)
         and tstzrange(b.inicio, b.fim)
             && tstzrange(p_data_hora, p_data_hora + make_interval(mins => v_dur))
    ) then
      return query select false, 'fora_expediente', null::uuid, null::timestamptz, null::text, null::text;
      return;
    end if;
    v_prof := p_profissional_id;
    select trim(nome || ' ' || sobrenome) into v_nome from public.profissionais where id = v_prof;
  end if;

  -- Paciente: acha pelo WhatsApp, cria se não existir.
  select id into v_lead from public.crm_clinica_dados where whatsapp_lead = v_whats;
  if v_lead is null then
    insert into public.crm_clinica_dados (nome_lead, whatsapp_lead, status, inicio_atendimento)
    values (nullif(trim(coalesce(p_nome,'')), ''), v_whats, 'iniciou_conversa', now())
    returning id into v_lead;
  else
    -- O NOME, QUANDO A FICHA AINDA NÃO TEM UM.
    --
    -- Antes disto, `p_nome` só era usado na CRIAÇÃO do lead. Quem já vinha
    -- conversando há meia hora -- que é o caso normal, porque a conversa cria
    -- a ficha na primeira mensagem -- tinha o nome perguntado, confirmado e
    -- jogado fora: a linha já existia, e o insert nunca rodava.
    --
    -- E este é o nome mais confiável que o sistema chega a ver. Não é o
    -- `pushName` do WhatsApp (o apelido do perfil, que por isso é ignorado);
    -- é o nome completo que a pessoa ditou para ser registrado numa consulta.
    --
    -- ⚠️ **Só preenche o que está vazio.** Um nome já gravado pode ter sido
    -- digitado pela recepção, e a recepção fala com a pessoa na cadeira. O
    -- agente não sobrescreve isso.
    update public.crm_clinica_dados
       set nome_lead = nullif(trim(coalesce(p_nome, '')), '')
     where id = v_lead
       and nullif(trim(coalesce(nome_lead, '')), '') is null
       and nullif(trim(coalesce(p_nome, '')), '') is not null;
  end if;

  -- O INTERESSE, QUANDO NINGUÉM MANDOU. Só vale para a avaliação: é a única
  -- consulta em que "o que a pessoa quer" é diferente do que está marcado. Numa
  -- limpeza, o procedimento JÁ é o que ela quer, e copiar a ficha para cá
  -- encheria a agenda de "Limpeza · Lentes de Contato".
  --
  -- Vem de `procedimento_interesse`, que a Letícia mantém pela `atualizar_ficha`.
  -- É palpite? Não: é o que ela registrou desta pessoa, e no ato de marcar é o
  -- valor corrente. O que ela mandar explícito continua ganhando.
  if nullif(trim(coalesce(p_interesse, '')), '') is null
     and coalesce(v_serv.e_avaliacao, false) then
    select nullif(trim(coalesce(d.procedimentos_interesse[1], '')), '')
      into p_interesse
      from public.crm_clinica_dados d
     where d.id = v_lead;
  end if;

  begin
    insert into public.consultas (
      lead_id, profissional_id, procedimento, data_consulta,
      duracao_minutos, status, origem, chave_externa, interesse
    ) values (
      v_lead, v_prof, trim(p_procedimento), p_data_hora,
      v_dur, 'agendada', 'agente_ia', p_chave_externa,
      nullif(trim(coalesce(p_interesse, '')), '')
    ) returning id into v_id;
  exception
    -- 23P01: a restrição de exclusão pegou uma sobreposição criada entre a
    -- checagem acima e este insert. É o caso da recepção marcando no mesmo
    -- instante — raro, e exatamente por isso o banco é quem decide.
    when exclusion_violation then
      return query select false, 'horario_ocupado', null::uuid, null::timestamptz, null::text, null::text;
      return;
  end;

  return query select true, null::text, v_id, p_data_hora, v_nome, null::text;
end;
$function$;

comment on function public.agenda_marcar is
  'Marca pelos agentes (Leticia por RPC, API externa pelos endpoints). Recusa '
  'o servico que passa pela porta de entrada (sugestao = a porta) e o '
  'profissional que nao faz o servico (sugestao = quem faz). A recepcao nao '
  'passa por aqui -- grava direto.';


-- =============================================================================
-- 8. REMARCAR
--
-- Gerada da definição do banco (0004). Duas mudanças, marcadas com "0027":
--
--   1. Quem troca de profissional na remarcação só pode ir para alguém que faz
--      o serviço da consulta — senão, `profissional_nao_faz`. (O retorno desta
--      função não tem `sugestao`; mudar isso exigiria `drop`, e só a API externa
--      troca de profissional aqui.)
--   2. Consulta sem profissional, remarcada sem profissional, escolhe só entre
--      quem faz o serviço.
--
-- Manter o mesmo profissional não passa pela conferência: a consulta já era
-- dele, e mudar a hora não muda quem atende.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.agenda_remarcar(p_consulta_id uuid, p_nova_data_hora timestamp with time zone, p_profissional_id uuid DEFAULT NULL::uuid, p_whatsapp text DEFAULT NULL::text)
 RETURNS TABLE(ok boolean, motivo text, data_hora timestamp with time zone, profissional text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_c record;
  v_whats text;
  v_prof uuid;
  v_nome text;
  v_fuso text;
  v_dur integer;
begin
  select c.id, c.status, c.duracao_minutos, c.profissional_id, c.procedimento, d.whatsapp_lead
    into v_c
    from public.consultas c
    join public.crm_clinica_dados d on d.id = c.lead_id
   where c.id = p_consulta_id;

  if v_c is null then
    return query select false, 'nao_encontrada', null::timestamptz, null::text;
    return;
  end if;

  if p_whatsapp is not null then
    v_whats := regexp_replace(p_whatsapp, '[^0-9]', '', 'g');
    if v_c.whatsapp_lead is distinct from v_whats then
      return query select false, 'nao_pertence', null::timestamptz, null::text;
      return;
    end if;
  end if;

  if v_c.status <> 'agendada' then
    return query select false, 'nao_encontrada', null::timestamptz, null::text;
    return;
  end if;

  v_dur := v_c.duracao_minutos;
  select coalesce(max(fuso_horario), 'America/Sao_Paulo') into v_fuso
    from public.configuracoes_clinica;

  -- 0027: trocar para alguém que não faz o serviço desta consulta.
  if p_profissional_id is not null
     and p_profissional_id is distinct from v_c.profissional_id
     and not public.profissional_faz(p_profissional_id, v_c.procedimento) then
    return query select false, 'profissional_nao_faz', null::timestamptz, null::text;
    return;
  end if;

  v_prof := coalesce(p_profissional_id, v_c.profissional_id);

  if v_prof is null then
    -- 0027: só entre quem faz o serviço da consulta.
    select l.profissional_id, l.nome into v_prof, v_nome
      from public.agenda_profissionais_livres(p_nova_data_hora, v_dur, v_c.procedimento) l
     limit 1;
    if v_prof is null then
      return query select false, 'sem_profissional_livre', null::timestamptz, null::text;
      return;
    end if;
  else
    if not exists (
      select 1 from public.profissional_horarios h
       where h.profissional_id = v_prof and h.ativo
         and h.dia_semana = extract(dow from (p_nova_data_hora at time zone v_fuso))::smallint
         and (p_nova_data_hora at time zone v_fuso)::time >= h.hora_inicio
         and ((p_nova_data_hora + make_interval(mins => v_dur)) at time zone v_fuso)::time <= h.hora_fim
    ) then
      return query select false, 'fora_expediente', null::timestamptz, null::text;
      return;
    end if;
    -- A própria consulta fica de fora da checagem: ela está sendo movida, e
    -- adiar em 30 minutos faria o horário antigo brigar com o novo.
    if exists (
      select 1 from public.consultas c
       where c.profissional_id = v_prof
         and c.status = 'agendada'
         and c.id <> p_consulta_id
         and tstzrange(c.data_consulta, c.data_fim)
             && tstzrange(p_nova_data_hora, p_nova_data_hora + make_interval(mins => v_dur))
    ) then
      return query select false, 'horario_ocupado', null::timestamptz, null::text;
      return;
    end if;
    select trim(nome || ' ' || sobrenome) into v_nome from public.profissionais where id = v_prof;
  end if;

  begin
    update public.consultas
       set data_consulta = p_nova_data_hora,
           profissional_id = v_prof
     where id = p_consulta_id;
  exception
    when exclusion_violation then
      return query select false, 'horario_ocupado', null::timestamptz, null::text;
      return;
  end;

  return query select true, null::text, p_nova_data_hora, v_nome;
end;
$function$;


-- =============================================================================
-- 9. A LISTA QUE A ATENDENTE LÊ
--
-- "Ana Souza: atende segunda a sexta das 08:00 às 18:00. Só faz: Coloração,
-- Mechas." — só em quem tem lista. Quem não tem continua como era, e o prompt
-- explica que sem "Só faz" o profissional faz tudo.
--
-- Sem isto ela ofereceria a Ana para um corte, e a agenda recusaria na hora de
-- marcar, na frente do cliente.
--
-- ⚠️ QUEM TEM LISTA SÓ DE SERVIÇOS DESATIVADOS não pode sumir da frase: sem o
-- "Só faz", ela leria que a pessoa faz tudo, enquanto a agenda não a oferece
-- para nada. A frase diz isso com todas as letras.
-- =============================================================================

create or replace view public.profissionais_clinica_agente
with (security_invoker = true) as
select
  trim(p.nome || ' ' || coalesce(p.sobrenome, ''))
  || coalesce(': atende ' || public.jornada_texto(p.id), '')
  || case
       when exists (select 1 from public.profissional_servicos ps where ps.profissional_id = p.id) then
         '. Só faz: ' || coalesce(
           (select string_agg(s.nome, ', ' order by s.created_at)
              from public.profissional_servicos ps
              join public.servicos_clinica s on s.id = ps.servico_id
             where ps.profissional_id = p.id and s.ativo),
           'nenhum serviço ativo no momento') || '.'
       else ''
     end as profissional
from public.profissionais p
where p.ativo
order by p.nome, p.sobrenome;

comment on view public.profissionais_clinica_agente is
  'Profissionais ativos em frases prontas, um por linha, com a jornada de cada '
  'um e, para quem tem lista, os servicos que faz ("So faz: ..."). Sem lista, '
  'faz todos. Nao traz o id: para marcar com alguem especifico, use GET '
  '/profissionais da API.';

commit;


-- =============================================================================
-- CONFERÊNCIA
-- =============================================================================
--
--   -- uma versão só de cada função da agenda (duas = "function is not unique")
--   select p.oid::regprocedure from pg_proc p where proname like 'agenda_%' order by 1;
--
--   -- quem faz o quê
--   select pr.nome, coalesce(string_agg(s.nome, ', '), '(todos)')
--     from public.profissionais pr
--     left join public.profissional_servicos ps on ps.profissional_id = pr.id
--     left join public.servicos_clinica s on s.id = ps.servico_id
--    group by pr.nome;
--
--   select profissional from public.profissionais_clinica_agente;
