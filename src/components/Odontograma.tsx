import { useEffect, useMemo, useState } from 'react'
import { X, Pencil, Trash2, History, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  CONDICOES, CONDICAO, SITUACOES, SITUACAO, NOME_DA_FACE,
  dentesDoQuadrante, ehSuperior, facesNoDesenho, descreverRegistro,
  carregarOdontograma, carregarHistorico, salvarRegistro, apagarRegistro, definirDeciduos,
  type Face, type Condicao, type Situacao, type RegistroOdontograma, type HistoricoOdontograma,
} from '../lib/odontograma'
import { MARCA, MARCA_SUAVE } from '../lib/marca'
import ModalPortal from './ModalPortal'

/**
 * O odontograma do paciente (migração 0040), dentro da ficha.
 *
 * Toque num dente para ver o que há nele e, com a permissão Odontograma,
 * marcar. Vermelho é o que falta fazer; azul, o que já existe ou foi feito.
 * A lista "A tratar", embaixo, é a matéria-prima do plano de tratamento.
 *
 * Sem a permissão, tudo é só leitura: o banco recusaria de qualquer jeito
 * (política `odontograma_registros_altera`).
 */

const FONTE = "'Plus Jakarta Sans', sans-serif"
const LADO = 30      // o quadrado do dente, no desenho
const MEIO = 9       // onde começa o quadrado do meio (a face oclusal)
const CINZA = '#F7FAFB'
const CONTORNO = '#9FB3BC'

/** A cor de uma face: vermelho ganha de azul — o que falta fazer é o que importa ver. */
function corDaFace(regs: RegistroOdontograma[], face: Face): string {
  const daFace = regs.filter((r) => r.faces.includes(face))
  if (!daFace.length) return CINZA
  return daFace.some((r) => r.situacao === 'a_tratar') ? SITUACAO.a_tratar.fundo : SITUACAO.existente.fundo
}

function corDoTraco(regs: RegistroOdontograma[]): string {
  return regs.some((r) => r.situacao === 'a_tratar') ? SITUACAO.a_tratar.cor : SITUACAO.existente.cor
}

function Dente({ dente, regs, onAbrir }: { dente: number; regs: RegistroOdontograma[]; onAbrir: () => void }) {
  const f = facesNoDesenho(dente)
  const inteiros = regs.filter((r) => r.faces.length === 0)
  const ausente = inteiros.find((r) => r.condicao === 'ausente' || r.condicao === 'extracao')
  const sigla = inteiros.find((r) => r.condicao !== 'ausente' && r.condicao !== 'extracao')
  const superior = ehSuperior(dente)
  const temAlgo = regs.length > 0
  const L = LADO, M = MEIO, N = LADO - MEIO

  const numero = (
    <div style={{ fontSize: 10.5, fontWeight: temAlgo ? 700 : 500, color: temAlgo ? '#16232B' : '#6B818C', textAlign: 'center', lineHeight: '14px' }}>{dente}</div>
  )

  return (
    <button onClick={onAbrir} title={`Dente ${dente}`}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, fontFamily: FONTE }}>
      {superior && numero}
      <svg width={34} height={34} viewBox={`-2 -2 ${L + 4} ${L + 4}`} aria-hidden>
        <polygon points={`0,0 ${L},0 ${N},${M} ${M},${M}`} fill={corDaFace(regs, f.cima)} stroke={CONTORNO} strokeWidth={0.8} />
        <polygon points={`0,${L} ${L},${L} ${N},${N} ${M},${N}`} fill={corDaFace(regs, f.baixo)} stroke={CONTORNO} strokeWidth={0.8} />
        <polygon points={`0,0 ${M},${M} ${M},${N} 0,${L}`} fill={corDaFace(regs, f.esquerda)} stroke={CONTORNO} strokeWidth={0.8} />
        <polygon points={`${L},0 ${N},${M} ${N},${N} ${L},${L}`} fill={corDaFace(regs, f.direita)} stroke={CONTORNO} strokeWidth={0.8} />
        <rect x={M} y={M} width={N - M} height={N - M} fill={corDaFace(regs, 'O')} stroke={CONTORNO} strokeWidth={0.8} />
        {sigla && (
          <text x={L / 2} y={L / 2 + 3.5} textAnchor="middle" fontSize={sigla && CONDICAO[sigla.condicao].sigla.length > 1 ? 8.5 : 10}
            fontWeight={800} fill={corDoTraco([sigla])} fontFamily="Arial, sans-serif">
            {CONDICAO[sigla.condicao].sigla}
          </text>
        )}
        {ausente && (
          <g stroke={corDoTraco([ausente])} strokeWidth={2.4} strokeLinecap="round">
            <line x1={-1} y1={-1} x2={L + 1} y2={L + 1} />
            <line x1={L + 1} y1={-1} x2={-1} y2={L + 1} />
          </g>
        )}
      </svg>
      {!superior && numero}
    </button>
  )
}

