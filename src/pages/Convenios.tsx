import React, { useEffect, useState } from 'react'
import { Plus, X, ShieldCheck, ChevronDown, ChevronUp, Trash2, Pencil, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAgente } from '../lib/agente'
import { useAcesso } from '../lib/acesso'
import { formatarReais } from '../lib/procedimentos'
import { lerReais } from '../lib/convenios'
import type { Convenio } from '../types'
import { MARCA_SUAVE, MARCA } from '../lib/marca'

/**
 * Convênios (rota /convenios, migração 0038).
 *
 * O convênio é a porta de entrada da clínica odontológica: traz o paciente,
 * que depois converte para o particular no plano de tratamento. Aqui a clínica
 * diz quais aceita e o que cada um cobre — e a Letícia passa a falar disso na
 * conversa (as duas visões do agente leem estas tabelas).
 *
 * O REPASSE (quanto o convênio paga à clínica por serviço) é dinheiro: a coluna
 * só aparece para quem tem a permissão Valores. Para os outros a tabela nem
 * devolve as linhas (RLS) — não é a tela que esconde.
 *
 * Convênio não se apaga quando está em uso (ficha ou consulta apontando para
 * ele): o banco recusa, e a tela sugere desativar.
 */

const FONTE = "'Plus Jakarta Sans', sans-serif"

interface ServicoResumo { id: string; nome: string }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid #DCE6EA',
  fontSize: 13.5, fontFamily: FONTE, color: '#16232B',
  outline: 'none', background: '#fff', boxSizing: 'border-box',
}

