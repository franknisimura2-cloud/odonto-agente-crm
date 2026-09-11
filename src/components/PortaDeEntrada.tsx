import { useState } from 'react'
import { DoorOpen, Clock, Pencil, Tag } from 'lucide-react'
import { formatarReais } from '../lib/procedimentos'
import { useAgente } from '../lib/agente'
import type { ServicoClinica } from '../types'
import { MARCA } from '../lib/marca'

/**
 * A porta de entrada da empresa — o atendimento que vem antes dos outros
 * serviços (o nome é dado: "Avaliação", "Orçamento", "Consulta inicial"…).
 *
 * ── ELA É OPCIONAL ─────────────────────────────────────────────────────────
 *
 * Numa clínica, quase todo tratamento começa por uma avaliação. Numa barbearia,
 * ninguém avalia antes do corte. Por isso "nenhuma porta" é um estado normal,
 * dito em tom neutro, e não um erro em vermelho: sem porta, a atendente agenda
 * cada serviço direto — e `agenda_marcar` faz isso desde a 0018.
 *
 * Escolher e deixar de usar moram aqui, e não no modal de Editar: é uma regra
 * da empresa inteira, não de um serviço. Mas as duas ações pedem um gesto a
 * mais (escolher na lista, confirmar), porque mudam o que a atendente marca
 * para todo cliente dali em diante.
 *
 * ── POR QUE ELA NÃO É UM DOS CARDS ─────────────────────────────────────────
 *
 * Quando existe, ela não é um serviço comum: é por onde os outros começam. No
 * meio da grade ela vira o vigésimo card igual aos outros, quando é o
 * agendamento que mais vai acontecer — e o único que a Letícia marca no lugar
 * de todos os que passam por ela.
 *
 * ── SÓ MOSTRA; QUEM EDITA É O MODAL ────────────────────────────────────────
 *
 * Nome, textos, duração e valor se mudam em **Editar**, no mesmo modal dos
 * outros serviços. Ter campo editável aqui e no modal seria a mesma coisa em
 * dois lugares, e um dia os dois discordariam.
 */

const FONTE = "'Plus Jakarta Sans', sans-serif"

interface Props {
  porta: ServicoClinica | null
  /** Os serviços que podem virar a porta: os ativos da grade. */
  candidatos: ServicoClinica[]
  onEditar: (p: ServicoClinica) => void
  /** Devolve a mensagem de erro, ou `null` quando deu certo. */
  onEscolher: (id: string) => Promise<string | null>
  onDeixarDeUsar: () => Promise<string | null>
}

const botaoSecundario: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8,
  border: '1px solid #DCE6EA', background: '#fff', cursor: 'pointer', fontSize: 12.5,
  fontWeight: 600, color: '#16232B', fontFamily: FONTE, flexShrink: 0,
}

