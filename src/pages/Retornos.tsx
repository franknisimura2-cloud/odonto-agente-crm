import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { MARCA, MARCA_SUAVE } from '../lib/marca'

/**
 * Os retornos (rota /retornos, migração 0043) — a roda da fidelização.
 *
 * Quem fez a limpeza ganha a data do próximo retorno, sozinha. Esta página
 * mostra a carteira por essa data: quem já está marcado, quem vence nos
 * próximos 30 dias, quem passou do prazo. O número de cima é o que importa: a
 * fração da carteira que está EM DIA (marcada ou dentro do prazo).
 */

const FONTE = "'Plus Jakarta Sans', sans-serif"

type Grupo = 'vencidos' | 'proximos' | 'adiante' | 'marcados'

interface Linha {
  id: string
  nome: string | null
  proximo_retorno: string
  retorno_servico: string | null
  convenio_nome: string | null
  forma_pagamento: string | null
  marcadoEm: string | null
  chamadas: number
  ultimaChamada: string | null
}

const GRUPOS: { chave: Grupo; nome: string; cor: string; fundo: string }[] = [
  { chave: 'vencidos', nome: 'Passaram do prazo', cor: '#DC2626', fundo: '#FEF2F2' },
  { chave: 'proximos', nome: 'Próximos 30 dias', cor: '#B45309', fundo: '#FFFBEB' },
  { chave: 'marcados', nome: 'Já marcados', cor: '#1A7A48', fundo: '#E8F8EF' },
  { chave: 'adiante', nome: 'Mais adiante', cor: '#6B818C', fundo: '#F2F6F7' },
]

function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function diasEntre(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86_400_000)
}

