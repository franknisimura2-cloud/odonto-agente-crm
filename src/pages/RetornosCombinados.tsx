import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { MARCA, MARCA_SUAVE } from '../lib/marca'
import { useAgente, AGENTE_PAGINA } from '../lib/agente'
import { useAcesso } from '../lib/acesso'
import { formatarParaExibicao } from '../lib/telefones'
import {
  todosOsRetornos, cancelarRetorno, quemRespondeu, mensagemDeErro,
  hojeISO, dataBR, type RetornoCombinado,
} from '../lib/retornosCombinados'

/* ──────────────────────────────────────────────
   Retornos combinados (migração 0048)

   Três blocos, na ordem em que pedem atenção:

   · ATRASADOS — passou o dia e não saiu (assistente desligada, a pessoa
     pediu para não ser procurada, conversa assumida). Depois de 14 dias o
     sistema não manda mais sozinho: alguém da equipe decide.
   · PRÓXIMOS — o que vai sair, a começar por hoje.
   · ENVIADOS — os últimos 30 dias, e se a pessoa respondeu.

   Combinar um retorno é na ficha da pessoa: é lá que está o contexto.
────────────────────────────────────────────── */

const FONTE = "'Plus Jakarta Sans', sans-serif"

function Bloco({ titulo, legenda, children, vazio }: { titulo: string; legenda: string; children: React.ReactNode; vazio: boolean }) {
  return (
    <div className="cartao" style={{ background: '#fff', borderRadius: 14, border: '1px solid #DCE6EA', padding: '20px 22px', marginBottom: 16 }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: '#16232B' }}>{titulo}</div>
      <div style={{ fontSize: 12.5, color: '#6B818C', margin: '4px 0 14px' }}>{legenda}</div>
      {vazio ? <div style={{ fontSize: 13, color: '#8AA0AA' }}>Nada por aqui.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
      )}
    </div>
  )
}

function Linha({ r, direita, aoCancelar }: { r: RetornoCombinado; direita?: React.ReactNode; aoCancelar?: () => void }) {
  const nome = r.lead?.nome_lead?.trim() || (r.lead?.whatsapp_lead ? formatarParaExibicao(r.lead.whatsapp_lead) : 'Sem nome')
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '11px 12px', border: '1px solid #EDF2F4', borderRadius: 10, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 84, fontSize: 13.5, fontWeight: 700, color: '#16232B' }}>{dataBR(r.para_data)}</div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <Link to={`/leads/${r.lead_id}`} style={{ fontSize: 13.5, fontWeight: 600, color: MARCA, textDecoration: 'none' }}>{nome}</Link>
        <div style={{ fontSize: 13, color: '#3A5560', marginTop: 3, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{r.motivo}</div>
        {r.texto && (
          <div style={{ fontSize: 12.5, color: '#3A5560', marginTop: 6, padding: '6px 10px', background: '#F1FBF4', borderRadius: 8, lineHeight: 1.45 }}>“{r.texto}”</div>
        )}
        {r.autor?.nome && <div style={{ fontSize: 11.5, color: '#8AA0AA', marginTop: 4 }}>Combinado por {r.autor.nome}</div>}
      </div>
      {direita}
      {aoCancelar && (
        <button onClick={aoCancelar} title="Cancelar este retorno" aria-label="Cancelar este retorno"
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#8AA0AA', padding: 2, display: 'flex' }}>
          <X size={16} />
        </button>
      )}
    </div>
  )
}

