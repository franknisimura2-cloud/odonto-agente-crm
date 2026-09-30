import { supabase } from './supabase'
import type { Condicao, RegistroOdontograma } from './odontograma'

/**
 * Plano de tratamento em etapas (migração 0041).
 *
 * O plano sai do odontograma: cada achado "a tratar" vira um item, com o
 * serviço sugerido pela condição (cárie → restauração, canal → tratamento de
 * canal…). A COBERTURA e o VALOR se preenchem no banco (gatilho
 * `plano_itens_padrao`): coberto pelo convênio da ficha → convênio, R$ 0 para
 * o paciente; senão, particular, com o "a partir de" do serviço.
 *
 * O status do plano, depois de apresentado, também é do banco: segue os itens.
 */

export type StatusPlano = 'rascunho' | 'apresentado' | 'parcial' | 'aprovado' | 'recusado' | 'concluido'
export type StatusItem = 'pendente' | 'aprovado' | 'recusado' | 'feito'

export interface Plano {
  id: string
  lead_id: string
  status: StatusPlano
  observacoes: string | null
  desconto: number
  validade: string | null
  token: string
  /** A origem do sistema ao apresentar (0042): é com ela que a Letícia monta o link. */
  link_base: string | null
  criado_por: string | null
  created_at: string
  apresentado_em: string | null
  decidido_em: string | null
  updated_at: string
}

export interface ItemPlano {
  id: string
  plano_id: string
  registro_id: string | null
  servico_id: string | null
  procedimento: string
  dente: number | null
  faces: string[]
  etapa: number
  cobertura: 'particular' | 'convenio'
  convenio_id: string | null
  valor: number
  status: StatusItem
  consulta_id: string | null
  observacao: string | null
  ordem: number
  created_at: string
}

/** As etapas, na ordem da conduta: saúde antes de estética. */
export const ETAPAS: { numero: number; nome: string; explica: string }[] = [
  { numero: 1, nome: 'Urgência e saúde', explica: 'Dor, infecção, cárie, gengiva' },
  { numero: 2, nome: 'Reabilitação', explica: 'Repor e reconstruir: implantes, próteses, coroas' },
  { numero: 3, nome: 'Estética', explica: 'Clareamento, lentes, facetas, alinhamento' },
  { numero: 4, nome: 'Etapa 4', explica: '' },
  { numero: 5, nome: 'Etapa 5', explica: '' },
]
export const nomeDaEtapa = (n: number) => ETAPAS.find((e) => e.numero === n)?.nome ?? `Etapa ${n}`

export const STATUS_PLANO: Record<StatusPlano, { nome: string; cor: string; fundo: string }> = {
  rascunho: { nome: 'Rascunho', cor: '#6B818C', fundo: '#F2F6F7' },
  apresentado: { nome: 'Apresentado', cor: '#B45309', fundo: '#FFFBEB' },
  parcial: { nome: 'Aprovado em parte', cor: '#0E7490', fundo: '#ECFEFF' },
  aprovado: { nome: 'Aprovado', cor: '#1A7A48', fundo: '#E8F8EF' },
  recusado: { nome: 'Recusado', cor: '#DC2626', fundo: '#FEF2F2' },
  concluido: { nome: 'Concluído', cor: '#3B5BDB', fundo: '#EEF4FF' },
}

export const STATUS_ITEM: Record<StatusItem, { nome: string; cor: string; fundo: string }> = {
  pendente: { nome: 'Aguardando', cor: '#6B818C', fundo: '#F2F6F7' },
  aprovado: { nome: 'Aprovado', cor: '#1A7A48', fundo: '#E8F8EF' },
  recusado: { nome: 'Recusado', cor: '#DC2626', fundo: '#FEF2F2' },
  feito: { nome: 'Feito', cor: '#3B5BDB', fundo: '#EEF4FF' },
}

/**
 * O serviço que cada condição do odontograma costuma virar, por palavras do
 * NOME do serviço — o catálogo é de cada clínica, e os nomes mudam. Sem
 * correspondência, o item nasce sem serviço e a equipe escolhe.
 */
const SUGESTAO: Record<Condicao, RegExp[]> = {
  carie: [/restaura/i, /resina/i],
  restauracao: [/restaura/i, /resina/i],
  selante: [/selante/i, /profilaxia/i],
  fratura: [/restaura/i, /faceta/i, /coroa/i],
  canal: [/canal/i],
  coroa: [/coroa/i, /pr[óo]tese/i],
  implante: [/implante/i],
  protese: [/pr[óo]tese/i],
  ausente: [/implante/i, /pr[óo]tese/i],
  extracao: [/extra[çc][ãa]o dent/i, /extra[çc][ãa]o/i],
  outro: [],
}

/** A etapa que cada condição costuma ocupar. */
const ETAPA_PADRAO: Record<Condicao, number> = {
  carie: 1, restauracao: 1, selante: 1, fratura: 1, canal: 1, extracao: 1,
  coroa: 2, implante: 2, protese: 2, ausente: 2, outro: 1,
}

export interface ServicoPlano { id: string; nome: string; preco_a_partir_de: number | null }

export function sugerirServico(condicao: Condicao, servicos: ServicoPlano[]): ServicoPlano | null {
  for (const re of SUGESTAO[condicao]) {
    const achado = servicos.find((s) => re.test(s.nome))
    if (achado) return achado
  }
  return null
}