function Quadrante({ q, porDente, onAbrir }: { q: number; porDente: Map<number, RegistroOdontograma[]>; onAbrir: (d: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 3, justifyContent: [1, 4, 5, 8].includes(q) ? 'flex-end' : 'flex-start' }}>
      {dentesDoQuadrante(q).map((d) => (
        <Dente key={d} dente={d} regs={porDente.get(d) ?? []} onAbrir={() => onAbrir(d)} />
      ))}
    </div>
  )
}

/** Uma arcada: os dois quadrantes lado a lado, com a linha do meio. Em tela estreita, um embaixo do outro. */
function Arcada({ direita, esquerda, porDente, onAbrir, rotulo }: {
  direita: number; esquerda: number; porDente: Map<number, RegistroOdontograma[]>; onAbrir: (d: number) => void; rotulo: string
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9AAEB6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, textAlign: 'center' }}>{rotulo}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', rowGap: 8 }}>
        <div style={{ paddingRight: 6, borderRight: '2px solid #DCE6EA' }}>
          <Quadrante q={direita} porDente={porDente} onAbrir={onAbrir} />
        </div>
        <div style={{ paddingLeft: 6 }}>
          <Quadrante q={esquerda} porDente={porDente} onAbrir={onAbrir} />
        </div>
      </div>
    </div>
  )
}

