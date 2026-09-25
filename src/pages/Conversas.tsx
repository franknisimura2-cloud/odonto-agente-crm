import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTelaPequena } from '../lib/useTelaPequena'
import ListaConversas from '../components/ListaConversas'
import JanelaConversa from '../components/JanelaConversa'
import PainelLead from '../components/PainelLead'
import {
  listarConversas, carregarMensagens, enviarMensagem,
  assumirConversa, devolverConversa, marcarComoLidas,
} from '../lib/conversas'
import type { ConversaResumo, MensagemWhatsapp } from '../types'

/**
 * A tela Conversas — o WhatsApp da clínica dentro do sistema.
 *
 * ⚠️ REALTIME ASSINA A TABELA, NUNCA A VIEW. A lista vem de `conversas_lista`,
 * mas a assinatura é em `mensagens_whatsapp` e `crm_clinica_dados`: o Postgres
 * só replica tabela. Assinar a view não dá erro — simplesmente nunca dispara.
 *
 * Chega evento, a lista é RELIDA em vez de remendada com o payload. O payload
 * traz a linha da tabela; a lista precisa da última mensagem, do contador de
 * não lidas e do nome de quem assumiu, que são calculados na view.
 *
 * ── NO CELULAR: UMA COLUNA POR VEZ ─────────────────────────────────────────
 *
 * As três colunas (lista, conversa, ficha) viram três telas, como no próprio
 * WhatsApp. Qual aparece sai do ENDEREÇO: `?lead=X` abre a conversa, e
 * `&ficha=1` a ficha por cima dela. É por isso que a conversa aberta é lida da
 * URL, e não guardada em estado: no celular cada passo entra no histórico, e o
 * botão voltar do Android (ou o gesto do iPhone) desfaz um passo — em vez de
 * sair da tela Conversas inteira. No computador nada muda: a troca de conversa
 * continua substituindo o endereço, sem encher o histórico.
 */