export default function Convenios() {
  const { nome: nomeAgente } = useAgente()
  const veValores = useAcesso().pode('valores')

  const [convenios, setConvenios] = useState<Convenio[]>([])
  const [servicos, setServicos] = useState<ServicoResumo[]>([])
  /** chave `convenio:servico` */
  const [coberturas, setCoberturas] = useState<Set<string>>(new Set())
  const [repasses, setRepasses] = useState<Map<string, number>>(new Map())
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState<string | null>(null)

  const [novoAberto, setNovoAberto] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('convenios').select('id, nome, ativo, observacoes, created_at').order('nome'),
      supabase.from('servicos_clinica').select('id, nome').eq('ativo', true).order('created_at'),
      supabase.from('convenio_coberturas').select('convenio_id, servico_id'),
      // Sem `valores`, volta vazio (RLS) — e a coluna nem é desenhada.
      supabase.from('convenio_repasses').select('convenio_id, servico_id, valor'),
    ]).then(([c, s, cob, rep]) => {
      setConvenios((c.data ?? []) as Convenio[])
      setServicos((s.data ?? []) as ServicoResumo[])
      setCoberturas(new Set((cob.data ?? []).map((x) => `${x.convenio_id}:${x.servico_id}`)))
      setRepasses(new Map((rep.data ?? []).map((x) => [`${x.convenio_id}:${x.servico_id}`, Number(x.valor)])))
      setCarregando(false)
    })
  }, [])

  const quantosCobre = (id: string) => servicos.filter((s) => coberturas.has(`${id}:${s.id}`)).length

  async function criar() {
    const nome = novoNome.trim()
    if (!nome) return
    setSalvandoNovo(true); setErro('')
    const { data, error } = await supabase.from('convenios').insert({ nome }).select().single()
    setSalvandoNovo(false)
    if (error) {
      setErro(error.code === '23505' ? 'Já existe um convênio com esse nome.' : 'Não consegui salvar. Tente de novo.')
      return
    }
    setConvenios((prev) => [...prev, data as Convenio].sort((a, b) => a.nome.localeCompare(b.nome)))
    setNovoNome(''); setNovoAberto(false)
    setAberto((data as Convenio).id)
  }

  async function atualizar(id: string, campos: Partial<Convenio>) {
    setErro('')
    const { error } = await supabase.from('convenios').update(campos).eq('id', id)
    if (error) {
      setErro(error.code === '23505' ? 'Já existe um convênio com esse nome.' : 'Não consegui salvar. Tente de novo.')
      return false
    }
    setConvenios((prev) => prev.map((c) => (c.id === id ? { ...c, ...campos } : c)))
    return true
  }

  async function apagar(c: Convenio) {
    if (!window.confirm(`Apagar o convênio ${c.nome}?`)) return
    setErro('')
    const { error } = await supabase.from('convenios').delete().eq('id', c.id)
    if (error) {
      setErro(error.code === '23503'
        ? `${c.nome} já está em fichas ou consultas, e por isso não pode ser apagado. Desative: ele some da ${nomeAgente} e das listas, e o histórico continua certo.`
        : 'Não consegui apagar. Tente de novo.')
      return
    }
    setConvenios((prev) => prev.filter((x) => x.id !== c.id))
  }

  async function alternarCobertura(convenioId: string, servicoId: string) {
    const chave = `${convenioId}:${servicoId}`
    const cobre = coberturas.has(chave)
    setErro('')
    const { error } = cobre
      ? await supabase.from('convenio_coberturas').delete().eq('convenio_id', convenioId).eq('servico_id', servicoId)
      : await supabase.from('convenio_coberturas').insert({ convenio_id: convenioId, servico_id: servicoId })
    if (error) { setErro('Não consegui salvar a cobertura. Tente de novo.'); return }
    setCoberturas((prev) => {
      const nova = new Set(prev)
      if (cobre) nova.delete(chave); else nova.add(chave)
      return nova
    })
  }

  async function salvarRepasse(convenioId: string, servicoId: string, texto: string) {
    const chave = `${convenioId}:${servicoId}`
    const valor = lerReais(texto)
    if (valor === (repasses.get(chave) ?? null)) return
    setErro('')
    const { error } = valor === null
      ? await supabase.from('convenio_repasses').delete().eq('convenio_id', convenioId).eq('servico_id', servicoId)
      : await supabase.from('convenio_repasses').upsert({ convenio_id: convenioId, servico_id: servicoId, valor })
    if (error) { setErro('Não consegui salvar o repasse. Tente de novo.'); return }
    setRepasses((prev) => {
      const novo = new Map(prev)
      if (valor === null) novo.delete(chave); else novo.set(chave, valor)
      return novo
    })
  }

  if (carregando) return <div style={{ padding: 40, textAlign: 'center', color: '#6B818C' }}>Carregando...</div>

  return (
    <div className="pagina" style={{ padding: '32px 36px', maxWidth: 900, margin: '0 auto' }}>

      <div className="fade-in-1" style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: MARCA_SUAVE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={18} strokeWidth={2} style={{ color: MARCA }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#16232B', margin: 0 }}>Convênios</h1>
            <span style={{ background: MARCA_SUAVE, color: MARCA, borderRadius: 20, fontSize: 12.5, fontWeight: 700, padding: '2px 10px' }}>{convenios.filter((c) => c.ativo).length}</span>
          </div>
          <p style={{ fontSize: 13, color: '#6B818C', marginTop: 10, marginBottom: 0, lineHeight: 1.6 }}>
            Os convênios que a clínica aceita e o que cada um cobre. A {nomeAgente} pergunta
            se o atendimento é particular ou convênio, diz quais a clínica aceita e o que
            eles cobrem — e a consulta já nasce marcada como convênio ou particular.
          </p>
        </div>
        <button onClick={() => { setNovoAberto((v) => !v); setErro('') }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: 'none', background: MARCA, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#fff', fontFamily: FONTE, flexShrink: 0 }}>
          {novoAberto ? <X size={15} /> : <Plus size={15} />} {novoAberto ? 'Cancelar' : 'Novo convênio'}
        </button>
      </div>

      {novoAberto && (
        <div className="cartao fade-in-1" style={{ background: '#fff', borderRadius: 14, border: `2px solid ${MARCA}`, padding: '18px 20px', marginBottom: 16 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: '#16232B', display: 'block', marginBottom: 6 }}>Nome do convênio</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input autoFocus value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void criar() }}
              placeholder="Ex.: Amil Dental" maxLength={80} style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
            <button onClick={criar} disabled={salvandoNovo || !novoNome.trim()}
              style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: novoNome.trim() ? MARCA : '#B8CBD3', color: '#fff', fontSize: 13.5, fontWeight: 600, fontFamily: FONTE, cursor: novoNome.trim() ? 'pointer' : 'not-allowed' }}>
              {salvandoNovo ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      {erro && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 14, lineHeight: 1.5 }}>{erro}</div>
      )}

      {convenios.length === 0 && !novoAberto && (
        <div className="cartao" style={{ background: '#fff', borderRadius: 14, border: '1px dashed #C9D8DE', padding: '28px 22px', textAlign: 'center', color: '#6B818C', fontSize: 13.5, lineHeight: 1.6 }}>
          Nenhum convênio cadastrado. Enquanto a lista estiver vazia, a {nomeAgente} trata
          todo atendimento como particular e não pergunta de convênio.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {convenios.map((c) => (
          <CartaoConvenio key={c.id}
            convenio={c}
            servicos={servicos}
            aberto={aberto === c.id}
            quantosCobre={quantosCobre(c.id)}
            cobre={(servicoId) => coberturas.has(`${c.id}:${servicoId}`)}
            repasse={(servicoId) => repasses.get(`${c.id}:${servicoId}`) ?? null}
            veValores={veValores}
            onAbrir={() => setAberto(aberto === c.id ? null : c.id)}
            onAtualizar={(campos) => atualizar(c.id, campos)}
            onApagar={() => apagar(c)}
            onCobertura={(servicoId) => alternarCobertura(c.id, servicoId)}
            onRepasse={(servicoId, texto) => salvarRepasse(c.id, servicoId, texto)}
          />
        ))}
      </div>
    </div>
  )
}

