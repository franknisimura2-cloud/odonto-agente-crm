-- =============================================================================
-- 0028 — A chave pública não lê nem marca nada
-- =============================================================================
--
-- A `anon key` vai dentro do bundle do navegador: qualquer pessoa que abra o
-- sistema consegue copiá-la, sem login. O que protege os dados dela é o RLS,
-- que só libera `authenticated`. Duas portas passavam por fora dele.
--
-- ── 1. `crm_clinica` PERDEU O `security_invoker` NA 0022 ─────────────────────
--
-- A 0022 apagou a view e a recriou com `create view ... as`, sem o
-- `with (security_invoker = true)` que ela tinha desde a 0001. Sem essa opção a
-- view roda como a dona (`postgres`), e a dona da tabela passa por cima do RLS.
-- No Supabase o `anon` recebe SELECT, INSERT, UPDATE e DELETE em toda tabela e
-- view nova do schema public (privilégio padrão). Juntando as duas coisas:
--
--   GET /rest/v1/crm_clinica   com a anon key → todos os contatos: nome,
--                                                WhatsApp, anotações, resumo
--   PATCH na mesma rota        → muda qualquer um deles
--
-- ── 2. AS FUNÇÕES `security definer` DA AGENDA ESTAVAM ABERTAS ─────────────────
--
-- A 0004 as fez `security definer` "para poderem escrever mesmo sendo
-- invocadas por um papel sem sessão". Mas quem as chama — a Edge Function
-- `whatsapp` e a `agenda` — usa a `service_role key`, que já passa pelo RLS.
-- A elevação nunca foi necessária para elas; só abriu a porta para quem não
-- deveria. O Postgres dá EXECUTE a `PUBLIC` em toda função nova, então:
--
--   POST /rest/v1/rpc/agenda_marcar    → cria contato e agendamento falsos
--   POST /rest/v1/rpc/agenda_cancelar  → cancela o agendamento de alguém
--                                        (basta o id)
--
-- As duas foram reproduzidas num banco de teste com os privilégios padrão do
-- Supabase, antes e depois desta migração.
--
-- ── A REGRA, DAQUI PARA FRENTE ────────────────────────────────────────────────
--
--   · View no schema public nasce com `with (security_invoker = true)`.
--     Recriar com drop/create PERDE a opção — foi assim que a 0022 errou.
--   · Função `security definer` só é executável pela `service_role`.
--     Drop + create (mudança de assinatura) devolve o EXECUTE a PUBLIC: repita
--     o revoke/grant desta migração na migração que recriar a função.
--     `create or replace` mantém as permissões.
--
-- A conferência das duas regras é a seção 10 do DATABASE.md, e as duas
-- consultas precisam voltar vazias.
-- =============================================================================

begin;

-- =============================================================================
-- 1. A VIEW VOLTA A RESPEITAR O RLS DE QUEM CONSULTA
-- =============================================================================

alter view public.crm_clinica set (security_invoker = true);

-- A 0022 deu acesso só a `authenticated` e `service_role`, e é essa a intenção;
-- o `anon` entrou pelo privilégio padrão do Supabase. Com o `security_invoker`
-- ele já não veria nenhuma linha (o RLS barra), mas não precisa nem da porta.
revoke all on public.crm_clinica from anon;


-- =============================================================================
-- 2. FUNÇÕES QUE PASSAM POR CIMA DO RLS: SÓ O SERVIDOR CHAMA
--
-- ⚠️ Revogar de `anon` sozinho não resolve (ver a 0024): o EXECUTE vem de
-- `PUBLIC`. Revoga-se dos três e devolve-se explicitamente à `service_role`,
-- que é a chave das Edge Functions — sem depender de ela ter um grant próprio.
--
-- Nenhuma tela chama estas funções: a recepção grava em `consultas` direto,
-- pelo RLS. Os gatilhos que usam `procedimento_existe()` são `security
-- definer` também, e rodam como a dona — não precisam do EXECUTE de quem
-- disparou.
--
-- As funções de gatilho (`handle_new_user`, `mensagens_atualiza_lead`,
-- `crm_valida_procedimentos`, `consulta_valida_procedimento`) ficam como
-- estão: o Postgres recusa chamá-las fora de um gatilho.
-- =============================================================================

revoke execute on function public.agenda_marcar(text, text, text, timestamptz, uuid, integer, text, text)
  from public, anon, authenticated;
revoke execute on function public.agenda_remarcar(uuid, timestamptz, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.agenda_cancelar(uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.api_token_valido(text)
  from public, anon, authenticated;
revoke execute on function public.agente_deve_responder(text)
  from public, anon, authenticated;
revoke execute on function public.procedimento_existe(text)
  from public, anon, authenticated;

grant execute on function public.agenda_marcar(text, text, text, timestamptz, uuid, integer, text, text)
  to service_role;
grant execute on function public.agenda_remarcar(uuid, timestamptz, uuid, text)
  to service_role;
grant execute on function public.agenda_cancelar(uuid, text, text)
  to service_role;
grant execute on function public.api_token_valido(text)
  to service_role;
grant execute on function public.agente_deve_responder(text)
  to service_role;
grant execute on function public.procedimento_existe(text)
  to service_role;

commit;


-- =============================================================================
-- CONFERÊNCIA
-- =============================================================================
--
-- A view respeita o RLS e continua gravável? (esperado: {security_invoker=true}, YES)
--   select c.reloptions, v.is_updatable
--     from pg_class c join information_schema.views v on v.table_name = c.relname
--    where c.relname = 'crm_clinica' and v.table_schema = 'public';
--
-- Quem chama as funções da agenda? (esperado: anon=false authenticated=false service_role=true)
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'execute')          as anon,
--          has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
--          has_function_privilege('service_role', p.oid, 'execute')  as service_role
--     from pg_proc p
--    where p.pronamespace = 'public'::regnamespace and p.prosecdef
--      and p.prorettype <> 'trigger'::regtype
--    order by 1;
