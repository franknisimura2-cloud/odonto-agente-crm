import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatarReais } from '../lib/procedimentos'
import { MARCA, MARCA_SUAVE } from '../lib/marca'

/**
 * A roda da clínica odontológica, no Dashboard (migração 0045).
 *
 *   entrada → avaliação (odontograma) → plano apresentado → aprovado → retorno
 *
 * O FUNIL É UMA SÉRIE SÓ: barras horizontais de uma cor, do tamanho da
 * entrada, com o número e a passagem de uma etapa para a outra em texto (nunca
 * na cor da barra). Não tem legenda — o título diz o que é. O dinheiro vem em
 * cartões de número, e só para quem tem Valores (o banco manda nulo para os
 * outros). A conta por convênio é tabela: são números para ler, não formas
 * para comparar de relance.
 */

const FONTE = "'Plus Jakarta Sans', sans-serif"
const TEXTO = '#16232B'
const TEXTO_2 = '#3A5560'
const TEXTO_3 = '#6B818C'

interface Roda {
  entrada: number
  entrada_convenio: number
  entrada_particular: number
  avaliados: number
  planos_apresentados: number
  planos_aprovados: number
  planos_convenio: number
  convertidos: number
  particular_apresentado: number | null
  particular_aprovado: number | null
  ticket_medio: number | null
  carteira_retorno: number
  carteira_em_dia: number
  retornos_realizados: number
}

interface LinhaConvenio {
  convenio: string
  pacientes: number
  novos: number
  planos_apresentados: number
  planos_aprovados: number
  particular_aprovado: number | null
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null)

