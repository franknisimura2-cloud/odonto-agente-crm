import { supabase } from './supabase'

/**
 * Retorno combinado (migração 0048): a equipe marca uma data e o motivo, e no
 * dia a assistente manda UMA mensagem sobre aquele assunto.
 *
 * O banco é quem guarda as regras: data no passado é recusada, "enviado" só o
 * servidor marca, cancelado não volta e ninguém apaga. A tela só pede.
 */

export type SituacaoRetorno = 'agendado' | 'enviado' | 'cancelado'

export interface RetornoCombinado {
  id: string
  lead_id: string
  para_data: string
  motivo: string
  situacao: SituacaoRetorno
  created_at: string
  enviado_em: string | null
  texto: string | null
  cancelado_em: string | null
  criado_por: string | null
  lead?: { id: string; nome_lead: string | null; whatsapp_lead: string | null } | null
  autor?: { nome: string | null } | null
}

const COLUNAS = 'id,lead_id,para_data,motivo,situacao,created_at,enviado_em,texto,cancelado_em,criado_por,autor:usuarios!retornos_combinados_criado_por_fkey(nome)'

/** `AAAA-MM-DD` de hoje, no relógio de quem está usando a tela. */
export function hojeISO(): string {
  return new Date().toLocaleDateString('en-CA')
}

/** `AAAA-MM-DD` daqui a N meses (o atalho "daqui a 6 meses"). */
export function daquiAMeses(meses: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + meses)
  return d.toLocaleDateString('en-CA')
}

export function dataBR(iso: string): string {
  return iso.slice(0, 10).split('-').reverse().join('/')
}

export async function retornosDaPessoa(leadId: string): Promise<RetornoCombinado[]> {
  const { data, error } = await supabase.from('retornos_combinados')
    .select(COLUNAS).eq('lead_id', leadId)
    .order('para_data', { ascending: false }).limit(50)
  if (error) throw error
  return (data ?? []) as unknown as RetornoCombinado[]
}

export async function todosOsRetornos(): Promise<RetornoCombinado[]> {
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data, error } = await supabase.from('retornos_combinados')
    .select(`${COLUNAS},lead:crm_clinica_dados(id,nome_lead,whatsapp_lead)`)
    .or(`situacao.eq.agendado,and(situacao.eq.enviado,enviado_em.gte.${desde})`)
    .order('para_data', { ascending: true }).limit(500)
  if (error) throw error
  return (data ?? []) as unknown as RetornoCombinado[]
}

export async function combinarRetorno(leadId: string, paraData: string, motivo: string): Promise<void> {
  const { error } = await supabase.from('retornos_combinados')
    .insert({ lead_id: leadId, para_data: paraData, motivo: motivo.trim() })
  if (error) throw error
}

export async function alterarRetorno(id: string, paraData: string, motivo: string): Promise<void> {
  const { error } = await supabase.from('retornos_combinados')
    .update({ para_data: paraData, motivo: motivo.trim() }).eq('id', id)
  if (error) throw error
}

export async function cancelarRetorno(id: string): Promise<void> {
  const { error } = await supabase.from('retornos_combinados')
    .update({ situacao: 'cancelado' }).eq('id', id)
  if (error) throw error
}

/**
 * Quem respondeu depois de ser procurado: para cada pessoa, a primeira
 * mensagem dela depois do contato. Uma consulta só, para a lista inteira.
 */
export async function quemRespondeu(enviados: RetornoCombinado[]): Promise<Set<string>> {
  const comData = enviados.filter((r) => r.enviado_em)
  if (!comData.length) return new Set()
  const desde = comData.reduce((m, r) => (r.enviado_em! < m ? r.enviado_em! : m), comData[0].enviado_em!)
  const { data } = await supabase.from('mensagens_whatsapp')
    .select('lead_id,criada_em')
    .eq('autor', 'paciente')
    .in('lead_id', [...new Set(comData.map((r) => r.lead_id))])
    .gt('criada_em', desde)
    .limit(1000)
  const respondeu = new Set<string>()
  for (const r of comData) {
    if ((data ?? []).some((m) => m.lead_id === r.lead_id && m.criada_em > r.enviado_em!)) respondeu.add(r.id)
  }
  return respondeu
}

/** O erro do banco, em frase de gente. */
export function mensagemDeErro(e: unknown): string {
  const texto = (e as { message?: string })?.message ?? ''
  if (/passado/i.test(texto)) return 'A data não pode ser no passado.'
  if (/char_length|motivo/i.test(texto)) return 'Escreva o motivo (de 3 a 300 caracteres).'
  if (/row-level|permission|42501/i.test(texto)) return 'Seu acesso não permite combinar retornos.'
  return 'Não foi possível salvar. Tente de novo.'
}
