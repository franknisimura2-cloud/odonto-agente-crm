import { supabase } from './supabase'

/**
 * Odontograma (migração 0040).
 *
 * Numeração FDI: o primeiro dígito é o quadrante, o segundo o dente, contado
 * do meio para trás. Permanentes 11–48; de leite 51–85 (só aparecem com a
 * opção ligada no paciente, `odontogramas.deciduos`).
 *
 * O desenho é o do dentista olhando para o paciente: a direita DO PACIENTE
 * (quadrantes 1 e 4) fica à esquerda da tela.
 */

export type Face = 'M' | 'D' | 'O' | 'V' | 'L'
export type Condicao =
  | 'carie' | 'restauracao' | 'selante' | 'fratura' | 'canal' | 'coroa'
  | 'implante' | 'protese' | 'ausente' | 'extracao' | 'outro'
export type Situacao = 'a_tratar' | 'existente' | 'tratado'

export interface RegistroOdontograma {
  id: string
  lead_id: string
  dente: number
  /** Vazio = o dente inteiro. */
  faces: Face[]
  condicao: Condicao
  situacao: Situacao
  observacao: string | null
  criado_por: string | null
  created_at: string
  atualizado_por: string | null
  updated_at: string
}

export interface HistoricoOdontograma {
  id: string
  registro_id: string | null
  acao: 'criou' | 'alterou' | 'apagou'
  antes: Partial<RegistroOdontograma> | null
  depois: Partial<RegistroOdontograma> | null
  por: string | null
  em: string
}

/**
 * As condições, na ordem da tela. `porFace`: marca-se nas faces (cárie,
 * restauração…); as outras valem para o dente inteiro. `sigla` é o que aparece
 * dentro do dente quando a marca é do dente inteiro.
 */
export const CONDICOES: { chave: Condicao; nome: string; porFace: boolean; sigla: string }[] = [
  { chave: 'carie', nome: 'Cárie', porFace: true, sigla: 'C' },
  { chave: 'restauracao', nome: 'Restauração', porFace: true, sigla: 'R' },
  { chave: 'selante', nome: 'Selante', porFace: true, sigla: 'S' },
  { chave: 'fratura', nome: 'Fratura', porFace: true, sigla: 'F' },
  { chave: 'canal', nome: 'Tratamento de canal', porFace: false, sigla: 'TC' },
  { chave: 'coroa', nome: 'Coroa', porFace: false, sigla: 'CO' },
  { chave: 'implante', nome: 'Implante', porFace: false, sigla: 'IM' },
  { chave: 'protese', nome: 'Prótese', porFace: false, sigla: 'PR' },
  { chave: 'ausente', nome: 'Ausente', porFace: false, sigla: '' },
  { chave: 'extracao', nome: 'Extração indicada', porFace: false, sigla: 'EX' },
  { chave: 'outro', nome: 'Outro', porFace: false, sigla: '?' },
]
export const CONDICAO = Object.fromEntries(CONDICOES.map((c) => [c.chave, c])) as Record<Condicao, (typeof CONDICOES)[number]>

/**
 * A convenção do papel: VERMELHO é o que falta fazer, AZUL o que já existe ou
 * foi feito. `tratado` é azul também — a diferença (feito aqui ou antes) está
 * no rótulo e no histórico, não numa terceira cor para decorar.
 */
export const SITUACOES: { chave: Situacao; nome: string; cor: string; fundo: string }[] = [
  { chave: 'a_tratar', nome: 'A tratar', cor: '#DC2626', fundo: '#FEE2E2' },
  { chave: 'existente', nome: 'Já existia', cor: '#2563EB', fundo: '#DBEAFE' },
  { chave: 'tratado', nome: 'Tratado aqui', cor: '#1D4ED8', fundo: '#DBEAFE' },
]
export const SITUACAO = Object.fromEntries(SITUACOES.map((s) => [s.chave, s])) as Record<Situacao, (typeof SITUACOES)[number]>

export const NOME_DA_FACE: Record<Face, string> = {
  M: 'Mesial', D: 'Distal', O: 'Oclusal / incisal', V: 'Vestibular', L: 'Lingual / palatina',
}

