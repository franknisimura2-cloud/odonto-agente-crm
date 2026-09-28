-- =============================================================================
-- 0032 — minhas_permissoes(): o que a tela precisa saber, numa pergunta só
-- =============================================================================
--
-- A tela esconde o que o usuário não pode usar (a trava de verdade continua
-- nas políticas — ver a 0031). Para isso ela precisa das permissões dele.
--
-- Elas são CALCULADAS AQUI, pela mesma `pode()` das políticas — e não de novo
-- no JavaScript. Duas cópias da regra (o padrão de cada papel, a dona que
-- sempre pode) discordariam no primeiro ajuste, e a tela mostraria um botão
-- que o banco recusa, ou esconderia um que ele aceita.
--
-- ⚠️ A lista de permissões abaixo é a mesma do cabeçalho da 0031 e do tipo
-- `Permissao` em `src/lib/acesso.ts`. Permissão nova entra nos três.
-- =============================================================================

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
          'pessoas', 'crm', 'exportar', 'configurar', 'equipe'
        ]) as p
    )
  )
$$;

revoke all on function public.minhas_permissoes() from public, anon;
grant execute on function public.minhas_permissoes() to authenticated, service_role;
