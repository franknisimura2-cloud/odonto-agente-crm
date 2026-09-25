import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar, { TopoMobile } from './Sidebar'
import AvisoWhatsAppCaiu from './AvisoWhatsAppCaiu'
import { supabase } from '../lib/supabase'
import { definirNomeDoAgente } from '../lib/agente'
import { aplicarCorDoSistema, lembrarCorNoNavegador } from '../lib/marca'
import { useTelaPequena } from '../lib/useTelaPequena'

/**
 * A casca do sistema: barra lateral fixa + conteúdo que rola.
 *
 * ⚠️ `height: 100vh` COM `overflow: hidden`, e não `minHeight`. A diferença
 * não é sutil:
 *
 * Com `minHeight`, o container cresce junto com a página, a barra lateral
 * estica junto (ela é um item flex, e `stretch` é o padrão) e o rodapé dela —
 * o nome do usuário e o menu — vai parar no fim do DOCUMENTO. Em telas altas
 * como Dashboard, Agenda e Configurações, ele simplesmente sumia abaixo da
 * dobra, e só reaparecia rolando a página até o fim.
 *
 * Fixando a altura, quem rola é o `<main>`. A barra fica onde tem que ficar:
 * do topo ao pé da janela, sempre.
 *
 * ── E É AQUI QUE O NOME DO AGENTE ENTRA ────────────────────────────────────
 *
 * Uma consulta, uma vez por sessão, no único componente por onde toda tela
 * autenticada passa. Alternativa seria cada tela buscar o seu — treze
 * consultas para o mesmo dado, e treze chances de uma delas esquecer.
 *
 * Enquanto ela não volta, vale o `NOME_PADRAO` — a interface nunca fica com
 * frases sem sujeito. Se falhar, o padrão continua valendo: o nome errado é
 * pior que nome nenhum, mas frase quebrada é pior que os dois.
 *
 * ── E O AVISO DE QUEDA DO WHATSAPP TAMBÉM ──────────────────────────────────
 *
 * Pelo mesmo motivo: é o único componente por onde toda tela autenticada passa.
 * A faixa morava dentro de Conversas, apostando que a recepção passa o dia ali
 * — quem estivesse na Agenda ou no CRM não via nada. Aqui, ela alcança quem
 * quer que esteja logado. Ela some sozinha quando está tudo bem, e só aparece
 * depois de um minuto de queda contínua.
 *
 * ── E A COR DO SISTEMA ─────────────────────────────────────────────────────
 *
 * Mesma consulta única. O `main.tsx` já pintou com a cor que este navegador
 * lembrava; aqui vale a do banco, e ela passa a ser a lembrada — é o que faz o
 * login abrir na cor da empresa na próxima vez. Se a leitura falhar, fica a
 * que já estava.
 *
 * ── NO CELULAR (até 767px, ver `useTelaPequena`) ───────────────────────────
 *
 * A barra lateral não cabe: vira uma gaveta, aberta pelo botão de uma faixa no
 * topo (`TopoMobile`), com um fundo escuro atrás que fecha ao toque. O resto da
 * casca é o mesmo — inclusive a altura fixa.
 *
 * E a altura é `100dvh`, não `100vh`. No navegador do celular, `100vh` é a
 * altura com a barra de endereço ESCONDIDA: com ela à vista, a casca passa do
 * pé da tela, e o que está embaixo (o campo de mensagem das Conversas, o
 * rodapé da barra) fica atrás da barra do navegador. `dvh` acompanha a altura
 * que está visível de verdade; no computador, as duas são iguais.
 */
export default function Layout() {
  const pequena = useTelaPequena()
  const [gavetaAberta, setGavetaAberta] = useState(false)
  const fecharGaveta = useCallback(() => setGavetaAberta(false), [])

  useEffect(() => {
    let vivo = true
    supabase
      .from('configuracoes_agente')
      .select('nome_agente')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (vivo && data?.nome_agente) definirNomeDoAgente(data.nome_agente)
      })
    supabase
      .from('configuracoes_clinica')
      .select('cor_sistema')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo || !data?.cor_sistema) return
        aplicarCorDoSistema(data.cor_sistema)
        lembrarCorNoNavegador(data.cor_sistema)
      })
    return () => { vivo = false }
  }, [])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', overflow: 'hidden', background: '#F2F6F7',
    }}>
      <AvisoWhatsAppCaiu />

      {pequena && <TopoMobile onAbrirMenu={() => setGavetaAberta(true)} />}

      {/* ⚠️ `minHeight: 0` é o que faz o `<main>` rolar por dentro em vez de
          esticar a linha. Sem ele, a faixa empurraria a barra lateral e o
          conteúdo para fora da janela — o mesmo defeito que o `height: 100dvh`
          acima existe para evitar. */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {pequena ? (
          <>
            {gavetaAberta && (
              <div
                onClick={fecharGaveta}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 80 }}
              />
            )}
            <Sidebar gaveta={{ aberta: gavetaAberta, onFechar: fecharGaveta }} />
          </>
        ) : (
          <Sidebar />
        )}
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
