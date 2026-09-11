import { AlertTriangle } from 'lucide-react'
import { faz, useServicosDosProfissionais } from '../lib/servicosDosProfissionais'
import type { Profissional } from '../types'

/**
 * "Coloração não está na lista de serviços que o João faz." (migração `0027`)
 *
 * O aviso das três portas da recepção que escolhem profissional e serviço: a
 * Agenda (`NovoAgendamentoModal`), a ficha (`LeadDetail`) e o cadastro com
 * agendamento (`PessoasPage`). Um componente só para as três falarem igual —
 * duas cópias de um aviso começam a divergir no dia seguinte.
 *
 * **Âmbar, e não vermelho, e não trava o botão.** A atendente nunca marcaria
 * assim; a recepção pode — é encaixe consciente, como marcar fora da jornada.
 * A regra existe para o agente não decidir pela empresa.
 *
 * Carrega o mapa sozinho, uma vez por montagem, e não mostra nada enquanto ele
 * não chega: aviso falso ensina a equipe a ignorar avisos.
 */
export default function AvisoForaDaLista({ profissional, servico }: {
  profissional: Profissional | null | undefined
  servico: string
}) {
  const mapa = useServicosDosProfissionais()
  if (!profissional || !servico || faz(mapa, profissional.id, servico)) return null

  return (
    <div style={{
      background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '9px 12px',
      fontSize: 12.5, color: '#B45309', display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5,
    }}>
      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>
        <strong>{servico}</strong> não está na lista de serviços que {profissional.nome} faz.
        Dá para marcar assim mesmo, como encaixe.
      </span>
    </div>
  )
}
