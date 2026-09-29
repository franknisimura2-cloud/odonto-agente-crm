import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Convenio, FormaPagamento } from '../types'

/**
 * Convênios (migração 0038).
 *
 * Três tabelas: `convenios` (o cadastro), `convenio_coberturas` (a linha
 * existir = o convênio cobre aquele serviço) e `convenio_repasses` (quanto a
 * clínica recebe — dinheiro, só com a permissão `valores`; para quem não tem,
 * a leitura volta vazia, sem erro).
 *
 * A consulta ganha a forma de pagamento SOZINHA na marcação, pela ficha da
 * pessoa (gatilho `consultas_forma_pagamento_padrao`) — a tela só precisa
 * mandar quando alguém escolhe à mão.
 */

/** Os convênios, ativos primeiro. `soAtivos` para as listas de escolha. */
export function useConvenios(soAtivos = false): Convenio[] {
  const [lista, setLista] = useState<Convenio[]>([])
  useEffect(() => {
    let q = supabase.from('convenios').select('id, nome, ativo, observacoes, created_at').order('nome')
    if (soAtivos) q = q.eq('ativo', true)
    q.then(({ data }) => setLista((data ?? []) as Convenio[]))
  }, [soAtivos])
  return lista
}

/** "Particular", "Convênio Amil", ou "Não informado". */
export function rotuloForma(forma: FormaPagamento | null, convenioNome?: string | null): string {
  if (forma === 'particular') return 'Particular'
  if (forma === 'convenio') return convenioNome ? `Convênio ${convenioNome}` : 'Convênio'
  return 'Não informado'
}

/**
 * O valor de um `<select>` que junta forma e convênio: '' (não informado),
 * 'particular', ou o id do convênio.
 */
export function valorDaEscolha(forma: FormaPagamento | null, convenioId: string | null): string {
  if (forma === 'particular') return 'particular'
  if (forma === 'convenio' && convenioId) return convenioId
  return ''
}

export function escolhaParaCampos(valor: string): { forma_pagamento: FormaPagamento | null; convenio_id: string | null } {
  if (!valor) return { forma_pagamento: null, convenio_id: null }
  if (valor === 'particular') return { forma_pagamento: 'particular', convenio_id: null }
  return { forma_pagamento: 'convenio', convenio_id: valor }
}

/** A validade da carteirinha já passou? (data 'AAAA-MM-DD', comparada a hoje) */
export function carteirinhaVencida(validade: string | null | undefined): boolean {
  if (!validade) return false
  const hoje = new Date()
  const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  return validade < iso
}

/** "87,50" / "87.50" / "R$ 87,50" → 87.5. Vazio ou inválido → null. */
export function lerReais(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, '').trim()
  if (!limpo) return null
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const n = Number(normal)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}