export default function Conversas() {
  const [params, setParams] = useSearchParams()
  const pequena = useTelaPequena()
  const navigate = useNavigate()
  const location = useLocation()

  const [conversas, setConversas] = useState<ConversaResumo[]>([])
  const selecionada = params.get('lead')
  const fichaNoCelular = params.get('ficha') === '1'
  const [mensagens, setMensagens] = useState<MensagemWhatsapp[]>([])

  const [carregandoLista, setCarregandoLista] = useState(true)
  const [carregandoConversa, setCarregandoConversa] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  // Aberto ou fechado é preferência de quem usa, e sobrevive ao F5. Se falhar
  // (navegador anônimo, site data bloqueado), abre — que é o padrão útil.
  const [painelAberto, setPainelAberto] = useState(() => {
    try { return localStorage.getItem('conversas.painel') !== 'fechado' } catch { return true }
  })

  function alternarPainel() {
    setPainelAberto((antes) => {
      const agora = !antes
      try { localStorage.setItem('conversas.painel', agora ? 'aberto' : 'fechado') } catch { /* segue */ }
      return agora
    })
  }

  // O callback do Realtime é criado uma vez e enxergaria para sempre o valor
  // inicial de `selecionada`. O ref é o que o mantém em dia.
  const abertaRef = useRef<string | null>(selecionada)
  useEffect(() => { abertaRef.current = selecionada }, [selecionada])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUsuarioId(data.user?.id ?? null))
  }, [])

  // Escritas em `.then()`, e não com `await`, porque estas duas rodam dentro de
  // efeito: o React avisa que `setState` no corpo do efeito encadeia render em
  // cima de render. Dentro do callback não encadeia — é o mesmo padrão do CRM.
  const recarregarLista = useCallback(() =>
    listarConversas()
      .then((c) => { setConversas(c); setCarregandoLista(false) })
      .catch(() => { setErro('Não consegui carregar as conversas.'); setCarregandoLista(false) }),
  [])

  const recarregarMensagens = useCallback((leadId: string) =>
    carregarMensagens(leadId)
      .then((m) => { setMensagens(m); setCarregandoConversa(false) })
      .catch(() => { setErro('Não consegui carregar esta conversa.'); setCarregandoConversa(false) }),
  [])

  useEffect(() => { recarregarLista() }, [recarregarLista])

  // Abrir uma conversa: carrega e zera as não lidas.
  useEffect(() => {
    if (!selecionada) return
    recarregarMensagens(selecionada)
    marcarComoLidas(selecionada).then(recarregarLista)
  }, [selecionada, recarregarMensagens, recarregarLista])

  // Realtime.
  useEffect(() => {
    const canal = supabase
      .channel('conversas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mensagens_whatsapp' },
        (payload) => {
          const linha = (payload.new ?? payload.old) as { lead_id?: string } | null
          recarregarLista()
          if (linha?.lead_id && linha.lead_id === abertaRef.current) {
            recarregarMensagens(linha.lead_id)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'crm_clinica_dados' },
        () => recarregarLista(),
      )
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [recarregarLista, recarregarMensagens])

  const aberta = conversas.find((c) => c.lead_id === selecionada) ?? null

  function selecionar(leadId: string) {
    if (leadId === selecionada) return
    // Limpar aqui, e não no efeito: trocar de conversa mostraria por um
    // instante as mensagens da anterior debaixo do nome da nova.
    setMensagens([])
    setCarregandoConversa(true)
    setErro('')
    // O `state` marca que fomos nós que empilhamos o passo: é o que deixa o
    // `voltar` saber se pode simplesmente desfazer (ver `voltarUmPasso`).
    setParams({ lead: leadId }, pequena ? { state: { empilhado: true } } : { replace: true })
  }

  /**
   * A seta de voltar do celular. Se o passo foi empilhado aqui, desfazer é o
   * mesmo que o botão voltar do aparelho. Se a pessoa chegou por um link direto
   * (a ficha de um contato manda para `?lead=X`), não há passo nosso para
   * desfazer — e `navigate(-1)` a tiraria da tela; então o endereço é trocado.
   */
  function voltarUmPasso(destino: Record<string, string>) {
    if ((location.state as { empilhado?: boolean } | null)?.empilhado) navigate(-1)
    else setParams(destino, { replace: true })
  }

  function abrirFichaNoCelular() {
    if (!selecionada) return
    setParams({ lead: selecionada, ficha: '1' }, { state: { empilhado: true } })
  }

  async function aoEnviar(texto: string) {
    if (!selecionada) return
    setEnviando(true)
    setErro('')
    try {
      await enviarMensagem(selecionada, texto)
      await recarregarMensagens(selecionada)
      await recarregarLista()
    } catch {
      setErro('A mensagem não saiu. Confira se a Evolution está conectada e tente de novo.')
    }
    setEnviando(false)
  }

  async function aoAssumir() {
    if (!selecionada || !usuarioId) return
    setErro('')
    try {
      await assumirConversa(selecionada, usuarioId)
      await recarregarLista()
    } catch {
      setErro('Não consegui assumir a conversa.')
    }
  }

  async function aoDevolver() {
    if (!selecionada) return
    setErro('')
    try {
      await devolverConversa(selecionada)
      await recarregarLista()
    } catch {
      setErro('Não consegui devolver a conversa.')
    }
  }

  if (pequena) {
    // Uma selecionada que não existe na lista (link velho, conversa apagada)
    // cai na lista — mas só depois de a lista carregar, senão todo link direto
    // piscaria a lista antes de abrir a conversa.
    const tela = !selecionada || (!aberta && !carregandoLista) ? 'lista'
      : fichaNoCelular && aberta ? 'ficha'
      : 'conversa'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
        {tela === 'lista' && (
          <ListaConversas
            conversas={conversas}
            selecionada={null}
            onSelecionar={selecionar}
            carregando={carregandoLista}
            celular
          />
        )}
        {tela === 'conversa' && (
          <JanelaConversa
            conversa={aberta}
            mensagens={mensagens}
            carregando={carregandoConversa || !aberta}
            enviando={enviando}
            erro={erro}
            onEnviar={aoEnviar}
            onAssumir={aoAssumir}
            onDevolver={aoDevolver}
            painelAberto={false}
            onAlternarPainel={abrirFichaNoCelular}
            celular
            onVoltar={() => voltarUmPasso({})}
          />
        )}
        {tela === 'ficha' && aberta && (
          <PainelLead
            key={aberta.lead_id}
            leadId={aberta.lead_id}
            onFechar={() => voltarUmPasso({ lead: aberta.lead_id })}
            celular
          />
        )}
      </div>
    )
  }

  return (
    // Coluna: a faixa de aviso ocupa a largura inteira, e as três colunas da
    // tela ficam na linha de baixo. `minHeight: 0` no meio é o que deixa elas
    // rolarem por dentro em vez de esticar a página.
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <ListaConversas
        conversas={conversas}
        selecionada={selecionada}
        onSelecionar={selecionar}
        carregando={carregandoLista}
      />
      <JanelaConversa
        conversa={aberta}
        mensagens={mensagens}
        carregando={carregandoConversa}
        enviando={enviando}
        erro={erro}
        onEnviar={aoEnviar}
        onAssumir={aoAssumir}
        onDevolver={aoDevolver}
        painelAberto={painelAberto}
        onAlternarPainel={alternarPainel}
      />
      {painelAberto && aberta && (
        // A `key` força a remontagem ao trocar de conversa: sem ela, o painel
        // reaproveitaria o estado anterior e mostraria a foto de quem já saiu.
        <PainelLead key={aberta.lead_id} leadId={aberta.lead_id} onFechar={alternarPainel} />
      )}
      </div>
    </div>
  )
}
