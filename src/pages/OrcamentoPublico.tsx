import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { formatarReais } from '../lib/procedimentos'
import { lerPlanoPublico, aprovarPlanoPublico, nomeDaEtapa, ETAPAS, type PlanoPublico } from '../lib/planos'
import { MARCA, MARCA_SUAVE } from '../lib/marca'

/**
 * O plano de tratamento visto pelo PACIENTE (rota /orcamento/:token, sem login).
 *
 * Tudo vem por duas funções do banco (migração 0041) que só respondem ao token
 * certo e a plano já apresentado: `plano_publico` (o primeiro nome, a clínica,
 * as etapas e os valores — nada de telefone nem ficha) e `plano_aprovar` (as
 * etapas escolhidas). A página não enxerga tabela nenhuma.
 *
 * Escrita para quem nunca viu um orçamento de dentista: etapa por etapa, o que
 * o convênio cobre em azul, o que é particular com o valor, e o total no fim.
 */

const FONTE = "'Plus Jakarta Sans', sans-serif"

export default function OrcamentoPublico() {
  const { token = '' } = useParams<{ token: string }>()
  const [plano, setPlano] = useState<PlanoPublico | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'nao_achou' | 'erro'>('carregando')
  const [escolhidas, setEscolhidas] = useState<Set<number>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [aprovou, setAprovou] = useState(false)

  const carregar = () => lerPlanoPublico(token)
    .then((p) => {
      if (!p) { setEstado('nao_achou'); return }
      setPlano(p); setEstado('pronto')
      // Na PRIMEIRA vez, tudo vem marcado: quem abre para aprovar só confere.
      // Depois de uma aprovação parcial, o que sobrou vem desmarcado — senão um
      // toque distraído aprovaria a etapa que a pessoa deixou de fora.
      setEscolhidas(p.status === 'apresentado'
        ? new Set(p.itens.filter((i) => i.status === 'pendente').map((i) => i.etapa))
        : new Set())
    })
    .catch(() => setEstado('erro'))

  useEffect(() => { void carregar() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  async function aprovar() {
    if (!escolhidas.size) { setErro('Escolha pelo menos uma etapa.'); return }
    setEnviando(true); setErro('')
    try {
      await aprovarPlanoPublico(token, [...escolhidas])
      setAprovou(true)
      await carregar()
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? '')
      setErro(m.includes('vencido') ? 'Este orçamento passou da validade. Fale com a clínica para atualizá-lo.'
        : m.includes('decidido') ? 'Este plano já foi respondido.'
        : 'Não consegui registrar agora. Tente de novo em instantes.')
    } finally {
      setEnviando(false)
    }
  }

  if (estado === 'carregando') return <Tela><p style={{ color: '#6B818C', textAlign: 'center' }}>Carregando o seu plano...</p></Tela>
  if (estado === 'nao_achou') return <Tela><p style={{ color: '#3A5560', textAlign: 'center', lineHeight: 1.6 }}>Não encontrei este plano. O link pode estar incompleto — peça à clínica para enviar de novo.</p></Tela>
  if (estado === 'erro' || !plano) return <Tela><p style={{ color: '#3A5560', textAlign: 'center' }}>Não consegui abrir agora. Tente de novo em instantes.</p></Tela>

  const etapas = [...new Set(plano.itens.map((i) => i.etapa))].sort()
  const validos = plano.itens.filter((i) => i.status !== 'recusado')
  const particular = validos.filter((i) => i.cobertura === 'particular').reduce((s, i) => s + Number(i.valor), 0)
  const peloConvenio = validos.filter((i) => i.cobertura === 'convenio')
  const convenio = peloConvenio.find((i) => i.convenio)?.convenio
  const podeAprovar = ['apresentado', 'parcial'].includes(plano.status) && !plano.vencido && plano.itens.some((i) => i.status === 'pendente')
  const decidido = ['aprovado', 'concluido'].includes(plano.status)

  return (
    <Tela clinica={plano.clinica}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#16232B', margin: '0 0 6px' }}>
        {plano.paciente ? `Olá, ${plano.paciente}!` : 'Olá!'}
      </h1>
      <p style={{ fontSize: 14.5, color: '#3A5560', lineHeight: 1.6, margin: '0 0 18px' }}>
        Este é o seu plano de tratamento, dividido em etapas: primeiro o que cuida da saúde da boca,
        depois o que reconstrói e, por fim, a estética. Você pode aprovar tudo ou só as etapas que quiser começar.
      </p>

      {aprovou && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#E8F8EF', border: '1px solid #A7D8C0', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
          <CheckCircle2 size={20} color="#1A7A48" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 14, color: '#1A7A48', lineHeight: 1.5 }}><strong>Recebemos a sua aprovação!</strong> A clínica vai falar com você para marcar os horários.</div>
        </div>
      )}
      {!aprovou && decidido && (
        <div style={{ background: '#E8F8EF', border: '1px solid #A7D8C0', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 14, color: '#1A7A48' }}>
          Este plano já está aprovado. {plano.status === 'concluido' ? 'Tratamento concluído 🎉' : 'A clínica vai falar com você para marcar os horários.'}
        </div>
      )}
      {plano.vencido && ['apresentado', 'parcial'].includes(plano.status) && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 14, color: '#B45309' }}>
          Este orçamento passou da validade. Fale com a clínica para atualizá-lo.
        </div>
      )}

      {etapas.map((etapa) => {
        const itens = plano.itens.filter((i) => i.etapa === etapa)
        const pendente = itens.some((i) => i.status === 'pendente')
        const aprovada = itens.every((i) => ['aprovado', 'feito'].includes(i.status))
        const sub = itens.filter((i) => i.cobertura === 'particular' && i.status !== 'recusado').reduce((s, i) => s + Number(i.valor), 0)
        const marcada = escolhidas.has(etapa)
        return (
          <div key={etapa} style={{ background: '#fff', border: `2px solid ${podeAprovar && pendente && marcada ? MARCA : '#DCE6EA'}`, borderRadius: 14, marginBottom: 12, overflow: 'hidden' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#F7FAFB', cursor: podeAprovar && pendente ? 'pointer' : 'default' }}>
              {podeAprovar && pendente && (
                <input type="checkbox" checked={marcada}
                  onChange={() => setEscolhidas((prev) => { const n = new Set(prev); if (n.has(etapa)) n.delete(etapa); else n.add(etapa); return n })}
                  style={{ width: 20, height: 20, accentColor: MARCA }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#16232B' }}>Etapa {etapa} · {nomeDaEtapa(etapa)}</div>
                {ETAPAS.find((e) => e.numero === etapa)?.explica && (
                  <div style={{ fontSize: 12.5, color: '#6B818C' }}>{ETAPAS.find((e) => e.numero === etapa)?.explica}</div>
                )}
              </div>
              {aprovada && <span style={{ fontSize: 12, fontWeight: 700, color: '#1A7A48' }}>✓ Aprovada</span>}
            </label>
            {itens.map((i) => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: '1px solid #EDF2F4', opacity: i.status === 'recusado' ? 0.5 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#16232B' }}>{i.procedimento}</div>
                  {i.dente && <div style={{ fontSize: 12.5, color: '#6B818C' }}>Dente {i.dente}{i.faces.length ? ` · faces ${i.faces.join('')}` : ''}</div>}
                </div>
                {i.cobertura === 'convenio' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, color: '#3B5BDB', background: '#EEF4FF', borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                    <ShieldCheck size={13} /> Convênio
                  </span>
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#16232B', whiteSpace: 'nowrap' }}>{formatarReais(Number(i.valor))}</span>
                )}
              </div>
            ))}
            {sub > 0 && (
              <div style={{ padding: '9px 14px', borderTop: '1px solid #EDF2F4', fontSize: 13, color: '#3A5560', textAlign: 'right' }}>
                Nesta etapa: <strong>{formatarReais(sub)}</strong>
              </div>
            )}
          </div>
        )
      })}

      <div style={{ background: '#fff', border: '1px solid #DCE6EA', borderRadius: 14, padding: '14px 16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {peloConvenio.length > 0 && (
          <div style={{ fontSize: 14, color: '#3B5BDB' }}><strong>{peloConvenio.length}</strong> procedimento(s) cobertos pelo seu convênio{convenio ? ` ${convenio}` : ''}</div>
        )}
        <div style={{ fontSize: 14, color: '#3A5560' }}>Particular: {formatarReais(particular)}</div>
        {Number(plano.desconto) > 0 && <div style={{ fontSize: 14, color: '#1A7A48' }}>Desconto: − {formatarReais(Number(plano.desconto))}</div>}
        <div style={{ fontSize: 18, fontWeight: 800, color: '#16232B' }}>Total: {formatarReais(Math.max(0, particular - Number(plano.desconto)))}</div>
        {plano.validade && <div style={{ fontSize: 12.5, color: '#6B818C' }}>Válido até {plano.validade.split('-').reverse().join('/')}</div>}
      </div>

      {plano.observacoes && (
        <div style={{ background: MARCA_SUAVE, borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#3A5560', lineHeight: 1.6, marginBottom: 16, whiteSpace: 'pre-wrap' }}>{plano.observacoes}</div>
      )}

      {erro && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#DC2626', marginBottom: 12 }}>{erro}</div>}

      {podeAprovar && (
        <button onClick={aprovar} disabled={enviando || !escolhidas.size}
          style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: escolhidas.size ? MARCA : '#B8CBD3', color: '#fff', fontSize: 16, fontWeight: 700, fontFamily: FONTE, cursor: enviando ? 'wait' : 'pointer' }}>
          {enviando ? 'Registrando...' : escolhidas.size === etapas.length ? 'Aprovar o plano' : `Aprovar ${escolhidas.size === 1 ? 'a etapa escolhida' : 'as etapas escolhidas'}`}
        </button>
      )}
      <p style={{ fontSize: 12.5, color: '#6B818C', textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
        Ficou com alguma dúvida? É só responder a mensagem da clínica no WhatsApp.
      </p>
    </Tela>
  )
}

function Tela({ clinica, children }: { clinica?: string | null; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#F2F6F7', fontFamily: FONTE }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #DCE6EA', padding: '14px 16px', textAlign: 'center', fontSize: 15, fontWeight: 800, color: MARCA }}>
        {clinica || 'Plano de tratamento'}
      </div>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px 32px' }}>{children}</div>
    </div>
  )
}