/** Os dentes de cada quadrante, na ordem em que aparecem da esquerda para a direita na tela. */
export function dentesDoQuadrante(q: number): number[] {
  const n = q <= 4 ? 8 : 5
  const lista = Array.from({ length: n }, (_, i) => q * 10 + i + 1) // 11, 12…
  // Quadrantes da direita do paciente (1, 4, 5, 8) ficam à esquerda da tela:
  // o dente do meio (x1) fica colado à linha do meio, à direita do bloco.
  return [1, 4, 5, 8].includes(q) ? lista.reverse() : lista
}

/** Arcada de cima (quadrantes 1, 2, 5, 6)? Muda qual face fica em cima no desenho. */
export function ehSuperior(dente: number): boolean {
  return [1, 2, 5, 6].includes(Math.floor(dente / 10))
}

/**
 * Qual face fica em cada lado do desenho do dente.
 *
 *   em cima / embaixo: vestibular fica para FORA da boca — em cima na arcada
 *   de cima, embaixo na de baixo; a lingual/palatina, do lado oposto.
 *
 *   esquerda / direita: mesial é o lado do MEIO da boca. Nos quadrantes da
 *   direita do paciente (à esquerda da tela) o meio fica à direita do dente.
 */
export function facesNoDesenho(dente: number): { cima: Face; baixo: Face; esquerda: Face; direita: Face } {
  const q = Math.floor(dente / 10)
  const meioADireita = [1, 4, 5, 8].includes(q)
  const superior = ehSuperior(dente)
  return {
    cima: superior ? 'V' : 'L',
    baixo: superior ? 'L' : 'V',
    esquerda: meioADireita ? 'D' : 'M',
    direita: meioADireita ? 'M' : 'D',
  }
}

/** "16 · M O D — Cárie (a tratar)" */
export function descreverRegistro(r: Pick<RegistroOdontograma, 'dente' | 'faces' | 'condicao' | 'situacao'>): string {
  const faces = r.faces.length ? ` · ${r.faces.join('')}` : ''
  return `${r.dente}${faces} — ${CONDICAO[r.condicao]?.nome ?? r.condicao} (${SITUACAO[r.situacao]?.nome.toLowerCase() ?? r.situacao})`
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

const COLUNAS = 'id, lead_id, dente, faces, condicao, situacao, observacao, criado_por, created_at, atualizado_por, updated_at'

export async function carregarOdontograma(leadId: string): Promise<{ deciduos: boolean; registros: RegistroOdontograma[] }> {
  const [cab, regs] = await Promise.all([
    supabase.from('odontogramas').select('deciduos').eq('lead_id', leadId).maybeSingle(),
    supabase.from('odontograma_registros').select(COLUNAS).eq('lead_id', leadId).order('dente').order('created_at'),
  ])
  if (regs.error) throw regs.error
  return { deciduos: !!cab.data?.deciduos, registros: (regs.data ?? []) as RegistroOdontograma[] }
}

export async function carregarHistorico(leadId: string): Promise<HistoricoOdontograma[]> {
  const { data, error } = await supabase.from('odontograma_historico')
    .select('id, registro_id, acao, antes, depois, por, em')
    .eq('lead_id', leadId).order('em', { ascending: false }).limit(50)
  if (error) throw error
  return (data ?? []) as HistoricoOdontograma[]
}

export async function salvarRegistro(
  leadId: string,
  r: { id?: string; dente: number; faces: Face[]; condicao: Condicao; situacao: Situacao; observacao: string | null },
): Promise<RegistroOdontograma> {
  const campos = { dente: r.dente, faces: r.faces, condicao: r.condicao, situacao: r.situacao, observacao: r.observacao }
  const q = r.id
    ? supabase.from('odontograma_registros').update(campos).eq('id', r.id)
    : supabase.from('odontograma_registros').insert({ ...campos, lead_id: leadId })
  const { data, error } = await q.select(COLUNAS).single()
  if (error) throw error
  return data as RegistroOdontograma
}

export async function apagarRegistro(id: string): Promise<void> {
  const { error } = await supabase.from('odontograma_registros').delete().eq('id', id)
  if (error) throw error
}

export async function definirDeciduos(leadId: string, deciduos: boolean): Promise<void> {
  const { error } = await supabase.from('odontogramas')
    .upsert({ lead_id: leadId, deciduos, atualizado_em: new Date().toISOString() })
  if (error) throw error
}
