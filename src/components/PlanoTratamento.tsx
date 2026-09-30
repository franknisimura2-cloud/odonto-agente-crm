import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Link2, Copy, Send, CalendarPlus, Check, RotateCcw, X, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatarReais } from '../lib/procedimentos'
import { lerReais } from '../lib/convenios'
import { enviarMensagem } from '../lib/conversas'
import { carregarOdontograma, CONDICAO } from '../lib/odontograma'
import {
  ETAPAS, nomeDaEtapa, STATUS_PLANO, STATUS_ITEM, sugerirServico, totais, linkDoPaciente,
  planosDoPaciente, servicosParaPlano, criarPlano, atualizarPlano, apagarPlano,
  adicionarItens, atualizarItem, apagarItem,
  type Plano, type ItemPlano, type ServicoPlano,
} from '../lib/planos'
import type { LeadClinica } from '../types'
import { MARCA, MARCA_SUAVE } from '../lib/marca'

/**
 * O plano de tratamento, na ficha (migração 0041).
 *
 * RASCUNHO é da equipe: monta, ajusta valores e cobertura, e ninguém de fora
 * vê. APRESENTAR gera o link do paciente (e pode mandar pelo WhatsApp); daí
 * em diante o plano segue as decisões — do paciente, pelo link, ou da equipe,
 * que registra a aprovação dada na cadeira.
 *
 * A cobertura e o valor dos itens novos saem do banco (convênio da ficha +
 * cobertura do serviço). Trocar o serviço de um item recria o item, para essa
 * regra valer de novo.
 */

const FONTE = "'Plus Jakarta Sans', sans-serif"

const campo: React.CSSProperties = {
  padding: '6px 9px', borderRadius: 8, border: '1px solid #DCE6EA', fontSize: 13,
  fontFamily: FONTE, color: '#16232B', outline: 'none', background: '#fff',
}

function botao(cor: string, cheio = false): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9,
    border: cheio ? 'none' : `1px solid ${cor === MARCA ? '#DCE6EA' : cor + '55'}`,
    background: cheio ? cor : '#fff', color: cheio ? '#fff' : cor,
    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONTE, whiteSpace: 'nowrap',
  }
}

function Pilula({ nome, cor, fundo }: { nome: string; cor: string; fundo: string }) {
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, color: cor, background: fundo, whiteSpace: 'nowrap' }}>{nome}</span>
}