export default function PainelRoda({ inicio, fim, pequena }: { inicio: string; fim: string; pequena: boolean }) {
  const [roda, setRoda] = useState<Roda | null>(null)
  const [convenios, setConvenios] = useState<LinhaConvenio[]>([])
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    const p = { p_inicio: inicio, p_fim: fim }
    void Promise.all([
      supabase.rpc('dashboard_roda', p),
      supabase.rpc('dashboard_roda_convenios', p),
    ]).then(([r, c]) => {
      if (!vivo) return
      // Instalação sem as migrações da roda (clínica não odontológica): o
      // painel some em vez de mostrar erro.
      if (r.error || !r.data) { setErro(true); return }
      const d = r.data as Record<string, number | string | null>
      const n = (k: string) => Number(d[k] ?? 0)
      const v = (k: string) => (d[k] === null || d[k] === undefined ? null : Number(d[k]))
      setRoda({
        entrada: n('entrada'), entrada_convenio: n('entrada_convenio'), entrada_particular: n('entrada_particular'),
        avaliados: n('avaliados'), planos_apresentados: n('planos_apresentados'), planos_aprovados: n('planos_aprovados'),
        planos_convenio: n('planos_convenio'), convertidos: n('convertidos'),
        particular_apresentado: v('particular_apresentado'), particular_aprovado: v('particular_aprovado'), ticket_medio: v('ticket_medio'),
        carteira_retorno: n('carteira_retorno'), carteira_em_dia: n('carteira_em_dia'), retornos_realizados: n('retornos_realizados'),
      })
      setConvenios(((c.data ?? []) as LinhaConvenio[]).map((x) => ({
        ...x,
        pacientes: Number(x.pacientes), novos: Number(x.novos),
        planos_apresentados: Number(x.planos_apresentados), planos_aprovados: Number(x.planos_aprovados),
        particular_aprovado: x.particular_aprovado === null ? null : Number(x.particular_aprovado),
      })))
      setErro(false)
    })
    return () => { vivo = false }
  }, [inicio, fim])

  if (erro || !roda) return null

  const etapas = [
    { nome: 'Entrada', valor: roda.entrada, detalhe: `${roda.entrada_convenio} por convênio · ${roda.entrada_particular} particular` },
    { nome: 'Avaliados (odontograma)', valor: roda.avaliados, detalhe: 'Pessoas que ganharam odontograma no período' },
    { nome: 'Plano apresentado', valor: roda.planos_apresentados, detalhe: `${roda.planos_convenio} de paciente de convênio` },
    { nome: 'Plano aprovado', valor: roda.planos_aprovados, detalhe: 'Inteiro ou em parte' },
  ]
  const topo = Math.max(1, ...etapas.map((e) => e.valor))
  const veValores = roda.particular_aprovado !== null
  const emDia = pct(roda.carteira_em_dia, roda.carteira_retorno)

  return (
    <div className="cartao" style={{ background: '#fff', borderRadius: 14, border: '1px solid #DCE6EA', padding: pequena ? 16 : '22px 26px', marginBottom: pequena ? 16 : 24, fontFamily: FONTE }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <RefreshCw size={16} style={{ color: MARCA }} />
        <span style={{ fontSize: 15, fontWeight: 800, color: TEXTO }}>A roda da clínica</span>
      </div>
      <p style={{ fontSize: 12.5, color: TEXTO_3, margin: '0 0 18px', lineHeight: 1.55 }}>
        Do convênio que traz o paciente ao plano que ele aprova — no período escolhido acima.
      </p>

      {/* O funil: uma série, uma cor; os números e as passagens em texto. */}
      <div role="table" aria-label="Funil da roda" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {etapas.map((e, i) => {
          const passagem = i > 0 ? pct(e.valor, etapas[i - 1].valor) : null
          const largura = Math.max(e.valor > 0 ? 2 : 0, (e.valor / topo) * 100)
          return (
            <div key={e.nome} role="row" title={`${e.nome}: ${e.valor}${passagem !== null ? ` (${passagem}% da etapa anterior)` : ''}`}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                <span role="cell" style={{ fontSize: 13, fontWeight: 600, color: TEXTO_2 }}>{e.nome}</span>
                <span role="cell" style={{ fontSize: 12, color: TEXTO_3, whiteSpace: 'nowrap' }}>
                  {passagem !== null && <>{passagem}% da etapa anterior · </>}
                  <strong style={{ fontSize: 15, color: TEXTO }}>{e.valor}</strong>
                </span>
              </div>
              <div style={{ height: 10, background: '#EEF3F5', borderRadius: 4 }}>
                <div style={{ height: 10, width: `${largura}%`, background: MARCA, borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
              <div style={{ fontSize: 11.5, color: TEXTO_3, marginTop: 4 }}>{e.detalhe}</div>
            </div>
          )
        })}
      </div>

      {/* Os números que o funil não mostra */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${pequena ? 140 : 170}px, 1fr))`, gap: 10, marginTop: 20 }}>
        <Numero rotulo="Convênio → particular"
          valor={String(roda.convertidos)}
          nota={roda.planos_convenio ? `${pct(roda.convertidos, roda.planos_convenio)}% dos planos de convênio` : 'Planos de convênio que aprovaram particular'} />
        {veValores && <Numero rotulo="Particular aprovado" valor={formatarReais(roda.particular_aprovado ?? 0)}
          nota={roda.particular_apresentado ? `de ${formatarReais(roda.particular_apresentado)} apresentados` : undefined} />}
        {veValores && <Numero rotulo="Ticket médio aprovado" valor={roda.ticket_medio !== null ? formatarReais(roda.ticket_medio) : '—'} nota="Por plano aprovado" />}
        <Numero rotulo="Carteira em dia (retorno)" valor={emDia !== null ? `${emDia}%` : '—'}
          nota={`${roda.carteira_em_dia} de ${roda.carteira_retorno} · ${roda.retornos_realizados} retorno(s) feitos no período`} />
      </div>

      {/* Por convênio — tabela */}
      {convenios.length > 0 && (
        <div style={{ marginTop: 20, overflowX: 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXTO, marginBottom: 8 }}>Por convênio</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 460 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #DCE6EA' }}>
                {['', 'Pacientes', 'Novos no período', 'Planos', 'Aprovados', ...(veValores ? ['Particular aprovado'] : [])].map((h) => (
                  <th key={h} style={{ textAlign: h ? 'right' : 'left', padding: '6px 8px', fontWeight: 600, color: TEXTO_3, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {convenios.map((c) => (
                <tr key={c.convenio} style={{ borderBottom: '1px solid #EDF2F4' }}>
                  <td style={{ padding: '8px', fontWeight: 600, color: TEXTO }}>{c.convenio}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: TEXTO_2 }}>{c.pacientes}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: TEXTO_2 }}>{c.novos}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: TEXTO_2 }}>{c.planos_apresentados}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: TEXTO_2 }}>
                    {c.planos_aprovados}{c.planos_apresentados > 0 && <span style={{ color: TEXTO_3 }}> ({pct(c.planos_aprovados, c.planos_apresentados)}%)</span>}
                  </td>
                  {veValores && <td style={{ padding: '8px', textAlign: 'right', color: TEXTO, fontWeight: 600 }}>{formatarReais(c.particular_aprovado ?? 0)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div style={{ background: MARCA_SUAVE, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, color: TEXTO_3 }}>{rotulo}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: TEXTO, marginTop: 3 }}>{valor}</div>
      {nota && <div style={{ fontSize: 11.5, color: TEXTO_3, marginTop: 3, lineHeight: 1.45 }}>{nota}</div>}
    </div>
  )
}