export default function PortaDeEntrada({ porta, candidatos, onEditar, onEscolher, onDeixarDeUsar }: Props) {
  const { nome: nomeAgente } = useAgente()
  const [escolhido, setEscolhido] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function agir(acao: () => Promise<string | null>) {
    setSalvando(true)
    setErro('')
    const falha = await acao()
    setSalvando(false)
    if (falha) { setErro(falha); return }
    setEscolhido('')
    setConfirmando(false)
  }

  const caixaErro = erro && (
    <div style={{ fontSize: 12.5, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 11px', marginTop: 11 }}>
      {erro}
    </div>
  )

  if (!porta) {
    return (
      <div className="fade-in-2" style={{
        background: '#fff', border: '1px solid #DCE6EA', borderRadius: 13,
        padding: '16px 18px', marginBottom: 18, fontFamily: FONTE,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <DoorOpen size={15} color="#6B818C" />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#6B818C', letterSpacing: 0.3, textTransform: 'uppercase' }}>
            Porta de entrada · opcional
          </span>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: '#16232B', marginTop: 4 }}>
          Nenhuma. A {nomeAgente} agenda cada serviço direto.
        </div>
        <p style={{ fontSize: 12.5, color: '#6B818C', lineHeight: 1.6, margin: '5px 0 0', maxWidth: 680 }}>
          Use quando o cliente precisa passar primeiro por um atendimento inicial —
          uma avaliação, um orçamento, uma primeira conversa — antes do serviço em si. Quem
          pedir um serviço que passa por ela sai com a porta marcada, e o que queria
          fica anotado junto, na Agenda.
        </p>

        {candidatos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 13, paddingTop: 12, borderTop: '1px solid #EDF2F4' }}>
            <select value={escolhido} onChange={(e) => { setEscolhido(e.target.value); setErro('') }}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #DCE6EA', fontSize: 13, fontFamily: FONTE, color: escolhido ? '#16232B' : '#6B818C', background: '#fff', cursor: 'pointer', minWidth: 220 }}>
              <option value="">Escolha um serviço…</option>
              {candidatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <button disabled={!escolhido || salvando} onClick={() => agir(() => onEscolher(escolhido))}
              style={{ ...botaoSecundario, background: escolhido ? MARCA : '#F2F6F7', color: escolhido ? '#fff' : '#9AAEB6', border: 'none', cursor: escolhido && !salvando ? 'pointer' : 'not-allowed' }}>
              <DoorOpen size={13} /> {salvando ? 'Salvando...' : 'Usar como porta de entrada'}
            </button>
          </div>
        )}
        {caixaErro}
      </div>
    )
  }

  const semCusto = porta.preco_a_partir_de === 0

  return (
    <div className="fade-in-2" style={{
      background: '#fff', border: '1px solid #DCE6EA', borderRadius: 13,
      borderLeft: `3px solid ${MARCA}`,
      padding: '16px 18px', marginBottom: 18, fontFamily: FONTE,
    }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
        <DoorOpen size={15} style={{ color: MARCA }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: MARCA, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          A porta de entrada
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#16232B' }}>{porta.nome}</div>
          <p style={{ fontSize: 12.5, color: '#6B818C', lineHeight: 1.6, margin: '5px 0 0' }}>
            {porta.descricao}
          </p>
          <div style={{ fontSize: 12, color: '#6B818C', lineHeight: 1.6, marginTop: 8 }}>
            É o que a {nomeAgente} marca no lugar de todo serviço com{' '}
            <strong style={{ color: '#16232B' }}>&ldquo;Passa pela porta de entrada&rdquo;</strong> ligado.
            O que a pessoa procura fica registrado junto, e aparece na Agenda.
          </div>
        </div>

        <button onClick={() => onEditar(porta)} style={botaoSecundario}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F7FAFB' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff' }}>
          <Pencil size={13} color="#6B818C" /> Editar
        </button>
      </div>

      {/* Os dois dados que a Letícia usa. Mudam em Editar. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginTop: 13, paddingTop: 12, borderTop: '1px solid #EDF2F4' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#6B818C' }}>
          <Clock size={13} /> {porta.duracao_minutos} minutos
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: semCusto ? '#1A7A48' : '#6B818C' }}>
          <Tag size={13} />
          {/* "Sem custo", e não "Gratuita": o nome da porta é dado, e pode ser
              masculino ("Orçamento"). É também a frase que a view entrega à
              atendente (0026). */}
          {semCusto
            ? 'Sem custo'
            : porta.preco_a_partir_de
              ? `A partir de ${formatarReais(porta.preco_a_partir_de)}`
              : 'Sem valor cadastrado'}
        </span>

        {!confirmando && (
          <button onClick={() => { setConfirmando(true); setErro('') }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#6B818C', fontFamily: FONTE }}>
            Deixar de usar porta de entrada
          </button>
        )}
      </div>

      {semCusto && !confirmando && (
        <div style={{ fontSize: 12, color: '#1A7A48', background: '#E8F8EF', border: '1px solid #B7E7CB', borderRadius: 8, padding: '8px 11px', marginTop: 11, lineHeight: 1.6 }}>
          Sem custo não é só um preço zerado: é a frase que a {nomeAgente} usa quando
          alguém trava no valor. Sem ela, a resposta vira &ldquo;o valor a gente vê
          depois&rdquo;, que soa como desconversa.
        </div>
      )}

      {/*
        DEIXAR DE USAR PEDE CONFIRMAÇÃO, e diz o que acontece com os outros.

        A marcação "passa pela porta" de cada serviço NÃO é apagada: fica
        guardada e sem valer. Se a empresa escolher uma porta de novo, ela
        volta como estava — desligar por engano não custa refazer vinte cards.
      */}
      {confirmando && (
        <div style={{ background: '#F7FAFB', border: '1px solid #DCE6EA', borderRadius: 9, padding: '11px 13px', marginTop: 11 }}>
          <div style={{ fontSize: 12.5, color: '#16232B', lineHeight: 1.6 }}>
            Sem porta de entrada, a {nomeAgente} passa a agendar <strong>todos</strong> os
            serviços direto, e <strong>{porta.nome}</strong> vira um serviço comum da lista.
            Quem estava marcado para passar pela porta guarda a marcação: se você
            escolher uma porta de novo, ela volta a valer.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => { setConfirmando(false); setErro('') }} disabled={salvando}
              style={{ ...botaoSecundario, color: '#6B818C' }}>
              Cancelar
            </button>
            <button onClick={() => agir(onDeixarDeUsar)} disabled={salvando}
              style={{ ...botaoSecundario, background: '#16232B', color: '#fff', border: 'none', cursor: salvando ? 'not-allowed' : 'pointer' }}>
              {salvando ? 'Salvando...' : 'Deixar de usar'}
            </button>
          </div>
        </div>
      )}
      {caixaErro}
    </div>
  )
}