export default function PlanoTratamento({ lead, podeEditar, podeEnviar, podeAgendar, onAgendar }: {
  lead: LeadClinica
  podeEditar: boolean
  podeEnviar: boolean
  podeAgendar: boolean
  /** Abre a marcação com o item; `pronto(id)` liga a consulta criada ao item. */
  onAgendar: (item: ItemPlano, pronto: (consultaId: string) => void) => void
}) {
  const [carregando, setCarregando] = useState(true)
  const [planos, setPlanos] = useState<Plano[]>([])
  const [itens, setItens] = useState<ItemPlano[]>([])
  const [servicos, setServicos] = useState<ServicoPlano[]>([])
  const [convenioNomes, setConvenioNomes] = useState<Map<string, string>>(new Map())
  const [clinica, setClinica] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [novoServico, setNovoServico] = useState('')

  useEffect(() => {
    Promise.all([
      planosDoPaciente(lead.id),
      servicosParaPlano(),
      supabase.from('convenios').select('id, nome'),
      supabase.from('configuracoes_clinica').select('nome_clinica').limit(1).maybeSingle(),
    ]).then(([p, s, c, cl]) => {
      setPlanos(p.planos); setItens(p.itens); setServicos(s)
      setConvenioNomes(new Map((c.data ?? []).map((x) => [x.id as string, x.nome as string])))
      setClinica((cl.data?.nome_clinica as string) ?? '')
      setAberto(p.planos[0]?.id ?? null)
    }).catch(() => setErro('Não consegui carregar os planos.'))
      .finally(() => setCarregando(false))
  }, [lead.id])

  const plano = planos.find((p) => p.id === aberto) ?? null
  const doPlano = useMemo(() => itens.filter((i) => i.plano_id === aberto), [itens, aberto])
  const rascunho = plano?.status === 'rascunho'
  const editavel = podeEditar && rascunho

  async function acao(fn: () => Promise<void>, falha = 'Não consegui salvar. Tente de novo.') {
    setOcupado(true); setErro(''); setAviso('')
    try { await fn() } catch { setErro(falha) } finally { setOcupado(false) }
  }

  const trocarPlano = (p: Plano) => setPlanos((prev) => prev.map((x) => (x.id === p.id ? p : x)))
  const trocarItem = (i: ItemPlano) => setItens((prev) => prev.map((x) => (x.id === i.id ? i : x)))

  /** Relê só os itens do plano: o banco muda status e cobertura sozinho. */
  async function recarregar() {
    const p = await planosDoPaciente(lead.id)
    setPlanos(p.planos); setItens(p.itens)
  }

  const novoPlano = () => acao(async () => {
    const p = await criarPlano(lead.id)
    setPlanos((prev) => [p, ...prev]); setAberto(p.id)
  })

  const trazerDoOdontograma = () => acao(async () => {
    if (!plano) return
    const { registros } = await carregarOdontograma(lead.id)
    const jaNoPlano = new Set(doPlano.map((i) => i.registro_id).filter(Boolean))
    const faltam = registros.filter((r) => r.situacao === 'a_tratar' && !jaNoPlano.has(r.id))
    if (!faltam.length) { setAviso('Tudo o que está "a tratar" no odontograma já está no plano.'); return }
    const novos = await adicionarItens(plano.id, faltam.map((r) => ({
      registro: r, servico: sugerirServico(r.condicao, servicos),
      procedimento: `${CONDICAO[r.condicao].nome} (escolha o serviço)`,
    })))
    setItens((prev) => [...prev, ...novos])
    const semServico = novos.filter((i) => !i.servico_id).length
    setAviso(`${novos.length} item(ns) trazido(s) do odontograma.${semServico ? ` ${semServico} sem serviço correspondente: escolha na lista.` : ''}`)
  })

  const adicionarServico = () => acao(async () => {
    const s = servicos.find((x) => x.id === novoServico)
    if (!plano || !s) return
    const [novo] = await adicionarItens(plano.id, [{ servico: s }])
    setItens((prev) => [...prev, novo]); setNovoServico('')
  })

  /** Trocar o serviço recria o item: é na criação que o banco decide cobertura e valor. */
  const trocarServico = (item: ItemPlano, servicoId: string) => acao(async () => {
    const s = servicos.find((x) => x.id === servicoId)
    if (!s || !plano) return
    const [novo] = await adicionarItens(plano.id, [{ servico: s, etapa: item.etapa }])
    const ajustado = await atualizarItem(novo.id, { registro_id: item.registro_id, dente: item.dente, faces: item.faces, observacao: item.observacao, ordem: item.ordem })
    await apagarItem(item.id)
    setItens((prev) => [...prev.filter((x) => x.id !== item.id && x.id !== novo.id), ajustado])
  })

  const trocarCobertura = (item: ItemPlano, valorSelect: string) => acao(async () => {
    const s = servicos.find((x) => x.id === item.servico_id)
    const campos = valorSelect === 'particular'
      ? { cobertura: 'particular' as const, convenio_id: null, valor: item.cobertura === 'particular' ? item.valor : (s?.preco_a_partir_de ?? 0) }
      : { cobertura: 'convenio' as const, convenio_id: valorSelect, valor: 0 }
    trocarItem(await atualizarItem(item.id, campos))
  })

  const apresentar = () => acao(async () => {
    if (!plano) return
    if (!doPlano.length) { setErro('O plano está vazio.'); return }
    if (doPlano.some((i) => !i.servico_id)) { setErro('Há itens sem serviço escolhido.'); return }
    trocarPlano(await atualizarPlano(plano.id, { status: 'apresentado', apresentado_em: new Date().toISOString() }))
    setAviso('Plano apresentado. Envie o link ao paciente — ele aprova por etapa.')
  })

  const voltarRascunho = () => acao(async () => {
    if (!plano) return
    trocarPlano(await atualizarPlano(plano.id, { status: 'rascunho' }))
  })

  /** Aprovação dada na cadeira: a equipe registra, etapa por etapa. */
  const aprovarEtapa = (etapa: number) => acao(async () => {
    const pendentes = doPlano.filter((i) => i.etapa === etapa && i.status === 'pendente')
    for (const i of pendentes) await atualizarItem(i.id, { status: 'aprovado' })
    await recarregar()
  })

  const recusarPendentes = () => acao(async () => {
    if (!window.confirm('Marcar como recusado tudo o que ainda não foi aprovado?')) return
    for (const i of doPlano.filter((x) => x.status === 'pendente')) await atualizarItem(i.id, { status: 'recusado' })
    await recarregar()
  })

  const copiarLink = () => {
    if (!plano) return
    void navigator.clipboard?.writeText(linkDoPaciente(plano.token))
      .then(() => setAviso('Link copiado.'))
      .catch(() => setAviso(linkDoPaciente(plano.token)))
  }

  const enviarLink = () => acao(async () => {
    if (!plano) return
    const primeiro = (lead.nome_lead ?? '').trim().split(/\s+/)[0]
    const texto =
      `Olá${primeiro ? `, ${primeiro}` : ''}! Aqui está o seu plano de tratamento${clinica ? ` da ${clinica}` : ''}:\n` +
      `${linkDoPaciente(plano.token)}\n\n` +
      'Nele você vê cada etapa, o que o convênio cobre e o valor do que é particular — e pode aprovar por ali mesmo. ' +
      'Qualquer dúvida, é só responder esta mensagem 😊'
    await enviarMensagem(lead.id, texto)
    setAviso('Link enviado pelo WhatsApp.')
  }, 'Não consegui enviar pelo WhatsApp. Copie o link e envie de outro jeito.')

  if (carregando) return <div style={{ fontSize: 13, color: '#6B818C' }}>Carregando os planos...</div>

  const t = totais(doPlano, plano?.desconto ?? 0)
  const etapasComItens = [...new Set(doPlano.map((i) => i.etapa))].sort()

  return (
    <div>
      {/* Os planos da pessoa */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {planos.map((p, idx) => (
          <button key={p.id} onClick={() => setAberto(p.id)}
            style={{ ...botao(MARCA), background: p.id === aberto ? MARCA_SUAVE : '#fff', borderColor: p.id === aberto ? MARCA : '#DCE6EA' }}>
            <FileText size={13} /> Plano {planos.length - idx} · {new Date(p.created_at).toLocaleDateString('pt-BR')}
            <Pilula {...STATUS_PLANO[p.status]} />
          </button>
        ))}
        {podeEditar && (!plano || !rascunho) && (
          <button onClick={novoPlano} disabled={ocupado} style={botao(MARCA, planos.length === 0)}>
            <Plus size={13} /> {planos.length === 0 ? 'Criar plano de tratamento' : 'Novo plano'}
          </button>
        )}
      </div>

      {planos.length === 0 && (
        <div style={{ fontSize: 13, color: '#6B818C', lineHeight: 1.6 }}>
          Nenhum plano ainda. O plano nasce do odontograma: o que está marcado como <strong>a tratar</strong> vira
          item, com o que o convênio cobre e o valor do particular.
          {!podeEditar && ' Quem monta é quem tem a permissão Orçamentos ou Odontograma.'}
        </div>
      )}

      {erro && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#DC2626', marginBottom: 12 }}>{erro}</div>}
      {aviso && <div style={{ background: '#E8F8EF', border: '1px solid #A7D8C0', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#1A7A48', marginBottom: 12, wordBreak: 'break-all' }}>{aviso}</div>}

      {plano && (
        <div>
          {/* Ações do plano */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {editavel && (
              <>
                <button onClick={trazerDoOdontograma} disabled={ocupado} style={botao(MARCA)}><Plus size={13} /> Trazer do odontograma</button>
                <button onClick={apresentar} disabled={ocupado || !doPlano.length} style={botao(MARCA, true)}><Check size={13} /> Apresentar ao paciente</button>
                <button onClick={() => acao(async () => {
                  if (!window.confirm('Apagar este rascunho?')) return
                  await apagarPlano(plano.id)
                  setPlanos((prev) => prev.filter((p) => p.id !== plano.id)); setAberto(planos.find((p) => p.id !== plano.id)?.id ?? null)
                })} disabled={ocupado} style={botao('#DC2626')}><Trash2 size={13} /> Apagar rascunho</button>
              </>
            )}
            {!rascunho && (
              <>
                <button onClick={copiarLink} style={botao(MARCA)}><Copy size={13} /> Copiar link</button>
                {podeEnviar && lead.whatsapp_lead && <button onClick={enviarLink} disabled={ocupado} style={botao(MARCA, true)}><Send size={13} /> Enviar pelo WhatsApp</button>}
                <a href={linkDoPaciente(plano.token)} target="_blank" rel="noreferrer" style={{ ...botao(MARCA), textDecoration: 'none' }}><Link2 size={13} /> Ver como o paciente</a>
                {podeEditar && ['apresentado', 'parcial'].includes(plano.status) && doPlano.some((i) => i.status === 'pendente') && (
                  <button onClick={recusarPendentes} disabled={ocupado} style={botao('#DC2626')}><X size={13} /> Paciente recusou o restante</button>
                )}
                {podeEditar && plano.status === 'apresentado' && doPlano.every((i) => i.status === 'pendente') && (
                  <button onClick={voltarRascunho} disabled={ocupado} style={botao('#6B818C')}><RotateCcw size={13} /> Voltar a rascunho</button>
                )}
              </>
            )}
          </div>

          {editavel && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <select value={novoServico} onChange={(e) => setNovoServico(e.target.value)} style={{ ...campo, flex: 1, minWidth: 200 }}>
                <option value="">Adicionar um procedimento…</option>
                {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
              <button onClick={adicionarServico} disabled={!novoServico || ocupado} style={botao(MARCA)}><Plus size={13} /> Adicionar</button>
            </div>
          )}

          {doPlano.length === 0 && (
            <div style={{ fontSize: 13, color: '#6B818C', marginBottom: 12 }}>
              {editavel ? 'Plano vazio. Traga do odontograma ou adicione um procedimento.' : 'Plano vazio.'}
            </div>
          )}

          {/* As etapas */}
          {etapasComItens.map((etapa) => {
            const daEtapa = doPlano.filter((i) => i.etapa === etapa)
            const sub = totais(daEtapa)
            const temPendente = daEtapa.some((i) => i.status === 'pendente')
            return (
              <div key={etapa} style={{ border: '1px solid #EDF2F4', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F7FAFB', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#16232B' }}>Etapa {etapa} · {nomeDaEtapa(etapa)}</span>
                  <span style={{ fontSize: 12, color: '#6B818C' }}>
                    {sub.convenio > 0 && `${sub.convenio} pelo convênio`}{sub.convenio > 0 && sub.particular > 0 && ' · '}{sub.particular > 0 && `${formatarReais(sub.particular)} particular`}
                  </span>
                  {podeEditar && !rascunho && ['apresentado', 'parcial'].includes(plano.status) && temPendente && (
                    <button onClick={() => aprovarEtapa(etapa)} disabled={ocupado} style={{ ...botao('#1A7A48'), marginLeft: 'auto', padding: '5px 10px' }}><Check size={12} /> Paciente aprovou esta etapa</button>
                  )}
                </div>
                {daEtapa.map((i) => (
                  <LinhaItem key={i.id} item={i} editavel={editavel} servicos={servicos}
                    convenioDaFicha={lead.forma_pagamento === 'convenio' ? lead.convenio_id : null}
                    convenioNomes={convenioNomes}
                    podeAgendar={podeAgendar && ['aprovado', 'parcial'].includes(plano.status)}
                    ocupado={ocupado}
                    onServico={(sid) => trocarServico(i, sid)}
                    onCobertura={(v) => trocarCobertura(i, v)}
                    onValor={(v) => acao(async () => trocarItem(await atualizarItem(i.id, { valor: v })))}
                    onEtapa={(e) => acao(async () => trocarItem(await atualizarItem(i.id, { etapa: e })))}
                    onApagar={() => acao(async () => { await apagarItem(i.id); setItens((prev) => prev.filter((x) => x.id !== i.id)) })}
                    onAgendar={() => onAgendar(i, (consultaId) => { void atualizarItem(i.id, { consulta_id: consultaId }).then(trocarItem) })}
                  />
                ))}
              </div>
            )
          })}

          {/* Totais */}
          {doPlano.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', padding: '6px 4px' }}>
              {t.convenio > 0 && <div style={{ fontSize: 13, color: '#3B5BDB', fontWeight: 600 }}>{t.convenio} procedimento(s) pelo convênio</div>}
              <div style={{ fontSize: 13, color: '#3A5560' }}>Particular: <strong>{formatarReais(t.particular)}</strong></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#3A5560' }}>
                Desconto:
                {editavel ? (
                  <input key={`d${plano.desconto}`} defaultValue={plano.desconto ? formatarReais(plano.desconto) : ''} placeholder="R$ 0,00" inputMode="decimal"
                    onBlur={(e) => { const v = lerReais(e.target.value) ?? 0; if (v !== plano.desconto) void acao(async () => trocarPlano(await atualizarPlano(plano.id, { desconto: v }))) }}
                    style={{ ...campo, width: 110 }} />
                ) : <strong>{formatarReais(plano.desconto)}</strong>}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#16232B' }}>Total particular: {formatarReais(t.total)}</div>
            </div>
          )}

          {/* Validade e observações */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#6B818C' }}>
              Válido até
              <input type="date" disabled={!editavel} value={plano.validade ?? ''}
                onChange={(e) => void acao(async () => trocarPlano(await atualizarPlano(plano.id, { validade: e.target.value || null })))}
                style={campo} />
            </label>
            <textarea key={`o${plano.id}`} disabled={!editavel} defaultValue={plano.observacoes ?? ''} rows={2}
              placeholder="Observações para o paciente (aparecem no link). Ex.: pagamento em até 6x sem juros."
              onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== plano.observacoes) void acao(async () => trocarPlano(await atualizarPlano(plano.id, { observacoes: v }))) }}
              style={{ ...campo, flex: 1, minWidth: 240, resize: 'vertical' }} />
          </div>
        </div>
      )}
    </div>
  )
}

function LinhaItem({ item, editavel, servicos, convenioDaFicha, convenioNomes, podeAgendar, ocupado, onServico, onCobertura, onValor, onEtapa, onApagar, onAgendar }: {
  item: ItemPlano
  editavel: boolean
  servicos: ServicoPlano[]
  convenioDaFicha: string | null
  convenioNomes: Map<string, string>
  podeAgendar: boolean
  ocupado: boolean
  onServico: (id: string) => void
  onCobertura: (v: string) => void
  onValor: (v: number) => void
  onEtapa: (e: number) => void
  onApagar: () => void
  onAgendar: () => void
}) {
  const onde = item.dente ? `${item.dente}${item.faces.length ? ' ' + item.faces.join('') : ''}` : '—'
  const nomeConv = item.convenio_id ? convenioNomes.get(item.convenio_id) ?? 'Convênio' : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid #EDF2F4', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#3A5560', minWidth: 52 }}>{onde}</span>

      <div style={{ flex: 1, minWidth: 180 }}>
        {editavel ? (
          <select value={item.servico_id ?? ''} onChange={(e) => onServico(e.target.value)} disabled={ocupado} style={{ ...campo, width: '100%' }}>
            {!item.servico_id && <option value="">{item.procedimento}</option>}
            {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#16232B' }}>{item.procedimento}</span>
        )}
        {item.observacao && <div style={{ fontSize: 11.5, color: '#6B818C', marginTop: 2 }}>{item.observacao}</div>}
      </div>

      {/* Cobertura, valor e status andam juntos: no celular descem como um bloco só. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginLeft: 'auto', justifyContent: 'flex-end' }}>

      {editavel ? (
        <select value={item.cobertura === 'convenio' ? item.convenio_id ?? '' : 'particular'} onChange={(e) => onCobertura(e.target.value)} disabled={ocupado} style={campo}>
          <option value="particular">Particular</option>
          {(convenioDaFicha || item.convenio_id) && (
            <option value={(item.convenio_id ?? convenioDaFicha)!}>Convênio {convenioNomes.get((item.convenio_id ?? convenioDaFicha)!) ?? ''}</option>
          )}
        </select>
      ) : (
        <span style={{ fontSize: 12, fontWeight: 600, color: item.cobertura === 'convenio' ? '#3B5BDB' : '#3A5560' }}>
          {item.cobertura === 'convenio' ? `Convênio ${nomeConv ?? ''}` : 'Particular'}
        </span>
      )}

      <span style={{ textAlign: 'right' }}>
        {item.cobertura === 'convenio' ? (
          <span style={{ fontSize: 12.5, color: '#3B5BDB' }}>coberto</span>
        ) : editavel ? (
          <input key={`${item.id}:${item.valor}`} defaultValue={formatarReais(item.valor)} inputMode="decimal"
            onBlur={(e) => { const v = lerReais(e.target.value); if (v !== null && v !== item.valor) onValor(v) }}
            style={{ ...campo, width: 96, textAlign: 'right' }} />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: '#16232B' }}>{formatarReais(item.valor)}</span>
        )}
      </span>

      {editavel ? (
        <>
          <select value={item.etapa} onChange={(e) => onEtapa(Number(e.target.value))} disabled={ocupado} style={campo} title="Etapa">
            {ETAPAS.map((e) => <option key={e.numero} value={e.numero}>Etapa {e.numero}</option>)}
          </select>
          <button title="Tirar do plano" onClick={onApagar} disabled={ocupado} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 3 }}><Trash2 size={14} /></button>
        </>
      ) : (
        <>
          <Pilula {...STATUS_ITEM[item.status]} />
          {item.consulta_id && item.status === 'aprovado' && <Pilula nome="Agendado" cor={MARCA} fundo={MARCA_SUAVE} />}
          {podeAgendar && item.status === 'aprovado' && !item.consulta_id && item.servico_id && (
            <button onClick={onAgendar} style={botao(MARCA)}><CalendarPlus size={13} /> Agendar</button>
          )}
        </>
      )}
      </div>
    </div>
  )
}