function CartaoConvenio({
  convenio, servicos, aberto, quantosCobre, cobre, repasse, veValores,
  onAbrir, onAtualizar, onApagar, onCobertura, onRepasse,
}: {
  convenio: Convenio
  servicos: ServicoResumo[]
  aberto: boolean
  quantosCobre: number
  cobre: (servicoId: string) => boolean
  repasse: (servicoId: string) => number | null
  veValores: boolean
  onAbrir: () => void
  onAtualizar: (campos: Partial<Convenio>) => Promise<boolean>
  onApagar: () => void
  onCobertura: (servicoId: string) => void
  onRepasse: (servicoId: string, texto: string) => void
}) {
  const [renomeando, setRenomeando] = useState(false)
  const [nome, setNome] = useState(convenio.nome)
  const [obs, setObs] = useState(convenio.observacoes ?? '')

  return (
    <div className="cartao" style={{ background: '#fff', borderRadius: 14, border: '1px solid #DCE6EA', opacity: convenio.ativo ? 1 : 0.7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          {renomeando ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} style={{ ...inputStyle, padding: '6px 10px' }}
                onKeyDown={async (e) => { if (e.key === 'Enter' && nome.trim() && await onAtualizar({ nome: nome.trim() })) setRenomeando(false) }} />
              <button title="Salvar" onClick={async () => { if (nome.trim() && await onAtualizar({ nome: nome.trim() })) setRenomeando(false) }}
                style={{ border: 'none', background: MARCA, color: '#fff', borderRadius: 8, padding: '0 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Check size={15} /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#16232B' }}>{convenio.nome}</span>
              <button title="Renomear" onClick={() => setRenomeando(true)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6B818C', padding: 2, display: 'flex' }}><Pencil size={13} /></button>
            </div>
          )}
          <div style={{ fontSize: 12.5, color: '#6B818C', marginTop: 3 }}>
            {quantosCobre === 0 ? 'Nenhum serviço coberto ainda' : `Cobre ${quantosCobre} de ${servicos.length} serviços`}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: convenio.ativo ? '#1A7A48' : '#6B818C' }}>
          <input type="checkbox" checked={convenio.ativo} onChange={(e) => void onAtualizar({ ativo: e.target.checked })}
            style={{ width: 16, height: 16, accentColor: MARCA, cursor: 'pointer' }} />
          {convenio.ativo ? 'Ativo' : 'Desativado'}
        </label>

        <button onClick={onAbrir}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid #DCE6EA', background: aberto ? MARCA_SUAVE : '#fff', color: MARCA, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: FONTE }}>
          Coberturas {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {aberto && (
        <div style={{ borderTop: '1px solid #EDF2F4', padding: '14px 18px 18px' }}>
          <div style={{ fontSize: 12, color: '#6B818C', marginBottom: 10, lineHeight: 1.55 }}>
            Marque o que {convenio.nome} cobre.
            {veValores && ' O repasse é quanto o convênio paga à clínica por aquele serviço — só quem tem a permissão Valores vê esta coluna.'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {servicos.map((s) => {
              const marcado = cobre(s.id)
              const valor = repasse(s.id)
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F2F6F7', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, minWidth: 190 }}>
                    <input type="checkbox" checked={marcado} onChange={() => onCobertura(s.id)}
                      style={{ width: 16, height: 16, accentColor: MARCA, cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, color: '#16232B' }}>{s.nome}</span>
                  </label>
                  {veValores && marcado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 26 }}>
                      <span style={{ fontSize: 12, color: '#6B818C' }}>Repasse</span>
                      <input key={`${s.id}:${valor ?? ''}`} defaultValue={valor === null ? '' : formatarReais(valor)}
                        placeholder="R$ 0,00" inputMode="decimal"
                        onBlur={(e) => onRepasse(s.id, e.target.value)}
                        style={{ ...inputStyle, width: 120, padding: '6px 10px', fontSize: 13 }} />
                    </div>
                  )}
                </div>
              )
            })}
            {servicos.length === 0 && (
              <div style={{ fontSize: 13, color: '#6B818C', fontStyle: 'italic' }}>Nenhum serviço ativo. Cadastre em Serviços.</div>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#16232B', display: 'block', marginBottom: 6 }}>Observações internas</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
              onBlur={() => { if (obs !== (convenio.observacoes ?? '')) void onAtualizar({ observacoes: obs.trim() || null }) }}
              placeholder="Ex.: exige guia autorizada para tratamento de canal; prazo de pagamento 30 dias."
              style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ fontSize: 11.5, color: '#6B818C', marginTop: 5 }}>Só a equipe vê — a atendente de IA não lê este campo.</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button onClick={onApagar}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #FECACA', background: '#fff', color: '#DC2626', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: FONTE }}>
              <Trash2 size={13} /> Apagar convênio
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
