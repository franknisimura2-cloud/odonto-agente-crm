import { supabase } from './supabase'

/**
 * As colunas de `consultas` que a equipe pode ler — TODAS menos `valor_pago`.
 *
 * ⚠️ Nunca `select('*')` em `consultas` (migração 0033). O `*` pede todas as
 * colunas, e o valor pago não é mais da equipe: o banco responde "permission
 * denied for column", e a tela fica vazia. Use esta lista — e o valor, quando
 * a pessoa tem `valores`, vem por `valoresDasConsultas()`.
 *
 * Coluna nova em `consultas` entra aqui E num `grant` da migração que a criar.
 */
export const COLUNAS_CONSULTA =
  'id, lead_id, procedimento, data_consulta, status, observacoes, created_at, profissional_id, ' +
  'duracao_minutos, origem, chave_externa, cancelado_em, motivo_cancelamento, updated_at, data_fim, interesse, ' +
  'confirmada_em'

/**
 * Os valores pagos de um lote de consultas — só para quem tem `valores`, e só
 * das consultas que a pessoa já vê (a função do banco confere as duas coisas).
 * Sem a permissão, volta vazio.
 */
export async function valoresDasConsultas(ids: string[]): Promise<Map<string, number | null>> {
  if (ids.length === 0) return new Map()
  const { data } = await supabase.rpc('valores_das_consultas', { p_ids: ids })
  return new Map(((data ?? []) as { id: string; valor_pago: number | null }[]).map((v) => [v.id, v.valor_pago]))
}

/** Grava o valor pago de uma consulta. Recusa (42501) sem `valores`. */
export async function definirValorDaConsulta(id: string, valor: number | null): Promise<void> {
  const { error } = await supabase.rpc('definir_valor_pago_consulta', { p_id: id, p_valor: valor })
  if (error) throw error
}