const dataBR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export default function Retornos() {
  const navigate = useNavigate()
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [grupo, setGrupo] = useState<Grupo>('vencidos')

  useEffect(() => {
    Promise.all([
      supabase.from('crm_clinica').select('id, nome_lead, proximo_retorno, retorno_servico, convenio_nome, forma_pagamento')
        .not('proximo_retorno', 'is', null).order('proximo_retorno'),
      supabase.from('consultas').select('lead_id, data_consulta').eq('status', 'agendada')
        .gt('data_consulta', new Date().toISOString()).order('data_consulta'),
      supabase.from('agente_retornos').select('lead_id, para_data, enviado_em'),
    ]).then(([l, c, a]) => {
      const marcada = new Map<string, string>()
      for (const x of (c.data ?? []) as { lead_id: string; data_consulta: string }[]) {
        if (!marcada.has(x.lead_id)) marcada.set(x.lead_id, x.data_consulta)
      }
      const chamadas = (a.data ?? []) as { lead_id: string; para_data: string; enviado_em: string }[]
      setLinhas(((l.data ?? []) as { id: string; nome_lead: string | null; proximo_retorno: string; retorno_servico: string | null; convenio_nome: string | null; forma_pagamento: string | null }[]).map((p) => {
        const minhas = chamadas.filter((x) => x.lead_id === p.id && x.para_data === p.proximo_retorno)
        return {
          id: p.id, nome: p.nome_lead, proximo_retorno: p.proximo_retorno, retorno_servico: p.retorno_servico,
          convenio_nome: p.convenio_nome, forma_pagamento: p.forma_pagamento,
          marcadoEm: marcada.get(p.id) ?? null,
          chamadas: minhas.length,
          ultimaChamada: minhas.map((x) => x.enviado_em).sort().pop() ?? null,
        }
      }))
      setCarregando(false)
    })
  }, [])

  const hoje = hojeISO()
  const grupoDe = (l: Linha): Grupo => {
    if (l.marcadoEm) return 'marcados'
    const d = diasEntre(hoje, l.proximo_retorno)
    if (d < 0) return 'vencidos'
    if (d <= 30) return 'proximos'
    return 'adiante'
  }

  const porGrupo = useMemo(() => {
    const m: Record<Grupo, Linha[]> = { vencidos: [], proximos: [], adiante: [], marcados: [] }
    for (const l of linhas) m[grupoDe(l)].push(l)
    return m
  }, [linhas]) // eslint-disable-line react-hooks/exhaustive-deps

  const emDia = linhas.length ? Math.round(((linhas.length - porGrupo.vencidos.length) / linhas.length) * 100) : 0

  if (carregando) return <div style={{ padding: 40, textAlign: 'center', color: '#6B818C' }}>Carregando...</div>

  const visiveis = porGrupo[grupo]

  return (
    <div className="pagina" style={{ padding: '32px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <div className="fade-in-1" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: MARCA_SUAVE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarClock size={18} style={{ color: MARCA }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#16232B', margin: 0 }}>Retornos</h1>
        </div>
        <p style={{ fontSize: 13, color: '#6B818C', marginTop: 8, lineHeight: 1.6 }}>
          Quem fez a limpeza ganha a data do próximo retorno sozinho. Aqui está a carteira por essa data —
          e, com o retorno ligado na tela Atendente de IA, a Letícia chama quem está chegando no prazo.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Numero rotulo="Carteira em dia" valor={`${emDia}%`} destaque />
        <Numero rotulo="Com retorno previsto" valor={String(linhas.length)} />
        <Numero rotulo="Já marcados" valor={String(porGrupo.marcados.length)} />
        <Numero rotulo="Passaram do prazo" valor={String(porGrupo.vencidos.length)} />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {GRUPOS.map((g) => {
          const ativo = grupo === g.chave
          return (
            <button key={g.chave} onClick={() => setGrupo(g.chave)}
              style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${ativo ? g.cor : '#DCE6EA'}`, background: ativo ? g.fundo : '#fff', color: ativo ? g.cor : '#6B818C', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONTE }}>
              {g.nome} ({porGrupo[g.chave].length})
            </button>
          )
        })}
      </div>

      {visiveis.length === 0 ? (
        <div className="cartao" style={{ background: '#fff', borderRadius: 14, border: '1px dashed #C9D8DE', padding: '28px 22px', textAlign: 'center', color: '#6B818C', fontSize: 13.5, lineHeight: 1.6 }}>
          {linhas.length === 0
            ? 'Ninguém com retorno previsto ainda. A data aparece quando uma limpeza recebe baixa "compareceu" (o serviço precisa ter o retorno marcado em Serviços).'
            : 'Ninguém neste grupo.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visiveis.map((l) => {
            const d = diasEntre(hoje, l.proximo_retorno)
            const quando = l.marcadoEm
              ? `Marcado para ${new Date(l.marcadoEm).toLocaleDateString('pt-BR')}`
              : d < 0 ? `Venceu há ${-d} dia(s) — ${dataBR(l.proximo_retorno)}`
              : d === 0 ? 'Vence hoje'
              : `Vence em ${d} dia(s) — ${dataBR(l.proximo_retorno)}`
            return (
              <button key={l.id} onClick={() => navigate(`/leads/${l.id}`)} className="cartao"
                style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', textAlign: 'left', background: '#fff', border: '1px solid #DCE6EA', borderRadius: 12, padding: '12px 16px', cursor: 'pointer', fontFamily: FONTE }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#16232B' }}>{l.nome ?? 'Sem nome'}</div>
                  <div style={{ fontSize: 12, color: '#6B818C', marginTop: 2 }}>
                    {l.retorno_servico ?? 'Retorno'}
                    {l.forma_pagamento === 'convenio' && l.convenio_nome && ` · convênio ${l.convenio_nome}`}
                    {l.chamadas > 0 && l.ultimaChamada && ` · a Letícia chamou ${l.chamadas}x (última em ${new Date(l.ultimaChamada).toLocaleDateString('pt-BR')})`}
                  </div>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: GRUPOS.find((g) => g.chave === grupoDe(l))!.cor, whiteSpace: 'nowrap' }}>{quando}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Numero({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="cartao" style={{ background: destaque ? MARCA_SUAVE : '#fff', border: '1px solid #DCE6EA', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, color: '#6B818C' }}>{rotulo}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: destaque ? MARCA : '#16232B', marginTop: 4 }}>{valor}</div>
    </div>
  )
}
