import { ChevronLeft, ChevronRight, CalendarX2 } from 'lucide-react'
import {
  diasDaSemana, fimDaConsulta, inicioDaConsulta, mesmoDia, NOMES_DIAS, NOMES_DIAS_CURTOS,
  procedimentoComInteresse, somarDias,
} from '../lib/agenda'
import { COR_SEM_PROFISSIONAL } from '../lib/cores'
import { STATUS_CONSULTA, ROTULO_CONSULTA } from '../lib/statusLead'
import type { ConsultaAgenda, Profissional } from '../types'
import { MARCA } from '../lib/marca'

/* ──────────────────────────────────────────────
   A agenda no celular — um dia, em lista.

   A grade da semana não cabe: sete colunas em 390px dão uns 45px por dia, e
   o nome da cliente some. E quem abre a agenda no celular é a profissional
   querendo saber "quem eu atendo hoje, e a que horas" — pergunta que uma lista
   em ordem de horário responde melhor que qualquer grade.

   Em cima, a semana numa faixa (tocar num dia pula para ele) e as setas, que
   andam um dia. A semana inteira já vem carregada pela página: trocar de dia
   dentro dela não espera o banco.
────────────────────────────────────────────── */

const FONTE = "'Plus Jakarta Sans', sans-serif"
const hhmm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

interface Props {
  dia: Date
  onMudarDia: (dia: Date) => void
  /** As consultas do período carregado, já filtradas pela profissional escolhida. */
  consultas: ConsultaAgenda[]
  profissionaisPorId: Map<string, Profissional>
  /**
   * O expediente da profissional escolhida neste dia ("08:00–18:00"),
   * `false` quando ela não atende no dia, e `null` com todas as profissionais.
   */
  expediente: string | false | null
  onClickConsulta: (c: ConsultaAgenda) => void
}

export default function AgendaDiaCelular({
  dia, onMudarDia, consultas, profissionaisPorId, expediente, onClickConsulta,
}: Props) {
  const hoje = new Date()
  const doDia = consultas
    .filter((c) => mesmoDia(inicioDaConsulta(c), dia))
    .sort((a, b) => inicioDaConsulta(a).getTime() - inicioDaConsulta(b).getTime())

  // Quantos atendimentos de verdade: cancelada e falta não ocupam a manhã de
  // ninguém, e contá-las faria o dia parecer mais cheio do que é.
  const quantos = doDia.filter((c) => c.status !== 'cancelada' && c.status !== 'faltou').length

  const seta: React.CSSProperties = {
    width: 40, height: 40, borderRadius: 10, border: '1px solid #DCE6EA', background: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  }

  return (
    <div>
      {/* A semana */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {diasDaSemana(dia).map((d) => {
          const escolhido = mesmoDia(d, dia)
          const ehHoje = mesmoDia(d, hoje)
          const temAlgo = consultas.some((c) => mesmoDia(inicioDaConsulta(c), d) && c.status === 'agendada')
          return (
            <button key={d.toISOString()} onClick={() => onMudarDia(d)}
              style={{
                flex: 1, minWidth: 0, padding: '7px 0 6px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${escolhido ? MARCA : '#DCE6EA'}`,
                background: escolhido ? MARCA : '#fff',
                color: escolhido ? '#fff' : ehHoje ? MARCA : '#16232B',
                fontFamily: FONTE, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, opacity: escolhido ? 0.85 : 0.7, textTransform: 'uppercase' }}>
                {NOMES_DIAS_CURTOS[d.getDay()]}
              </span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{d.getDate()}</span>
              {/* O pontinho: tem agendamento neste dia. */}
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: temAlgo ? (escolhido ? '#fff' : MARCA) : 'transparent',
              }} />
            </button>
          )
        })}
      </div>

      {/* O dia */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={() => onMudarDia(somarDias(dia, -1))} style={seta} aria-label="Dia anterior">
          <ChevronLeft size={18} color="#6B818C" />
        </button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#16232B' }}>
            {mesmoDia(dia, hoje) ? 'Hoje' : NOMES_DIAS[dia.getDay()]},{' '}
            {dia.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
          </div>
          <div style={{ fontSize: 12.5, color: '#6B818C', marginTop: 2 }}>
            {quantos === 0 ? 'Nenhum atendimento' : quantos === 1 ? '1 atendimento' : `${quantos} atendimentos`}
            {expediente ? ` · atende ${expediente}` : expediente === false ? ' · não atende neste dia' : ''}
          </div>
        </div>
        <button onClick={() => onMudarDia(somarDias(dia, 1))} style={seta} aria-label="Próximo dia">
          <ChevronRight size={18} color="#6B818C" />
        </button>
      </div>

      {/* A lista */}
      {doDia.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #DCE6EA',
          padding: '36px 20px', textAlign: 'center',
        }}>
          <CalendarX2 size={28} strokeWidth={1.4} color="#B9C8CE" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#16232B' }}>Dia livre</div>
          <div style={{ fontSize: 13, color: '#6B818C', marginTop: 4 }}>Nenhum agendamento neste dia.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {doDia.map((c) => {
            const inicio = inicioDaConsulta(c)
            const prof = c.profissional_id ? profissionaisPorId.get(c.profissional_id) : undefined
            const cor = prof?.cor ?? COR_SEM_PROFISSIONAL.hex
            const naoAconteceu = c.status === 'cancelada' || c.status === 'faltou'
            const status = STATUS_CONSULTA[c.status]
            return (
              <button key={c.id} onClick={() => onClickConsulta(c)}
                style={{
                  display: 'flex', gap: 12, alignItems: 'stretch', width: '100%', textAlign: 'left',
                  background: '#fff', border: '1px solid #DCE6EA', borderLeft: `4px solid ${cor}`,
                  borderRadius: 12, padding: '12px 14px', cursor: 'pointer', fontFamily: FONTE,
                  opacity: naoAconteceu ? 0.6 : 1,
                }}>
                <div style={{ flexShrink: 0, width: 48 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#16232B' }}>{hhmm(inicio)}</div>
                  <div style={{ fontSize: 11.5, color: '#6B818C', marginTop: 2 }}>{hhmm(fimDaConsulta(c))}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: '#16232B',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textDecoration: naoAconteceu ? 'line-through' : 'none',
                  }}>
                    {c.lead?.nome_lead ?? 'Sem nome'}
                  </div>
                  <div style={{ fontSize: 13, color: '#3A5560', marginTop: 2, lineHeight: 1.4 }}>
                    {procedimentoComInteresse(c)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6B818C' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor }} />
                      {prof ? `${prof.nome}${prof.sobrenome ? ` ${prof.sobrenome}` : ''}` : 'Sem profissional'}
                    </span>
                    {c.status === 'agendada' && c.confirmada_em && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: '#E8F8EF', color: '#1A7A48',
                      }}>
                        ✓ Confirmada
                      </span>
                    )}
                    {c.status !== 'agendada' && status && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: status.bg, color: status.color,
                      }}>
                        {ROTULO_CONSULTA[c.status]}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Sem isto, o fundo da lista encosta no pé da tela e o último cartão
          fica atrás da barrinha do iPhone. */}
      <div style={{ height: `calc(16px + env(safe-area-inset-bottom))` }} />
    </div>
  )
}
