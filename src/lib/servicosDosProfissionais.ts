/**
 * Os serviços que cada profissional faz (migração `0027`), do lado da tela.
 *
 * ── A REGRA, EM UMA FRASE ──────────────────────────────────────────────────
 *
 * **Lista vazia = faz todos.** O João corta e faz barba; a Ana só faz
 * coloração; o Pedro, sem lista, faz tudo. Quem nunca preencheu nada continua
 * atendendo qualquer serviço — por isso o campo é opcional e a mudança não
 * pegou ninguém de surpresa.
 *
 * O banco tem a mesma regra em `profissional_faz()`, e é ela que manda na
 * agenda da atendente. Esta cópia existe para a tela **avisar** (o modal de
 * Novo Agendamento) — mudou uma, mude a outra, como em `agenda.ts`.
 */

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface ServicoDoProfissional {
  id: string
  nome: string
}

/** Profissional → os serviços que ele faz. Ausente ou vazio = todos. */
export type MapaDeServicos = Map<string, ServicoDoProfissional[]>

/** Todas as ligações, agrupadas por profissional, com o nome do serviço. */
export async function carregarServicosDosProfissionais(): Promise<MapaDeServicos> {
  const { data } = await supabase
    .from('profissional_servicos')
    .select('profissional_id, servico_id, servico:servicos_clinica(nome)')
  const mapa: MapaDeServicos = new Map()
  const linhas = (data ?? []) as unknown as {
    profissional_id: string
    servico_id: string
    servico: { nome: string } | null
  }[]
  for (const l of linhas) {
    const item = { id: l.servico_id, nome: l.servico?.nome ?? '' }
    mapa.set(l.profissional_id, [...(mapa.get(l.profissional_id) ?? []), item])
  }
  return mapa
}

/**
 * O profissional faz este serviço? Compara pelo nome, sem caixa e sem espaço
 * nas pontas — igual ao banco.
 *
 * Sem mapa (ainda carregando, ou a leitura falhou) responde que sim: na
 * dúvida, a tela não acusa. Quem decide de verdade é o banco, e um aviso falso
 * ensina a equipe a ignorar avisos.
 */
export function faz(mapa: MapaDeServicos | null, profissionalId: string, servico: string | null): boolean {
  if (!mapa || !servico) return true
  const lista = mapa.get(profissionalId)
  if (!lista || lista.length === 0) return true
  const alvo = servico.trim().toLowerCase()
  return lista.some((s) => s.nome.trim().toLowerCase() === alvo)
}

/** O mapa, carregado uma vez por montagem. `null` enquanto não chega. */
export function useServicosDosProfissionais(): MapaDeServicos | null {
  const [mapa, setMapa] = useState<MapaDeServicos | null>(null)
  useEffect(() => {
    let vivo = true
    void carregarServicosDosProfissionais().then((m) => { if (vivo) setMapa(m) })
    return () => { vivo = false }
  }, [])
  return mapa
}