export function totais(itens: ItemPlano[], desconto = 0) {
  const validos = itens.filter((i) => i.status !== 'recusado')
  const particular = validos.filter((i) => i.cobertura === 'particular').reduce((s, i) => s + Number(i.valor), 0)
  const convenio = validos.filter((i) => i.cobertura === 'convenio').length
  return { particular, convenio, desconto, total: Math.max(0, particular - desconto) }
}

/** O endereço que o paciente abre — no domínio da própria clínica. */
export function linkDoPaciente(token: string): string {
  return `${window.location.origin}/orcamento/${token}`
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

const COLUNAS_PLANO = 'id, lead_id, status, observacoes, desconto, validade, token, link_base, criado_por, created_at, apresentado_em, decidido_em, updated_at'
const COLUNAS_ITEM = 'id, plano_id, registro_id, servico_id, procedimento, dente, faces, etapa, cobertura, convenio_id, valor, status, consulta_id, observacao, ordem, created_at'

export async function planosDoPaciente(leadId: string): Promise<{ planos: Plano[]; itens: ItemPlano[] }> {
  const { data: planos, error } = await supabase.from('planos_tratamento').select(COLUNAS_PLANO)
    .eq('lead_id', leadId).order('created_at', { ascending: false })
  if (error) throw error
  const ids = (planos ?? []).map((p) => p.id as string)
  if (!ids.length) return { planos: [], itens: [] }
  const { data: itens, error: e2 } = await supabase.from('plano_itens').select(COLUNAS_ITEM)
    .in('plano_id', ids).order('etapa').order('ordem').order('created_at')
  if (e2) throw e2
  return {
    planos: (planos ?? []).map((p) => ({ ...p, desconto: Number(p.desconto) })) as Plano[],
    itens: (itens ?? []).map((i) => ({ ...i, valor: Number(i.valor) })) as ItemPlano[],
  }
}

export async function servicosParaPlano(): Promise<ServicoPlano[]> {
  const { data } = await supabase.from('servicos_clinica').select('id, nome, preco_a_partir_de').eq('ativo', true).order('nome')
  return (data ?? []).map((s) => ({ ...s, preco_a_partir_de: s.preco_a_partir_de === null ? null : Number(s.preco_a_partir_de) })) as ServicoPlano[]
}

export async function criarPlano(leadId: string): Promise<Plano> {
  const { data, error } = await supabase.from('planos_tratamento').insert({ lead_id: leadId }).select(COLUNAS_PLANO).single()
  if (error) throw error
  return { ...data, desconto: Number(data.desconto) } as Plano
}

export async function atualizarPlano(id: string, campos: Partial<Plano>): Promise<Plano> {
  const { data, error } = await supabase.from('planos_tratamento')
    .update({ ...campos, updated_at: new Date().toISOString() }).eq('id', id).select(COLUNAS_PLANO).single()
  if (error) throw error
  return { ...data, desconto: Number(data.desconto) } as Plano
}

export async function apagarPlano(id: string): Promise<void> {
  const { error } = await supabase.from('planos_tratamento').delete().eq('id', id)
  if (error) throw error
}

/** Itens novos: sem cobertura e sem valor, o banco preenche (convênio da ficha / "a partir de"). */
export async function adicionarItens(planoId: string, novos: {
  servico: ServicoPlano | null; procedimento?: string; registro?: RegistroOdontograma | null; etapa?: number
}[]): Promise<ItemPlano[]> {
  const linhas = novos.map((n, i) => ({
    plano_id: planoId,
    servico_id: n.servico?.id ?? null,
    procedimento: n.servico?.nome ?? n.procedimento ?? 'A definir',
    registro_id: n.registro?.id ?? null,
    dente: n.registro?.dente ?? null,
    faces: n.registro?.faces ?? [],
    etapa: n.etapa ?? (n.registro ? ETAPA_PADRAO[n.registro.condicao] : 1),
    ordem: i,
    observacao: n.registro?.observacao ?? null,
  }))
  const { data, error } = await supabase.from('plano_itens').insert(linhas).select(COLUNAS_ITEM)
  if (error) throw error
  return (data ?? []).map((i) => ({ ...i, valor: Number(i.valor) })) as ItemPlano[]
}

export async function atualizarItem(id: string, campos: Partial<ItemPlano>): Promise<ItemPlano> {
  const { data, error } = await supabase.from('plano_itens').update(campos).eq('id', id).select(COLUNAS_ITEM).single()
  if (error) throw error
  return { ...data, valor: Number(data.valor) } as ItemPlano
}

export async function apagarItem(id: string): Promise<void> {
  const { error } = await supabase.from('plano_itens').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// O link do paciente (sem login)
// ---------------------------------------------------------------------------

export interface PlanoPublico {
  clinica: string | null
  paciente: string | null
  status: StatusPlano
  validade: string | null
  vencido: boolean
  observacoes: string | null
  desconto: number
  itens: { id: string; etapa: number; procedimento: string; dente: number | null; faces: string[]; cobertura: 'particular' | 'convenio'; convenio: string | null; valor: number; status: StatusItem }[]
}

export async function lerPlanoPublico(token: string): Promise<PlanoPublico | null> {
  const { data, error } = await supabase.rpc('plano_publico', { p_token: token })
  if (error) throw error
  return data as PlanoPublico | null
}

export async function aprovarPlanoPublico(token: string, etapas: number[]): Promise<StatusPlano> {
  const { data, error } = await supabase.rpc('plano_aprovar', { p_token: token, p_etapas: etapas })
  if (error) throw error
  return data as StatusPlano
}
