import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatarReais } from '../lib/procedimentos'
import { STATUS_PLANO, type StatusPlano } from '../lib/planos'
import { MARCA, MARCA_SUAVE } from '../lib/marca'

/**
 * Os planos de tratamento da clínica (rota /planos, migração 0041).
 *
 * É o funil da conversão: quantos planos foram apresentados, quantos viraram
 * aprovação e quanto de particular isso representa. Clicar abre a ficha da
 * pessoa, onde o plano mora.
 *
 * Não é coluna do Kanban de propósito: quem recebe plano já passou pela
 * avaliação e costuma estar em Clientes — mover o status da pessoa para
 * "plano apresentado" a tiraria de lá.
 */

const FONTE = "'Plus Jakarta Sans', sans-serif"

interface Linha {
  id: string
  lead_id: string
  status: StatusPlano
  created_at: string
  apresentado_em: string | null
  desconto: number
  nome: string | null
  particular: number
  aprovado: number
  convenio: number
}

const FILTROS: (StatusPlano | 'todos')[] = ['todos', 'rascunho', 'apresentado', 'parcial', 'aprovado', 'concluido', 'recusado']

export default function Planos() {
  const navigate = useNavigate()
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<StatusPlano | 'todos'>('todos')

  useEffect(() => {
    Promise.all([
      supabase.from('planos_tratamento').select('id, lead_id, status, created_at, apresentado_em, desconto, lead:crm_clinica_dados(nome_lead)').order('created_at', { ascending: false }),
      supabase.from('plano_itens').select('plano_id, cobertura, valor, status'),
    ]).then(([p, i]) => {
      const itens = (i.data ?? []) as { plano_id: string; cobertura: string; valor: number; status: string }[]
      setLinhas(((p.data ?? []) as unknown as (Omit<Linha, 'nome' | 'particular' | 'aprovado' | 'convenio'> & { lead: { nome_lead: string | null } | null })[]).map((x) => {
        const doPlano = itens.filter((it) => it.plano_id === x.id && it.status !== 'recusado')
        const part = doPlano.filter((it) => it.cobertura === 'particular')
        return {
          ...x,
          desconto: Number(x.desconto),
          nome: x.lead?.nome_lead ?? null,
          particular: part.reduce((s, it) => s + Number(it.valor), 0),
          aprovado: part.filter((it) => ['aprovado', 'feito'].includes(it.status)).reduce((s, it) => s + Number(it.valor), 0),
          convenio: doPlano.filter((it) => it.cobertura === 'convenio').length,
        }
      }))
      setCarregando(false)
    })
  }, [])

  const visiveis = filtro === 'todos' ? linhas : linhas.filter((l) => l.status === filtro)

  // A conversão: dos planos que o paciente viu, quantos viraram "sim".
  const numeros = useMemo(() => {
    const vistos = linhas.filter((l) => l.status !== 'rascunho')
    const sim = vistos.filter((l) => ['parcial', 'aprovado', 'concluido'].includes(l.status))
    return {
      vistos: vistos.length,
      sim: sim.length,
      taxa: vistos.length ? Math.round((sim.length / vistos.length) * 100) : 0,
      aprovado: sim.reduce((s, l) => s + l.aprovado, 0),
      emAberto: linhas.filter((l) => ['apresentado', 'parcial'].includes(l.status)).reduce((s, l) => s + (l.particular - l.aprovado), 0),
    }
  }, [linhas])

  if (carregando) return <div style={{ padding: 40, textAlign: 'center', color: '#6B818C' }}>Carregando...</div>

  return (
    <div className="pagina" style={{ padding: '32px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <div className="fade-in-1" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: MARCA_SUAVE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={18} style={{ color: MARCA }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#16232B', margin: 0 }}>Planos de tratamento</h1>
        </div>
        <p style={{ fontSize: 13, color: '#6B818C', marginTop: 8, lineHeight: 1.6 }}>
          O plano nasce do odontograma, na ficha de cada paciente. Aqui você acompanha quantos foram
          apresentados, quantos viraram aprovação e quanto está em aberto.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Numero rotulo="Apresentados" valor={String(numeros.vistos)} />
        <Numero rotulo="Aprovados (total ou parte)" valor={`${numeros.sim} · ${numeros.taxa}%`} />
        <Numero rotulo="Particular aprovado" valor={formatarReais(numeros.aprovado)} />
        <Numero rotulo="Particular em aberto" valor={formatarReais(numeros.emAberto)} />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {FILTROS.map((f) => {
          const ativo = filtro === f
          const qtd = f === 'todos' ? linhas.length : linhas.filter((l) => l.status === f).length
          return (
            <button key={f} onClick={() => setFiltro(f)}
              style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${ativo ? MARCA : '#DCE6EA'}`, background: ativo ? MARCA_SUAVE : '#fff', color: ativo ? MARCA : '#6B818C', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONTE }}>
              {f === 'todos' ? 'Todos' : STATUS_PLANO[f].nome} ({qtd})
            </button>
          )
        })}
      </div>

      {visiveis.length === 0 ? (
        <div className="cartao" style={{ background: '#fff', borderRadius: 14, border: '1px dashed #C9D8DE', padding: '28px 22px', textAlign: 'center', color: '#6B818C', fontSize: 13.5 }}>
          Nenhum plano {filtro === 'todos' ? 'ainda' : 'com este status'}. Os planos são criados na ficha do paciente, a partir do odontograma.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visiveis.map((l) => (
            <button key={l.id} onClick={() => navigate(`/leads/${l.lead_id}`)} className="cartao"
              style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', textAlign: 'left', background: '#fff', border: '1px solid #DCE6EA', borderRadius: 12, padding: '12px 16px', cursor: 'pointer', fontFamily: FONTE }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: '#16232B' }}>{l.nome ?? 'Sem nome'}</div>
                <div style={{ fontSize: 12, color: '#6B818C', marginTop: 2 }}>
                  Criado em {new Date(l.created_at).toLocaleDateString('pt-BR')}
                  {l.apresentado_em && ` · apresentado em ${new Date(l.apresentado_em).toLocaleDateString('pt-BR')}`}
                  {l.convenio > 0 && ` · ${l.convenio} pelo convênio`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#16232B' }}>{formatarReais(Math.max(0, l.particular - l.desconto))}</div>
                {l.aprovado > 0 && l.aprovado < l.particular && <div style={{ fontSize: 11.5, color: '#1A7A48' }}>{formatarReais(l.aprovado)} aprovado</div>}
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, color: STATUS_PLANO[l.status].cor, background: STATUS_PLANO[l.status].fundo, whiteSpace: 'nowrap' }}>
                {STATUS_PLANO[l.status].nome}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="cartao" style={{ background: '#fff', border: '1px solid #DCE6EA', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, color: '#6B818C' }}>{rotulo}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#16232B', marginTop: 4 }}>{valor}</div>
    </div>
  )
}
