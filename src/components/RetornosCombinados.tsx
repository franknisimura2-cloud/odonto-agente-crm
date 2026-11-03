import { useEffect, useState } from 'react'
import { CalendarClock, Plus, X } from 'lucide-react'
import { MARCA, MARCA_CLARO, MARCA_SUAVE } from '../lib/marca'
import { useAgente } from '../lib/agente'
import {
  retornosDaPessoa, combinarRetorno, cancelarRetorno, mensagemDeErro,
  hojeISO, daquiAMeses, dataBR, type RetornoCombinado,
} from '../lib/retornosCombinados'

/* ──────────────────────────────────────────────
   Retornos combinados de uma pessoa (migração 0048)

   "Pediu para falar de novo em março." A equipe marca a data e o motivo; no
   dia, a assistente manda uma mensagem sobre aquele assunto — uma só.

   O motivo é anotação da equipe, e a legenda diz isso: a assistente usa o
   assunto, não copia o texto.
────────────────────────────────────────────── */

const FONTE = "'Plus Jakarta Sans', sans-serif"

const campo: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid #DCE6EA', fontSize: 13.5,
  fontFamily: FONTE, color: '#16232B', outline: 'none', background: '#fff',
}

const ATALHOS = [1, 3, 6, 12]

function Selo({ r }: { r: RetornoCombinado }) {
  const hoje = hojeISO()
  const [texto, cor, fundo] =
    r.situacao === 'enviado' ? ['Enviado', '#1A7A48', '#E6F4EC']
      : r.situacao === 'cancelado' ? ['Cancelado', '#6B818C', '#EEF2F4']
        : r.para_data < hoje ? ['Atrasado', '#B45309', '#FEF3C7']
          : r.para_data === hoje ? ['Hoje', MARCA, MARCA_SUAVE]
            : ['Combinado', MARCA, MARCA_SUAVE]
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, color: cor, background: fundo, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {texto}
    </span>
  )
}

export default function RetornosCombinados({ leadId, podeEditar }: { leadId: string; podeEditar: boolean }) {
  const { nome: nomeAgente } = useAgente()
  const [lista, setLista] = useState<RetornoCombinado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [abrindo, setAbrindo] = useState(false)
  const [data, setData] = useState(daquiAMeses(6))
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Somar 1 aqui recarrega a lista (depois de combinar ou cancelar).
  const [versao, setVersao] = useState(0)
  const carregar = () => setVersao((v) => v + 1)

  useEffect(() => {
    let viva = true
    retornosDaPessoa(leadId)
      .then((l) => { if (viva) setLista(l) })
      .catch(() => { /* sem acesso: a lista fica vazia */ })
      .finally(() => { if (viva) setCarregando(false) })
    return () => { viva = false }
  }, [leadId, versao])

  async function salvar() {
    setErro('')
    if (motivo.trim().length < 3) { setErro('Escreva o motivo do contato.'); return }
    if (!data || data < hojeISO()) { setErro('Escolha uma data de hoje em diante.'); return }
    setSalvando(true)
    try {
      await combinarRetorno(leadId, data, motivo)
      setMotivo(''); setData(daquiAMeses(6)); setAbrindo(false)
      carregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
    setSalvando(false)
  }

  async function cancelar(r: RetornoCombinado) {
    if (!window.confirm(`Cancelar o retorno de ${dataBR(r.para_data)}?`)) return
    try { await cancelarRetorno(r.id); carregar() } catch (e) { setErro(mensagemDeErro(e)) }
  }

  const visiveis = lista.filter((r) => r.situacao !== 'cancelado').slice(0, 10)

  return (
    <div className="cartao" style={{ background: '#fff', borderRadius: 14, border: '1px solid #DCE6EA', padding: '22px 26px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #EDF2F4', flexWrap: 'wrap' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: MARCA_SUAVE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CalendarClock size={16} style={{ color: MARCA }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#16232B', flex: 1 }}>Retornos combinados</span>
        {podeEditar && !abrindo && (
          <button onClick={() => { setAbrindo(true); setErro('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: 'none', background: MARCA, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: FONTE }}>
            <Plus size={14} /> Combinar retorno
          </button>
        )}
      </div>

      <p style={{ fontSize: 12.5, color: '#6B818C', margin: '0 0 14px', lineHeight: 1.5 }}>
        A pessoa pediu para ser procurada mais tarde? Marque a data e o motivo. No dia, a {nomeAgente} manda
        uma mensagem sobre esse assunto, uma vez só.
      </p>

      {abrindo && (
        <div style={{ border: '1px solid #DCE6EA', borderRadius: 12, padding: 16, marginBottom: 14, background: '#FAFCFD', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: '#6B818C', minWidth: 60 }}>Quando</span>
            <input type="date" value={data} min={hojeISO()} onChange={(e) => setData(e.target.value)} style={campo} />
            {ATALHOS.map((m) => (
              <button key={m} type="button" onClick={() => setData(daquiAMeses(m))}
                style={{ padding: '6px 10px', borderRadius: 999, border: `1px solid ${data === daquiAMeses(m) ? MARCA : '#DCE6EA'}`, background: data === daquiAMeses(m) ? MARCA_SUAVE : '#fff', color: data === daquiAMeses(m) ? MARCA : '#3A5560', fontSize: 12.5, cursor: 'pointer', fontFamily: FONTE }}>
                {m === 12 ? '1 ano' : m === 1 ? '1 mês' : `${m} meses`}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12.5, color: '#6B818C' }}>Motivo</span>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={2}
              placeholder="Ex.: pediu para falar de novo depois da viagem, sobre o pacote de limpeza de pele"
              style={{ ...campo, resize: 'vertical', lineHeight: 1.45 }} />
            <span style={{ fontSize: 11.5, color: '#8AA0AA' }}>
              Anotação para a equipe: a {nomeAgente} usa o assunto, mas não copia o texto.
            </span>
          </div>
          {erro && <div style={{ fontSize: 12.5, color: '#DC2626' }}>{erro}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setAbrindo(false); setErro('') }}
              style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid #DCE6EA', background: '#fff', color: '#3A5560', cursor: 'pointer', fontSize: 13, fontFamily: FONTE }}>
              Desistir
            </button>
            <button onClick={salvar} disabled={salvando}
              style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: salvando ? MARCA_CLARO : MARCA, color: '#fff', cursor: salvando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: FONTE }}>
              {salvando ? 'Salvando...' : 'Combinar'}
            </button>
          </div>
        </div>
      )}

      {!abrindo && erro && <div style={{ fontSize: 12.5, color: '#DC2626', marginBottom: 10 }}>{erro}</div>}

      {carregando ? null : !visiveis.length ? (
        <div style={{ fontSize: 13, color: '#8AA0AA' }}>Nenhum retorno combinado.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visiveis.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid #EDF2F4', borderRadius: 10 }}>
              <div style={{ minWidth: 84, fontSize: 13.5, fontWeight: 700, color: '#16232B' }}>{dataBR(r.para_data)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: '#16232B', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{r.motivo}</div>
                {r.situacao === 'enviado' && r.texto && (
                  <div style={{ fontSize: 12.5, color: '#3A5560', marginTop: 6, padding: '6px 10px', background: '#F1FBF4', borderRadius: 8, lineHeight: 1.45 }}>
                    “{r.texto}”
                  </div>
                )}
              </div>
              <Selo r={r} />
              {podeEditar && r.situacao === 'agendado' && (
                <button onClick={() => cancelar(r)} title="Cancelar este retorno" aria-label="Cancelar este retorno"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#8AA0AA', padding: 2, display: 'flex' }}>
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