function Selo({ texto, cor, fundo }: { texto: string; cor: string; fundo: string }) {
  return <span style={{ fontSize: 11.5, fontWeight: 700, color: cor, background: fundo, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>{texto}</span>
}

export default function RetornosCombinadosPagina() {
  const { nome: nomeAgente } = useAgente()
  const acesso = useAcesso()
  const podeEditar = acesso.pode('pessoas') || acesso.pode('conversas')
  const [lista, setLista] = useState<RetornoCombinado[]>([])
  const [respondeu, setRespondeu] = useState<Set<string>>(new Set())
  const [ligado, setLigado] = useState<boolean | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  // Somar 1 aqui recarrega a lista (depois de cancelar).
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let viva = true
    ;(async () => {
      try {
        const todos = await todosOsRetornos()
        const resp = await quemRespondeu(todos.filter((r) => r.situacao === 'enviado'))
        if (!viva) return
        setLista(todos); setRespondeu(resp); setErro('')
      } catch {
        if (viva) setErro('Não foi possível carregar os retornos. Recarregue a página.')
      }
      if (viva) setCarregando(false)
    })()
    return () => { viva = false }
  }, [versao])

  useEffect(() => {
    supabase.from('configuracoes_agente').select('retornos_combinados_ativo,ativo').limit(1).maybeSingle()
      .then(({ data }) => { if (data) setLigado(Boolean(data.retornos_combinados_ativo && data.ativo)) })
  }, [])

  const hoje = hojeISO()
  const { atrasados, proximos, enviados } = useMemo(() => ({
    atrasados: lista.filter((r) => r.situacao === 'agendado' && r.para_data < hoje),
    proximos: lista.filter((r) => r.situacao === 'agendado' && r.para_data >= hoje),
    enviados: lista.filter((r) => r.situacao === 'enviado').sort((a, b) => (b.enviado_em ?? '').localeCompare(a.enviado_em ?? '')),
  }), [lista, hoje])

  async function cancelar(r: RetornoCombinado) {
    if (!window.confirm(`Cancelar o retorno de ${dataBR(r.para_data)}?`)) return
    try { await cancelarRetorno(r.id); setVersao((v) => v + 1) } catch (e) { setErro(mensagemDeErro(e)) }
  }

  return (
    <div className="pagina" style={{ padding: '32px 36px', maxWidth: 1000, margin: '0 auto', fontFamily: FONTE }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: MARCA_SUAVE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CalendarClock size={19} style={{ color: MARCA }} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#16232B', margin: 0 }}>Retornos combinados</h1>
      </div>
      <p style={{ fontSize: 13.5, color: '#3A5560', margin: '0 0 18px', maxWidth: 720, lineHeight: 1.5 }}>
        Contatos com data e motivo, combinados na ficha de cada pessoa. No dia, a {nomeAgente} manda uma
        mensagem sobre o assunto, uma vez só, no horário das mensagens automáticas.
      </p>

      {ligado === false && (
        <div style={{ padding: '10px 14px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, fontSize: 13, color: '#92400E', marginBottom: 16 }}>
          O envio está desligado: nada sai até ligar em <strong>{AGENTE_PAGINA} › Retornos combinados</strong> (e a {nomeAgente} estar ligada).
        </div>
      )}
      {erro && <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, fontSize: 13, color: '#DC2626', marginBottom: 16 }}>{erro}</div>}

      {carregando ? null : (
        <>
          {atrasados.length > 0 && (
            <Bloco titulo={`Atrasados (${atrasados.length})`} vazio={false}
              legenda="Passou o dia e não saiu. Depois de 14 dias, ninguém é procurado sem a equipe decidir: remarque na ficha ou cancele.">
              {atrasados.map((r) => (
                <Linha key={r.id} r={r} direita={<Selo texto="Atrasado" cor="#B45309" fundo="#FEF3C7" />}
                  aoCancelar={podeEditar ? () => cancelar(r) : undefined} />
              ))}
            </Bloco>
          )}

          <Bloco titulo={`Próximos (${proximos.length})`} vazio={!proximos.length}
            legenda="O que vai sair, a começar por hoje.">
            {proximos.map((r) => (
              <Linha key={r.id} r={r}
                direita={r.para_data === hoje ? <Selo texto="Hoje" cor={MARCA} fundo={MARCA_SUAVE} /> : undefined}
                aoCancelar={podeEditar ? () => cancelar(r) : undefined} />
            ))}
          </Bloco>

          <Bloco titulo={`Enviados nos últimos 30 dias (${enviados.length})`} vazio={!enviados.length}
            legenda="A mensagem que saiu e se a pessoa respondeu.">
            {enviados.map((r) => (
              <Linha key={r.id} r={r}
                direita={respondeu.has(r.id)
                  ? <Selo texto="Respondeu" cor="#1A7A48" fundo="#E6F4EC" />
                  : <Selo texto="Sem resposta" cor="#6B818C" fundo="#EEF2F4" />} />
            ))}
          </Bloco>
        </>
      )}
    </div>
  )
}