export default function Odontograma({ leadId, podeEditar }: { leadId: string; podeEditar: boolean }) {
  const [carregando, setCarregando] = useState(true)
  const [deciduos, setDeciduos] = useState(false)
  const [registros, setRegistros] = useState<RegistroOdontograma[]>([])
  const [erro, setErro] = useState('')
  const [denteAberto, setDenteAberto] = useState<number | null>(null)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [historico, setHistorico] = useState<HistoricoOdontograma[] | null>(null)
  const [nomes, setNomes] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    carregarOdontograma(leadId)
      .then((o) => { setDeciduos(o.deciduos); setRegistros(o.registros) })
      .catch(() => setErro('Não consegui carregar o odontograma.'))
      .finally(() => setCarregando(false))
  }, [leadId])

  useEffect(() => {
    if (!historicoAberto || historico) return
    Promise.all([
      carregarHistorico(leadId),
      supabase.from('usuarios').select('id, nome'),
    ]).then(([h, u]) => {
      setHistorico(h)
      setNomes(new Map((u.data ?? []).map((x) => [x.id as string, (x.nome as string) || 'Alguém da equipe'])))
    }).catch(() => setErro('Não consegui carregar o histórico.'))
  }, [historicoAberto, historico, leadId])

  const porDente = useMemo(() => {
    const m = new Map<number, RegistroOdontograma[]>()
    for (const r of registros) m.set(r.dente, [...(m.get(r.dente) ?? []), r])
    return m
  }, [registros])

  const aTratar = registros.filter((r) => r.situacao === 'a_tratar')

  async function alternarDeciduos() {
    const novo = !deciduos
    setErro('')
    try { await definirDeciduos(leadId, novo); setDeciduos(novo) }
    catch { setErro('Não consegui salvar. Tente de novo.') }
  }

  const aoMudar = (lista: RegistroOdontograma[]) => { setRegistros(lista); setHistorico(null) }

  if (carregando) return <div style={{ fontSize: 13, color: '#6B818C' }}>Carregando o odontograma...</div>

  return (
    <div>
      {/* Legenda e dentes de leite */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3A5560' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: SITUACAO.a_tratar.fundo, border: `1px solid ${SITUACAO.a_tratar.cor}` }} /> A tratar
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3A5560' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: SITUACAO.existente.fundo, border: `1px solid ${SITUACAO.existente.cor}` }} /> Existente / tratado
        </span>
        <span style={{ fontSize: 12, color: '#6B818C' }}>X = ausente ou extração</span>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#3A5560', cursor: podeEditar ? 'pointer' : 'default' }}>
          <input type="checkbox" checked={deciduos} disabled={!podeEditar} onChange={alternarDeciduos}
            style={{ width: 15, height: 15, accentColor: MARCA, cursor: podeEditar ? 'pointer' : 'default' }} />
          Dentes de leite
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowX: 'auto', paddingBottom: 4 }}>
        <Arcada direita={1} esquerda={2} porDente={porDente} onAbrir={setDenteAberto} rotulo="Superior" />
        {deciduos && <Arcada direita={5} esquerda={6} porDente={porDente} onAbrir={setDenteAberto} rotulo="Superior · de leite" />}
        {deciduos && <Arcada direita={8} esquerda={7} porDente={porDente} onAbrir={setDenteAberto} rotulo="Inferior · de leite" />}
        <Arcada direita={4} esquerda={3} porDente={porDente} onAbrir={setDenteAberto} rotulo="Inferior" />
      </div>
      <div style={{ fontSize: 11.5, color: '#9AAEB6', textAlign: 'center', marginTop: 6 }}>
        Visto de frente para o paciente: a direita dele fica à esquerda. {podeEditar ? 'Toque num dente para marcar.' : 'Toque num dente para ver os detalhes.'}
      </div>

      {erro && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#DC2626', marginTop: 12 }}>{erro}</div>}

      {/* A tratar — o que vira plano de tratamento */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#16232B', marginBottom: 8 }}>
          A tratar {aTratar.length > 0 && <span style={{ color: SITUACAO.a_tratar.cor }}>({aTratar.length})</span>}
        </div>
        {aTratar.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#6B818C' }}>Nada marcado como a tratar.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {aTratar.map((r) => (
              <button key={r.id} onClick={() => setDenteAberto(r.dente)}
                style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${SITUACAO.a_tratar.cor}33`, background: SITUACAO.a_tratar.fundo, color: SITUACAO.a_tratar.cor, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONTE }}>
                {r.dente}{r.faces.length ? ` ${r.faces.join('')}` : ''} · {CONDICAO[r.condicao].nome}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Histórico */}
      <button onClick={() => setHistoricoAberto((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: MARCA, fontFamily: FONTE }}>
        <History size={14} /> Histórico {historicoAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {historicoAberto && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {!historico ? <div style={{ fontSize: 12.5, color: '#6B818C' }}>Carregando...</div>
            : historico.length === 0 ? <div style={{ fontSize: 12.5, color: '#6B818C' }}>Nada registrado ainda.</div>
            : historico.map((h) => {
              const alvo = (h.depois ?? h.antes) as RegistroOdontograma | null
              const quando = new Date(h.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
              const quem = h.por ? (nomes.get(h.por) ?? 'Alguém da equipe') : 'Sistema'
              const verbo = h.acao === 'criou' ? 'marcou' : h.acao === 'alterou' ? 'alterou' : 'apagou'
              return (
                <div key={h.id} style={{ fontSize: 12.5, color: '#3A5560', lineHeight: 1.5 }}>
                  <span style={{ color: '#9AAEB6' }}>{quando}</span> · <strong>{quem}</strong> {verbo}{' '}
                  {alvo ? descreverRegistro({ dente: alvo.dente, faces: alvo.faces ?? [], condicao: alvo.condicao, situacao: alvo.situacao }) : ''}
                  {h.acao === 'alterou' && h.antes && (
                    <span style={{ color: '#9AAEB6' }}> (antes: {descreverRegistro({ dente: h.antes.dente!, faces: h.antes.faces ?? [], condicao: h.antes.condicao!, situacao: h.antes.situacao! })})</span>
                  )}
                </div>
              )
            })}
        </div>
      )}

      {denteAberto !== null && (
        <ModalDente
          leadId={leadId}
          dente={denteAberto}
          regs={porDente.get(denteAberto) ?? []}
          podeEditar={podeEditar}
          onFechar={() => setDenteAberto(null)}
          onSalvo={(r) => aoMudar(registros.some((x) => x.id === r.id) ? registros.map((x) => (x.id === r.id ? r : x)) : [...registros, r])}
          onApagado={(id) => aoMudar(registros.filter((x) => x.id !== id))}
        />
      )}
    </div>
  )
}

function ModalDente({ leadId, dente, regs, podeEditar, onFechar, onSalvo, onApagado }: {
  leadId: string
  dente: number
  regs: RegistroOdontograma[]
  podeEditar: boolean
  onFechar: () => void
  onSalvo: (r: RegistroOdontograma) => void
  onApagado: (id: string) => void
}) {
  const vazio = { id: undefined as string | undefined, condicao: 'carie' as Condicao, faces: [] as Face[], situacao: 'a_tratar' as Situacao, observacao: '' }
  const [form, setForm] = useState(vazio)
  const [formAberto, setFormAberto] = useState(podeEditar && regs.length === 0)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const porFace = CONDICAO[form.condicao].porFace
  const f = facesNoDesenho(dente)
  // A ordem dos botões segue o desenho: cima, esquerda, meio, direita, baixo.
  const ordemFaces: Face[] = [f.cima, f.esquerda, 'O', f.direita, f.baixo]

  function editar(r: RegistroOdontograma) {
    setForm({ id: r.id, condicao: r.condicao, faces: r.faces, situacao: r.situacao, observacao: r.observacao ?? '' })
    setFormAberto(true); setErro('')
  }

  async function salvar() {
    if (porFace && form.faces.length === 0) { setErro('Escolha pelo menos uma face.'); return }
    setSalvando(true); setErro('')
    try {
      const r = await salvarRegistro(leadId, {
        id: form.id, dente, condicao: form.condicao,
        faces: porFace ? form.faces : [],
        situacao: form.situacao, observacao: form.observacao.trim() || null,
      })
      onSalvo(r)
      setForm(vazio); setFormAberto(false)
    } catch {
      setErro('Não consegui salvar. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  async function apagar(r: RegistroOdontograma) {
    if (!window.confirm(`Apagar "${descreverRegistro(r)}"?`)) return
    setErro('')
    try { await apagarRegistro(r.id); onApagado(r.id) }
    catch { setErro('Não consegui apagar. Tente de novo.') }
  }

  const chip = (ativo: boolean, cor = MARCA, fundo = MARCA_SUAVE): React.CSSProperties => ({
    padding: '6px 11px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONTE,
    border: `1px solid ${ativo ? cor : '#DCE6EA'}`, background: ativo ? fundo : '#fff', color: ativo ? cor : '#6B818C',
  })

  // No portal: a ficha anima com `transform`, e `position: fixed` dentro de
  // um ancestral com transform passa a ser relativo a ele — o modal abria no
  // meio da página, sem escurecer o fundo.
  return (
    <ModalPortal>
    <div className="modal-fundo modal-cheio" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #DCE6EA', width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', padding: '22px 24px', boxShadow: '0 8px 48px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#16232B' }}>Dente {dente}</span>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} color="#6B818C" /></button>
        </div>

        {/* O que já há neste dente */}
        {regs.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6B818C', marginBottom: 12 }}>Nada marcado neste dente.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {regs.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', borderRadius: 10, background: SITUACAO[r.situacao].fundo }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: SITUACAO[r.situacao].cor }}>
                    {CONDICAO[r.condicao].nome}{r.faces.length ? ` · ${r.faces.join('')}` : ' · dente inteiro'}
                  </div>
                  <div style={{ fontSize: 12, color: '#3A5560' }}>{SITUACAO[r.situacao].nome}{r.observacao ? ` — ${r.observacao}` : ''}</div>
                </div>
                {podeEditar && (
                  <>
                    <button title="Alterar" onClick={() => editar(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3A5560', padding: 3 }}><Pencil size={14} /></button>
                    <button title="Apagar" onClick={() => apagar(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 3 }}><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {podeEditar && !formAberto && (
          <button onClick={() => { setForm(vazio); setFormAberto(true) }}
            style={{ width: '100%', padding: '9px', borderRadius: 9, border: `1px dashed ${MARCA}`, background: '#fff', color: MARCA, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONTE }}>
            + Marcar neste dente
          </button>
        )}

        {podeEditar && formAberto && (
          <div style={{ borderTop: regs.length ? '1px solid #EDF2F4' : 'none', paddingTop: regs.length ? 12 : 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#16232B', marginBottom: 6 }}>{form.id ? 'Alterar' : 'O que tem'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CONDICOES.map((c) => (
                  <button key={c.chave} onClick={() => setForm({ ...form, condicao: c.chave })} style={chip(form.condicao === c.chave)}>{c.nome}</button>
                ))}
              </div>
            </div>

            {porFace ? (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#16232B', marginBottom: 6 }}>Faces</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ordemFaces.map((face) => {
                    const ativo = form.faces.includes(face)
                    return (
                      <button key={face} title={NOME_DA_FACE[face]}
                        onClick={() => setForm({ ...form, faces: ativo ? form.faces.filter((x) => x !== face) : [...form.faces, face] })}
                        style={chip(ativo)}>
                        {face} <span style={{ fontWeight: 400, fontSize: 11.5 }}>{NOME_DA_FACE[face].split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#6B818C' }}>Vale para o dente inteiro.</div>
            )}

            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#16232B', marginBottom: 6 }}>Situação</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SITUACOES.map((s) => (
                  <button key={s.chave} onClick={() => setForm({ ...form, situacao: s.chave })} style={chip(form.situacao === s.chave, s.cor, s.fundo)}>{s.nome}</button>
                ))}
              </div>
            </div>

            <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Observação (opcional)" maxLength={200}
              style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid #DCE6EA', fontSize: 13.5, fontFamily: FONTE, color: '#16232B', outline: 'none' }} />

            {erro && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#DC2626' }}>{erro}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              {(regs.length > 0 || form.id) && (
                <button onClick={() => { setFormAberto(false); setForm(vazio); setErro('') }}
                  style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid #DCE6EA', background: '#fff', color: '#6B818C', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONTE }}>Cancelar</button>
              )}
              <button onClick={salvar} disabled={salvando}
                style={{ flex: 1, padding: '9px 16px', borderRadius: 9, border: 'none', background: MARCA, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: salvando ? 'wait' : 'pointer', fontFamily: FONTE }}>
                {salvando ? 'Salvando...' : form.id ? 'Salvar alteração' : 'Marcar'}
              </button>
            </div>
          </div>
        )}

        {!podeEditar && <div style={{ fontSize: 12, color: '#6B818C', marginTop: 4 }}>Você vê o odontograma, mas não pode alterá-lo.</div>}
        {erro && !formAberto && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#DC2626', marginTop: 10 }}>{erro}</div>}
      </div>
    </div>
    </ModalPortal>
  )
}
