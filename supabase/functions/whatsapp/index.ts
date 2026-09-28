/**
 * O cérebro da Letícia — recebe do WhatsApp, pensa, responde.
 *
 * Documentação: agente-ia/README.md
 *
 * AS ROTAS:
 *   POST /whatsapp                 webhook da ponte ativa (WEBHOOK_SEGREDO)
 *   POST /whatsapp/follow-up       o cron manda retomar as conversas frias (WEBHOOK_SEGREDO)
 *   POST /whatsapp/enviar          envio manual do atendente (sessão)
 *   GET  /whatsapp/prompt-oficial  o prompt publicado, para a tela comparar (sessão)
 *   GET  /whatsapp/foto            foto de perfil de um número (sessão)
 *   GET  /whatsapp/conexao         a conexão está de pé? quem está conectado? (sessão)
 *   POST /whatsapp/conexao/conectar     abre pareamento, devolve código ou QR (sessão)
 *   POST /whatsapp/conexao/desconectar  encerra a sessão do WhatsApp (sessão)
 *   POST /whatsapp/conexao/apontar-webhook  manda a ponte ativa avisar esta função (sessão)
 *   POST /whatsapp/apagar-pessoa   apaga TUDO de uma pessoa, mídia inclusive (sessão)
 *
 * PUBLICADA COM `--no-verify-jwt`, igual à `agenda/`: quem chama é a ponte,
 * que não tem sessão do Supabase. A autenticação é nossa. Reimplantar no padrão
 * derruba o webhook com um 401 que nem chega no nosso código.
 *
 * O WEBHOOK RESPONDE 200 NA HORA e faz o trabalho em segundo plano. A ponte
 * reenvia o que demora — e reenvio vira mensagem duplicada, ou pior, resposta
 * duplicada. Guardar a mensagem é rápido; pensar não.
 */

import {
  rpc, selecionar, inserir, atualizar, subirMidia,
  apagar, listarMidias, apagarMidias,
} from '../_shared/db.ts'
import {
  conversar, transcrever, descreverImagem, chavesDeIA, type MensagemLLM,
} from '../_shared/llm.ts'
import { montarPrompt, montarFicha, quando } from '../_shared/prompt.ts'
import { PROMPT_OFICIAL } from '../_shared/prompt-oficial.ts'
import { ferramentasCom, executar, type Contexto } from '../_shared/ferramentas.ts'
import { ponteAtiva } from '../_shared/pontes.ts'
import { avaliarWebhook } from '../_shared/whatsapp.ts'
import type { MensagemRecebida, Ponte } from '../_shared/whatsapp.ts'

const SEGREDO = Deno.env.get('WEBHOOK_SEGREDO') ?? ''
const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!

/** O endereço desta função — para onde o webhook da ponte tem que apontar. */
const NOSSA_URL = `${URL_SUPABASE}/functions/v1/whatsapp`

/**
 * Quanto esperamos o paciente terminar de escrever.
 *
 * O relógio **reinicia a cada mensagem dele**: quem manda cinco seguidas recebe
 * uma resposta só, doze segundos depois da última — como uma pessoa faria.
 */
const ESPERA_MS = 12_000

/**
 * Quando o "digitando…" acende, contado da última mensagem do paciente.
 *
 * A espera inteira em silêncio era tempo em que a tela dele não dava sinal
 * nenhum de que a mensagem tinha chegado. Acendendo aos oito, os quatro
 * segundos que sobram viram atenção visível em vez de vazio.
 *
 * **Oito, e não zero:** aceso na hora, ele apareceria também nas execuções que
 * vão morrer caladas — a cada mensagem de quem escreve picotado. "Digitando…"
 * que pisca e some sem resposta é pior que tela parada.
 */
const ESPERA_ATE_DIGITANDO_MS = 8_000

/** Teto de idas e voltas com as ferramentas numa mesma resposta. */
const MAX_VOLTAS = 6

/**
 * Quantas mensagens da conversa vão para o modelo.
 *
 * **Cada balão conta uma linha**, e ela responde em 2 ou 3 — então 50 mensagens
 * são umas 16 trocas, não 50. O que passar disso a Letícia não enxerga mais: a
 * memória longa dela é a ficha (`montarFicha`), não esta janela.
 */
const HISTORICO = 50

const FUSO_PADRAO = 'America/Sao_Paulo'

/**
 * Quantos follow-ups uma rodada do cron envia.
 *
 * O cron bate de minuto em minuto, então a fila que sobrar volta na batida
 * seguinte. O teto existe para o dia em que alguém ligar o follow-up num banco
 * com dois mil leads calados: sem ele, seriam dois mil pedidos ao modelo e dois
 * mil disparos de WhatsApp no mesmo minuto — que é o retrato do que faz um
 * número ser bloqueado.
 */
const MAX_FOLLOWUPS = 20

interface Lead {
  id: string
  nome_lead: string | null
  agente_pausado: boolean
  status: string
  procedimento_interesse: string | null
  resumo_conversa: string | null
}

/** As colunas do lead que a ficha do prompt precisa. Uma consulta só. */
const CAMPOS_LEAD =
  'id,nome_lead,agente_pausado,status,procedimento_interesse,resumo_conversa'

interface Mensagem {
  id: string
  autor: string
  tipo: string
  conteudo: string | null
  criada_em: string
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

/**
 * A ponte chama de servidor para servidor e não liga para CORS. A TELA
 * chama do navegador — e sem estes cabeçalhos o preflight barra antes de a
 * requisição existir, com um erro que não aparece no log da função.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-segredo',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(req.url)
  const rota = url.pathname.replace(/^\/whatsapp/, '').replace(/\/+$/, '')

  try {
    if (req.method === 'POST' && rota === '/follow-up') return await rotaFollowUp(req)
    if (req.method === 'POST' && rota === '/enviar') return await rotaEnviar(req)
    if (req.method === 'GET' && rota === '/prompt-oficial') return await rotaPromptOficial(req)
    if (req.method === 'GET' && rota === '/foto') return await rotaFoto(req)
    if (req.method === 'GET' && rota === '/chaves-ia') return await rotaChavesIA(req)
    if (req.method === 'GET' && rota === '/conexao') return await rotaConexao(req)
    if (req.method === 'POST' && rota === '/conexao/conectar') return await rotaConectar(req)
    if (req.method === 'POST' && rota === '/conexao/desconectar') return await rotaDesconectar(req)
    if (req.method === 'POST' && rota === '/conexao/apontar-webhook') return await rotaApontarWebhook(req)
    if (req.method === 'POST' && rota === '/apagar-pessoa') return await rotaApagarPessoa(req)
    if (req.method === 'POST' && (rota === '' || rota === '/')) return await rotaWebhook(req)
    return json({ ok: false, motivo: 'rota_desconhecida' }, 404)
  } catch (e) {
    console.error('erro na entrada:', e)
    return json({ ok: false, motivo: 'erro_interno' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Webhook da ponte ativa (Evolution ou uazapi — ver `_shared/whatsapp.ts`)
// ---------------------------------------------------------------------------

async function rotaWebhook(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const enviado = req.headers.get('x-webhook-segredo') ?? url.searchParams.get('segredo') ?? ''
  if (!SEGREDO || enviado !== SEGREDO) {
    return json({ ok: false, motivo: 'nao_autorizado' }, 401)
  }

  const corpo = await req.json().catch(() => null)
  if (!corpo) return json({ ok: true, ignorado: 'corpo_invalido' })

  // Quem lê é a ponte ATIVA, e só ela. Se a outra continuar apontada para cá
  // depois de uma troca de provedor, o formato dela não é reconhecido e a
  // mensagem é descartada — o que é o certo: responder mandaria a resposta
  // pelo número errado, para quem nunca escreveu para ele.
  const ponte = await ponteAtiva()
  const lido = ponte.lerWebhook(corpo)

  if (lido.tipo === 'ignorar') {
    // Com motivo, sempre. A ferida recorrente deste projeto é o silêncio:
    // mensagem enviada, nenhuma resposta, nada no banco, nada no log.
    console.log(`webhook ignorado (${ponte.nome}): ${lido.motivo}`)
    return json({ ok: true, ignorado: lido.motivo })
  }

  const recebida = lido.mensagem
  const lead = await acharOuCriarLead(recebida.whatsapp)

  const criadas = await inserir<{ id: string }>('mensagens_whatsapp', {
    lead_id: lead.id,
    autor: 'paciente',
    tipo: recebida.tipo,
    conteudo: recebida.texto,
    id_externo: recebida.idExterno,
    lida: false,
  }, true)

  // Vazio = `id_externo` repetido: a ponte reenviou. Já tratamos.
  if (!criadas.length) return json({ ok: true, ignorado: 'duplicada' })

  const mensagemId = criadas[0].id

  // A partir daqui é demorado — o webhook não espera.
  emSegundoPlano(processar(ponte, lead, mensagemId, recebida))

  return json({ ok: true })
}

// ---------------------------------------------------------------------------
// O trabalho pesado
// ---------------------------------------------------------------------------

async function processar(
  ponte: Ponte,
  lead: Lead,
  mensagemId: string,
  recebida: MensagemRecebida,
): Promise<void> {
  const whatsapp = recebida.whatsapp

  // ---- Mídia: baixar, guardar e virar texto -------------------------------
  //
  // As duas mídias que a Letícia entende terminam no mesmo lugar: uma linha de
  // texto no `conteudo` da mensagem. O áudio pelo Whisper, a foto pelo
  // descritor. Nada de imagem viaja daqui para a frente.
  if (recebida.midia) {
    const midia = await ponte.baixarMidia(recebida.midia)
    if (midia) {
      const bytes = Uint8Array.from(atob(midia.base64), (c) => c.charCodeAt(0))
      const extensao = (midia.tipoMime.split('/')[1] ?? 'bin').split(';')[0]
      const caminho = `${lead.id}/${mensagemId}.${extensao}`

      try {
        await subirMidia(caminho, bytes, midia.tipoMime)
        await atualizar('mensagens_whatsapp', `id=eq.${mensagemId}`, { midia_url: caminho })
      } catch (e) {
        console.error('storage:', e)
      }

      if (recebida.tipo === 'audio') {
        const texto = await transcrever(bytes, midia.tipoMime)
        await atualizar('mensagens_whatsapp', `id=eq.${mensagemId}`, {
          conteudo: texto ?? '[áudio que não consegui entender]',
        })
      } else if (recebida.tipo === 'imagem') {
        const descricao = await descreverImagem(midia.base64, midia.tipoMime)
        await atualizar('mensagens_whatsapp', `id=eq.${mensagemId}`, {
          conteudo: descricao ?? 'não consegui abrir esta foto',
        })
      }
    } else {
      // O DOWNLOAD FALHOU, E ISSO PRECISA VIRAR TEXTO.
      //
      // Sem esta linha o `conteudo` fica nulo, e o histórico mostra só
      // "[foto enviada]" — uma foto que, para o modelo, existe e não diz
      // nada. Foi o que aconteceu na estreia da uazapi: ela agradeceu a foto,
      // disse "imagino que isso esteja te incomodando" e recusou o
      // diagnóstico de uma imagem que nunca chegou até ela.
      //
      // Falha de mídia tem que chegar ao modelo como falha. Ele sabe pedir de
      // novo; o que ele não sabe é adivinhar que está cego.
      //
      // ⚠️ As frases são **contrato com o `prompt.md`**, que tem uma resposta
      // própria para cada uma. Mudar o texto aqui sem mudar lá devolve o
      // sintoma: ela volta a improvisar sobre o que não recebeu.
      console.error(`midia nao baixada: ${recebida.tipo} de ${whatsapp}`)
      const aviso = recebida.tipo === 'audio'
        ? '[áudio que não consegui abrir]'
        : recebida.tipo === 'imagem'
        ? 'não consegui abrir esta foto'
        : null
      if (aviso) {
        await atualizar('mensagens_whatsapp', `id=eq.${mensagemId}`, { conteudo: aviso })
      }
    }
  }

  // ---- A espera, em duas etapas ------------------------------------------
  //
  // Quem manda mensagem picotada acorda uma execução por mensagem, e todas
  // dormem. Ao acordar, cada uma pergunta se chegou coisa mais nova: se chegou,
  // some calada, e a mais nova responde por todas. É o que evita três respostas
  // para "oi", "tudo bem?", "queria saber do clareamento".
  //
  // O horário é lido UMA vez, antes de dormir: as duas conferências comparam
  // contra o mesmo marco, e é uma consulta a menos.
  const chegouEm = await criadaEm(mensagemId)

  await new Promise((r) => setTimeout(r, ESPERA_ATE_DIGITANDO_MS))
  if (await chegouMaisNova(lead.id, mensagemId, chegouEm)) return

  // Oito segundos calado: daqui em diante é provável que seja esta execução a
  // responder, e o "digitando…" acende. Cosmético de propósito — `digitando`
  // engole o próprio erro, e a resposta sai igual se a presença não aparecer.
  const resto = ESPERA_MS - ESPERA_ATE_DIGITANDO_MS
  await ponte.digitando(whatsapp, resto)
  await new Promise((r) => setTimeout(r, resto))

  // A segunda conferência não é zelo: quem escreveu no meio do "digitando…"
  // tem execução própria, que responderá por todas. Sem ela, seriam duas.
  if (await chegouMaisNova(lead.id, mensagemId, chegouEm)) return

  // ---- As duas travas ----------------------------------------------------
  const atual = await selecionar<Lead>(
    `crm_clinica?select=${CAMPOS_LEAD}&id=eq.${lead.id}&limit=1`,
  )
  if (atual[0]?.agente_pausado) return

  const podeResponder = await rpc<boolean | null>('agente_deve_responder', {
    p_whatsapp: whatsapp,
  })
  if (podeResponder !== true) return

  // ---- Pensar ------------------------------------------------------------
  const cfg = await selecionar<{ modelo: string; prompt: string | null; nome_agente: string }>(
    'configuracoes_agente?select=modelo,prompt,nome_agente&limit=1',
  )
  const clinica = await selecionar<{ fuso_horario: string | null }>(
    'configuracoes_clinica?select=fuso_horario&limit=1',
  )
  const fuso = clinica[0]?.fuso_horario || FUSO_PADRAO

  // A ficha sai do lead RECÉM-LIDO (`atual`), não do que chegou no começo da
  // execução: nos 8 segundos de espera a Letícia pode ter gravado o nome.
  const ficha = await montarFicha(lead.id, atual[0] ?? lead, fuso)
  const sistema = await montarPrompt(cfg[0]?.prompt, ficha, cfg[0]?.nome_agente)
  const mensagens = await montarHistorico(lead.id)
  const ctx: Contexto = { leadId: lead.id, whatsapp, fuso }

  // O CATÁLOGO ENTRA NO SCHEMA DAS FERRAMENTAS, e não só no texto do prompt.
  //
  // Assim o modelo não consegue escrever "lente pro dente": o `enum` do JSON
  // Schema restringe a saída aos nomes cadastrados. É o que faz "qual o
  // procedimento mais procurado?" ter resposta.
  //
  // Lido a cada mensagem, e de propósito: uma lista fixa envelheceria no dia em
  // que a clínica cadastrasse mais um, e o sintoma seria a Letícia não
  // conseguir marcar algo que está na tela dela.
  const catalogo = await selecionar<{ nome: string }>(
    'servicos_clinica?select=nome&ativo=is.true&order=nome',
  )
  const ferramentas = ferramentasCom(catalogo.map((s) => s.nome))

  let resposta = ''
  for (let volta = 0; volta < MAX_VOLTAS; volta++) {
    const r = await conversar({
      modelo: cfg[0]?.modelo ?? 'gpt-4.1-mini',
      sistema,
      mensagens,
      ferramentas,
    })

    if (!r.chamadas.length) {
      resposta = r.texto
      break
    }

    mensagens.push({ papel: 'assistant', conteudo: r.texto, chamadas: r.chamadas })
    for (const c of r.chamadas) {
      const saida = await executar(c.nome, c.argumentos, ctx)
      mensagens.push({
        papel: 'ferramenta',
        chamadaId: c.id,
        conteudo: JSON.stringify(saida),
      })
    }
  }

  if (!resposta.trim()) return

  // ---- Falar -------------------------------------------------------------
  // O prompt pede 2 ou 3 mensagens curtas separadas por linha em branco. Aqui
  // elas viram mensagens de verdade — uma pessoa não manda um bloco só.
  const partes = resposta.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).slice(0, 4)

  for (const parte of partes) {
    // Uns 45 caracteres por segundo, entre 1,2s e 5s. Resposta instantânea é a
    // coisa que mais denuncia que não tem gente do outro lado.
    const pausa = Math.min(5000, Math.max(1200, parte.length * 22))
    await ponte.digitando(whatsapp, pausa)
    await new Promise((r) => setTimeout(r, pausa))

    let idExterno: string | null = null
    try {
      idExterno = await ponte.enviarTexto(whatsapp, parte)
    } catch (e) {
      console.error('envio:', e)
      break
    }

    await inserir('mensagens_whatsapp', {
      lead_id: lead.id,
      autor: 'agente',
      tipo: 'texto',
      conteudo: parte,
      id_externo: idExterno,
      lida: true,
    }, true)
  }

  // O lead saiu de "chegou" para "está conversando". Só avança daí — quem
  // passou de `conversando` já foi movido por outra coisa (agendou, cancelou),
  // e voltar seria mentir para o Kanban.
  try {
    await atualizar(
      'crm_clinica',
      `id=eq.${lead.id}&status=eq.iniciou_conversa`,
      { status: 'conversando' },
    )
  } catch (e) {
    console.error('status:', e)
  }
}

// ---------------------------------------------------------------------------
// Follow-up: voltar a falar quando a conversa esfria
//
// Esta é a única rota em que a agente fala sem ninguém ter escrito. Quem a
// acorda é o `pg_cron`, de minuto em minuto, pela `disparar_followups()`
// (migração 0030) — e ele só bate na porta quando há fila.
//
// ⚠️ A POLÍTICA NÃO MORA AQUI. Quem decide quem recebe, de qual etapa e sob
// quais travas é a `followups_pendentes()`, no banco. Esta rota executa a
// lista que vier — é o que permite mudar a regra sem republicar a função.
// ---------------------------------------------------------------------------

interface Pendente {
  lead_id: string
  whatsapp: string
  nome: string | null
  etapa: number
  minutos_calado: number
}

async function rotaFollowUp(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const enviado = req.headers.get('x-webhook-segredo') ?? url.searchParams.get('segredo') ?? ''
  if (!SEGREDO || enviado !== SEGREDO) {
    return json({ ok: false, motivo: 'nao_autorizado' }, 401)
  }

  const fila = (await rpc<Pendente[]>('followups_pendentes', {})).slice(0, MAX_FOLLOWUPS)
  if (!fila.length) return json({ ok: true, enviados: 0 })

  // A RESERVA É SÍNCRONA, E ISSO NÃO É DETALHE.
  //
  // O cron bate a cada minuto; gerar o texto e enviar leva segundos. Se a
  // reserva ficasse no trabalho de fundo, a batida seguinte leria a mesma fila
  // e a pessoa receberia o mesmo toque duas vezes. Gravando a linha antes de
  // responder 200, a segunda batida já não enxerga ninguém.
  const reservados: { pendente: Pendente; reservaId: string }[] = []
  for (const pendente of fila) {
    try {
      const linhas = await inserir<{ id: string }>('agente_followups', {
        lead_id: pendente.lead_id,
        etapa: pendente.etapa,
      })
      if (linhas.length) reservados.push({ pendente, reservaId: linhas[0].id })
    } catch (e) {
      console.error('reservar follow-up:', e)
    }
  }

  const trabalho = (async () => {
    for (const { pendente, reservaId } of reservados) {
      try {
        await mandarFollowUp(pendente, reservaId)
      } catch (e) {
        // A reserva sai junto: sem isso, um erro de rede tiraria a pessoa da
        // fila para sempre sem que ela tivesse recebido nada.
        console.error(`follow-up etapa ${pendente.etapa} de ${pendente.lead_id}:`, e)
        await apagar('agente_followups', `id=eq.${reservaId}`).catch(() => {})
      }
    }
  })()
  emSegundoPlano(trabalho)

  return json({ ok: true, enviados: reservados.length })
}

/** "12 minutos", "3 horas", "2 dias" — como a instrução conta o silêncio. */
function silencio(minutos: number): string {
  if (minutos < 90) return `${minutos} minutos`
  const horas = Math.round(minutos / 60)
  if (horas < 36) return `${horas} horas`
  return `${Math.round(horas / 24)} dias`
}

/**
 * A instrução que transforma a agente de quem responde em quem retoma.
 *
 * ELA VAI NO FIM DO PROMPT, e não no `prompt.md`. Duas razões: o `prompt.md`
 * tem contrato conferido (`npm run prompt` valida seções e marcadores), e este
 * texto só existe em uma das duas situações em que ela fala. Prompt que
 * descreve uma situação que não está acontecendo é ruído em toda mensagem.
 */
function instrucaoDeFollowUp(etapa: number, minutos: number, oQueAconteceu: string[]): string {
  const comum = [
    '',
    '',
    '# AGORA: VOCÊ ESTÁ RETOMANDO A CONVERSA',
    '',
    `A pessoa parou de responder faz ${silencio(minutos)}. A última mensagem da`,
    'conversa foi SUA. Ninguém pediu nada agora: quem está te acordando é o',
    'relógio do sistema.',
    '',
    'Escreva UMA mensagem curta, de no máximo 25 palavras, que:',
    '',
    '-   Retoma de onde a conversa parou, citando o que ELA falou. Se você não',
    '    tem nada concreto para citar, faça uma pergunta simples sobre o que ela',
    '    procurava.',
    '-   Não repete, com outras palavras, o que você já disse na última mensagem.',
    '-   Termina com uma pergunta fácil de responder.',
    '',
    'Nunca cobre, nunca pressione, e nunca peça desculpa por estar escrevendo.',
    'Nunca diga que ficou esperando, que a mensagem é automática, nem use as',
    'palavras "follow-up", "sistema", "lembrete" ou "retomando".',
    'Não ofereça serviço que ela não pediu, e não invente horário.',
    '',
    'Responda só com o texto da mensagem. Não use ferramenta nenhuma, e não',
    'escreva duas mensagens: uma só.',
  ]

  const fecho = etapa === 1
    ? [
        '',
        'É o primeiro toque, poucos minutos depois. O tom é o de quem continua na',
        'mesma conversa, não o de quem volta depois de um tempo.',
      ]
    : [
        '',
        'Já passou um dia, e esta é a ÚLTIMA vez que você escreve por conta',
        'própria: se ela não responder, ninguém volta a procurá-la. Deixe a porta',
        'aberta sem despedida dramática, e sem dizer que é a última tentativa.',
      ]

  return [...comum, ...oQueAconteceu, ...fecho].join('\n')
}

/**
 * O que aconteceu com o agendamento desta pessoa — e o que fazer com isso.
 *
 * ⚠️ CANCELAR NÃO É DIZER "NÃO QUERO MAIS". Sem esta explicação, o modelo lê
 * "cancelado" no histórico e escreve um follow-up genérico, do tipo "posso
 * ajudar em algo?" — desperdiçando a única informação que torna esse toque o
 * mais valioso de todos: a pessoa quis, escolheu dia e hora, e desmarcou. Quem
 * cancela é quem está mais perto de remarcar.
 *
 * Fica só no follow-up, e não na ficha (`montarFicha`), de propósito: as frases
 * da ficha são contrato com o `prompt.md` e são cobradas em toda mensagem de
 * toda conversa. Aqui a informação só é lida quando ela vai, de fato, retomar.
 */
async function oQueAconteceuComOAgendamento(leadId: string, fuso: string): Promise<string[]> {
  const consultas = await selecionar<{ procedimento: string; data_consulta: string; status: string }>(
    `consultas?select=procedimento,data_consulta,status&lead_id=eq.${leadId}` +
    `&order=data_consulta.desc&limit=1`,
  )
  const ultima = consultas[0]
  if (!ultima) return []

  if (ultima.status === 'cancelada') {
    return [
      '',
      `Ela chegou a marcar ${ultima.procedimento} para ${quando(ultima.data_consulta, fuso)}`,
      'e depois cancelou.',
      '',
      '**Cancelar não é dizer "não quero mais".** Ela quis, escolheu dia e hora,',
      'e desmarcou — quase sempre porque o horário deixou de servir. Trate como',
      'alguém que ainda quer resolver: retome pelo assunto dela e abra espaço',
      'para um horário novo. Nunca pergunte por que cancelou, nunca peça',
      'explicação, e não trate o cancelamento como um problema.',
    ]
  }

  if (ultima.status === 'faltou') {
    return [
      '',
      `Ela tinha ${ultima.procedimento} marcado para ${quando(ultima.data_consulta, fuso)}`,
      'e não apareceu.',
      '',
      'Não cobre a falta, não diga que ela faltou e não peça explicação. Fale',
      'como quem quer remarcar, e nada mais.',
    ]
  }

  return []
}

async function mandarFollowUp(pendente: Pendente, reservaId: string): Promise<void> {
  // ELA RESPONDEU NO MEIO DO CAMINHO?
  //
  // Entre a reserva e o envio passam segundos — o suficiente para a pessoa
  // escrever. Sem esta conferência, ela receberia um "ainda está aí?" logo
  // depois de ter falado, que é a cara de um robô que não lê. É a mesma
  // pergunta que `chegouMaisNova` faz na espera do webhook, pelo mesmo motivo.
  //
  // A reserva sai junto: o registro é do que FOI enviado, e nada foi. E o
  // ciclo se rearma sozinho, porque a mensagem nova empurra `ultima_do_lead`
  // para frente.
  const ultimas = await selecionar<{ autor: string }>(
    `mensagens_whatsapp?select=autor&lead_id=eq.${pendente.lead_id}` +
    `&order=criada_em.desc&limit=1`,
  )
  if (ultimas[0]?.autor === 'paciente') {
    await apagar('agente_followups', `id=eq.${reservaId}`)
    console.log(`follow-up cancelado: ${pendente.lead_id} respondeu antes do envio`)
    return
  }

  const leads = await selecionar<Lead>(
    `crm_clinica?select=${CAMPOS_LEAD}&id=eq.${pendente.lead_id}&limit=1`,
  )
  const lead = leads[0]
  if (!lead) throw new Error('lead sumiu entre a fila e o envio')

  const cfg = await selecionar<{ modelo: string; prompt: string | null; nome_agente: string }>(
    'configuracoes_agente?select=modelo,prompt,nome_agente&limit=1',
  )
  const clinica = await selecionar<{ fuso_horario: string | null }>(
    'configuracoes_clinica?select=fuso_horario&limit=1',
  )
  const fuso = clinica[0]?.fuso_horario || FUSO_PADRAO

  const ficha = await montarFicha(lead.id, lead, fuso)
  const sistema = (await montarPrompt(cfg[0]?.prompt, ficha, cfg[0]?.nome_agente)) +
    instrucaoDeFollowUp(
      pendente.etapa,
      pendente.minutos_calado,
      await oQueAconteceuComOAgendamento(lead.id, fuso),
    )

  // SEM FERRAMENTA NENHUMA, de propósito. Um follow-up não marca, não cancela e
  // não grava ficha: ele só chama de volta. Com as ferramentas na mesa, o
  // modelo tenta "adiantar" o agendamento de quem nunca confirmou nada.
  const r = await conversar({
    modelo: cfg[0]?.modelo ?? 'gpt-4.1-mini',
    sistema,
    mensagens: await montarHistorico(lead.id),
    ferramentas: [],
  })

  // A agente é instruída a mandar uma só; se vier mais, vale a primeira.
  const texto = r.texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)[0] ?? ''
  if (!texto) throw new Error('o modelo devolveu texto vazio')

  const ponte = await ponteAtiva()
  const pausa = Math.min(5000, Math.max(1200, texto.length * 22))
  await ponte.digitando(pendente.whatsapp, pausa)
  await new Promise((espere) => setTimeout(espere, pausa))

  const idExterno = await ponte.enviarTexto(pendente.whatsapp, texto)

  await inserir('mensagens_whatsapp', {
    lead_id: lead.id,
    autor: 'agente',
    tipo: 'texto',
    conteudo: texto,
    id_externo: idExterno,
    lida: true,
  }, true)

  // O texto fica gravado na reserva: é como se lê depois se a mensagem que o
  // modelo escreveu naquele momento ficou boa.
  await atualizar('agente_followups', `id=eq.${reservaId}`, { texto })

  // ---- O Kanban -----------------------------------------------------------
  //
  // As colunas "Follow-up 1" e "Follow-up 2" existem desde a migração 0001 e
  // nunca receberam ninguém: não havia o que movesse um lead para lá. Agora há.
  //
  // ⚠️ SÓ AVANÇA DE ONDE FAZ SENTIDO, e o filtro é a parte importante desta
  // linha. Quem está em `consulta_realizada` ou `paciente_recorrente` aparece
  // na tela Clientes (ver README, "Status do funil"): mover essa pessoa para
  // `follow_up_1_feito` a arrancaria de Clientes e a jogaria em Leads, semanas
  // depois de ela ter virado cliente.
  //
  // `consulta_cancelada` ENTRA na lista. Quem cancelou continua sendo lead — o
  // cancelamento não é uma saída do funil, é um passo dentro dele —, e ver o
  // card em "Follow-up" é como a equipe descobre que aquele cancelamento já foi
  // perseguido. O cancelamento em si não se perde: fica no agendamento, na
  // conversa e em `agente_followups`.
  const deOnde = pendente.etapa === 1
    ? 'iniciou_conversa,conversando,consulta_cancelada'
    : 'iniciou_conversa,conversando,consulta_cancelada,follow_up_1_feito'

  try {
    await atualizar(
      'crm_clinica',
      `id=eq.${lead.id}&status=in.(${deOnde})`,
      { status: `follow_up_${pendente.etapa}_feito` },
    )
  } catch (e) {
    console.error('status do follow-up:', e)
  }

  console.log(`follow-up etapa ${pendente.etapa} enviado para ${lead.id}`)
}

// ---------------------------------------------------------------------------
// O prompt oficial, para a aba "Agente de IA" mostrar e deixar editar
//
// Ele mora embutido na função (gerado de agente-ia/prompt.md), e a tela não
// enxerga o repositório. Sem esta rota, o botão "carregar o oficial" teria que
// guardar uma segunda cópia do texto no front — e as duas divergiriam.
// ---------------------------------------------------------------------------

async function rotaPromptOficial(req: Request): Promise<Response> {
  const usuario = await exigir(req, 'configurar')
  if (usuario instanceof Response) return usuario
  return json({ ok: true, prompt: PROMPT_OFICIAL })
}

/**
 * A foto de perfil de um número, para a tela Conversas.
 *
 * PRECISA PASSAR PELA FUNÇÃO. A chave da ponte é de servidor: pedir a foto
 * direto do navegador exigiria mandar a chave para o bundle, e quem tem essa
 * chave manda mensagem por aquele WhatsApp.
 *
 * Responde 200 com `url: null` quando não há foto — a maioria dos casos, porque
 * muita gente esconde a foto. Isso não é erro, e a tela mostra a inicial.
 */
async function rotaFoto(req: Request): Promise<Response> {
  const usuario = await exigir(req, 'pessoas', 'conversas')
  if (usuario instanceof Response) return usuario

  const numero = (new URL(req.url).searchParams.get('whatsapp') ?? '').replace(/\D/g, '')
  if (!numero) return json({ ok: false, motivo: 'sem_numero' }, 400)

  return json({ ok: true, url: await (await ponteAtiva()).fotoDoPerfil(numero) })
}

/**
 * Quais fornecedores de IA têm chave — para o seletor de modelo.
 *
 * SIM OU NÃO, nunca a chave. A tela precisa saber se pode oferecer os modelos
 * de cada fornecedor; mandar a chave para o navegador daria a qualquer pessoa
 * com o DevTools aberto uma conta de IA para gastar. Mesmo raciocínio dos 4
 * dígitos da chave da ponte, um pouco mais curto: aqui nem os 4 dígitos fazem
 * falta, porque não há painel externo para conferir.
 *
 * Sem esta rota o seletor mentia: oferecia os Claude como opção, e a
 * `ANTHROPIC_API_KEY` nunca foi preenchida. Escolher derrubava a secretária
 * em silêncio — o erro só aparecia no log da função.
 */
async function rotaChavesIA(req: Request): Promise<Response> {
  const usuario = await exigir(req, 'configurar')
  if (usuario instanceof Response) return usuario

  return json({ ok: true, ...chavesDeIA() })
}

// ---------------------------------------------------------------------------
// A conexão com o WhatsApp — para a tela Secretária de IA
//
// A chave da ponte é de servidor — de qualquer uma das duas. Estas rotas
// existem pelo mesmo motivo da `/foto`: mandar a chave para o navegador daria
// a qualquer pessoa com o DevTools aberto o controle do WhatsApp da clínica.
//
// Qual ponte responde sai da coluna `provedor_whatsapp` (migração 0017), lida
// a cada chamada — trocar na tela vale na requisição seguinte.
// ---------------------------------------------------------------------------

async function rotaConexao(req: Request): Promise<Response> {
  const usuario = await exigir(req)
  if (usuario instanceof Response) return usuario

  const ponte = await ponteAtiva()

  // Em paralelo: são dois servidores lentos quando algo está errado, e em
  // série a tela esperaria o dobro justo na hora em que precisa avisar.
  const [estado, config] = await Promise.all([
    ponte.estadoDaConexao(),
    ponte.webhook(),
  ])

  // A identificação vem das secrets da função, nunca do banco — e por isso só
  // sai por aqui, atrás da sessão. Ver `identificacao()` na porta.
  //
  // Do webhook sai o VEREDITO, nunca a URL: ela carrega o segredo dentro.
  return json({
    ok: true,
    provedor: ponte.nome,
    ...ponte.identificacao(),
    ...estado,
    webhook: avaliarWebhook(config, NOSSA_URL),
  })
}

/**
 * O botão "Apontar para cá": manda a ponte ATIVA avisar esta função.
 *
 * O segredo sai das secrets e vai direto para a ponte — a tela nunca o vê, a
 * mesma razão de `/conexao` devolver o veredito e não a URL.
 */
async function rotaApontarWebhook(req: Request): Promise<Response> {
  const usuario = await exigir(req, 'configurar')
  if (usuario instanceof Response) return usuario

  const ponte = await ponteAtiva()
  if (!ponte.configurada()) return json({ ok: false, motivo: 'nao_configurado' }, 400)

  // Sem segredo, `rotaWebhook` recusa TODA mensagem com 401. Apontar assim
  // trocaria "nada chega" por "tudo chega e é recusado" — que parece conserto
  // na tela e continua sendo silêncio no WhatsApp.
  if (!SEGREDO) return json({ ok: false, motivo: 'sem_segredo' }, 400)

  const aceitou = await ponte.apontarWebhook(NOSSA_URL, SEGREDO)

  // Quem diz se deu certo é a leitura de volta, não o 200 da escrita: é a
  // mesma pergunta que o card faz a cada minuto, e as duas respostas não podem
  // discordar.
  const webhook = avaliarWebhook(await ponte.webhook(), NOSSA_URL)
  if (webhook === 'apontado') return json({ ok: true, webhook })

  console.error(`apontar webhook (${ponte.nome}): aceitou=${aceitou}, leitura=${webhook}`)
  return json({ ok: false, motivo: aceitou ? 'nao_confirmado' : 'ponte_recusou', webhook }, 502)
}

async function rotaConectar(req: Request): Promise<Response> {
  const usuario = await exigir(req, 'configurar')
  if (usuario instanceof Response) return usuario

  const ponte = await ponteAtiva()
  if (!ponte.configurada()) return json({ ok: false, motivo: 'nao_configurado' }, 400)

  const corpo = await req.json().catch(() => ({})) as { numero?: string }
  const r = await ponte.iniciarConexao(corpo.numero)
  if (!r) return json({ ok: false, motivo: 'servidor_fora' }, 502)
  return json({ ok: true, ...r })
}

async function rotaDesconectar(req: Request): Promise<Response> {
  const usuario = await exigir(req, 'configurar')
  if (usuario instanceof Response) return usuario

  const ponte = await ponteAtiva()
  if (!ponte.configurada()) return json({ ok: false, motivo: 'nao_configurado' }, 400)

  return (await ponte.desconectar())
    ? json({ ok: true })
    : json({ ok: false, motivo: 'servidor_fora' }, 502)
}

// ---------------------------------------------------------------------------
// Apagar uma pessoa inteira
// ---------------------------------------------------------------------------

/**
 * Apaga TUDO de uma pessoa: ficha, conversa, consultas e arquivos.
 *
 * ⚠️ NÃO TEM VOLTA, e não tem lixeira. É o direito ao esquecimento da LGPD, e
 * também a saída para número errado e para lixo de teste.
 *
 * ── POR QUE ISTO NÃO PODE MORAR NO NAVEGADOR ───────────────────────────────
 *
 * A ficha e a conversa até dá: `crm_clinica_dados` tem `ON DELETE CASCADE` para
 * `mensagens_whatsapp` e `consultas`, e a tela poderia apagar a linha e pronto.
 *
 * **Os arquivos, não.** O Postgres recusa `delete from storage.objects`, porque
 * apagar o registro deixaria o arquivo órfão no backend. A Storage API exige a
 * `service_role key`, que só existe aqui dentro.
 *
 * ── A ORDEM IMPORTA ────────────────────────────────────────────────────────
 *
 * Mídia primeiro, ficha depois. O caminho do arquivo é `{lead_id}/...`, então
 * apagar a ficha antes tiraria de nós a única forma de saber quais arquivos
 * eram dela — e eles ficariam no bucket para sempre, sem ninguém que soubesse
 * a quem pertenciam.
 */
async function rotaApagarPessoa(req: Request): Promise<Response> {
  const usuario = await exigir(req, 'pessoas')
  if (usuario instanceof Response) return usuario

  const corpo = await req.json().catch(() => ({})) as { lead_id?: string }
  const leadId = String(corpo.lead_id ?? '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
    return json({ ok: false, motivo: 'lead_invalido' }, 400)
  }

  // Confere que existe ANTES de apagar, para responder "não achei" em vez de
  // "apaguei" quando o id não é de ninguém.
  const pessoa = await selecionar<{ id: string; nome_lead: string | null }>(
    `crm_clinica_dados?select=id,nome_lead&id=eq.${leadId}&limit=1`,
  )
  if (!pessoa.length) return json({ ok: false, motivo: 'nao_encontrada' }, 404)

  // 1) Os arquivos, enquanto ainda sabemos de quem são.
  let midias = 0
  try {
    midias = await apagarMidias(await listarMidias(leadId))
  } catch (e) {
    // Falhar aqui e seguir apagando a ficha deixaria arquivo órfão para sempre.
    console.error('apagar midias:', e)
    return json({ ok: false, motivo: 'falha_na_midia' }, 500)
  }

  // 2) A ficha. O CASCADE leva mensagens e consultas junto.
  await apagar('crm_clinica_dados', `id=eq.${leadId}`)

  console.log(`pessoa apagada: ${leadId} por ${usuario.id} (${midias} arquivo(s))`)
  return json({ ok: true, midias })
}

// ---------------------------------------------------------------------------
// Envio manual, pelo atendente que assumiu a conversa
// ---------------------------------------------------------------------------

/** Confere a sessão do usuário. A função sobe com `--no-verify-jwt`. */
async function usuarioDaSessao(req: Request): Promise<{ id: string } | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const r = await fetch(`${URL_SUPABASE}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    },
  })
  if (!r.ok) return null
  return await r.json()
}

/**
 * A sessão E a permissão (migração 0031).
 *
 * Esta função fala com o banco pela chave de serviço, que passa por cima do
 * RLS — então quem barra a recepcionista de apagar uma pessoa, ou a
 * profissional de desconectar o WhatsApp, é esta conferência, e não o banco.
 *
 * A pergunta vai ao próprio banco (`pode()`), com o token DO USUÁRIO: é o
 * `auth.uid()` dele que a função lê. Uma regra só, a mesma das políticas — e
 * testada por papel em `supabase/testes/0031_niveis_de_acesso.sql`.
 *
 * Com mais de uma permissão, basta uma. Sem nenhuma, basta estar logado.
 */
async function exigir(req: Request, ...permissoes: string[]): Promise<{ id: string } | Response> {
  const usuario = await usuarioDaSessao(req)
  if (!usuario) return json({ ok: false, motivo: 'sem_sessao' }, 401)
  if (permissoes.length === 0) return usuario

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  for (const permissao of permissoes) {
    const r = await fetch(`${URL_SUPABASE}/rest/v1/rpc/pode`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_permissao: permissao }),
    })
    if (r.ok && (await r.json()) === true) return usuario
  }
  return json({ ok: false, motivo: 'sem_permissao' }, 403)
}

async function rotaEnviar(req: Request): Promise<Response> {
  const usuario = await exigir(req, 'conversas')
  if (usuario instanceof Response) return usuario

  const corpo = await req.json().catch(() => ({}))
  const leadId = String(corpo.lead_id ?? '')
  const texto = String(corpo.texto ?? '').trim()
  if (!leadId || !texto) return json({ ok: false, motivo: 'dados_invalidos' }, 400)

  const leads = await selecionar<{ whatsapp_lead: string | null }>(
    `crm_clinica?select=whatsapp_lead&id=eq.${leadId}&limit=1`,
  )
  const whatsapp = leads[0]?.whatsapp_lead
  if (!whatsapp) return json({ ok: false, motivo: 'lead_sem_whatsapp' }, 400)

  const idExterno = await (await ponteAtiva()).enviarTexto(whatsapp, texto)

  await inserir('mensagens_whatsapp', {
    lead_id: leadId,
    autor: 'atendente',
    tipo: 'texto',
    conteudo: texto,
    id_externo: idExterno,
    enviada_por: usuario?.id ?? null,
    lida: true,
  }, true)

  return json({ ok: true })
}

// ---------------------------------------------------------------------------
// Apoio
// ---------------------------------------------------------------------------

/**
 * Continua trabalhando depois de responder.
 *
 * A ponte reenvia o que demora, e reenvio vira mensagem duplicada — por isso o
 * webhook responde 200 na hora e pensa depois. O `waitUntil` é o que mantém a
 * execução viva no runtime do Supabase; fora dele (um `deno run` local) o
 * `catch` evita que a promessa solta derrube o processo.
 */
function emSegundoPlano(trabalho: Promise<unknown>): void {
  const runtime = (globalThis as {
    EdgeRuntime?: { waitUntil(p: Promise<unknown>): void }
  }).EdgeRuntime

  if (typeof runtime?.waitUntil === 'function') {
    runtime.waitUntil(trabalho)
  } else {
    trabalho.catch((e) => console.error('segundo plano:', e))
  }
}

/**
 * Chegou mensagem do PACIENTE depois desta?
 *
 * `autor=eq.paciente` importa: a resposta da própria Letícia também entra em
 * `mensagens_whatsapp`, e sem o filtro ela veria a si mesma como "mensagem mais
 * nova" e calaria a execução seguinte.
 */
async function chegouMaisNova(
  leadId: string,
  mensagemId: string,
  desde: string,
): Promise<boolean> {
  const posteriores = await selecionar<{ id: string }>(
    `mensagens_whatsapp?select=id&lead_id=eq.${leadId}&autor=eq.paciente` +
    `&id=neq.${mensagemId}&criada_em=gt.${encodeURIComponent(desde)}&limit=1`,
  )
  return posteriores.length > 0
}

async function criadaEm(mensagemId: string): Promise<string> {
  const linhas = await selecionar<{ criada_em: string }>(
    `mensagens_whatsapp?select=criada_em&id=eq.${mensagemId}&limit=1`,
  )
  return linhas[0]?.criada_em ?? new Date(0).toISOString()
}

/**
 * O lead nasce SEM NOME, sempre.
 *
 * As duas pontes mandam o nome do perfil do WhatsApp em todo webhook — a
 * Evolution em `pushName`, a uazapi em `senderName` —, e é tentador
 * aproveitar. **Não aproveite.** O perfil é o apelido que
 * a pessoa escolheu, não quem vai sentar na cadeira: o telefone é do marido e
 * quem se consulta é a esposa, o perfil é "Casa da Sogra", duas pessoas dividem
 * o mesmo número.
 *
 * E o estrago não era só o nome errado no CRM: a ficha chegava preenchida, a
 * Letícia lia "já sei o nome" e **nunca perguntava** — então o palpite nunca
 * era corrigido por ninguém.
 *
 * O nome vem da conversa, pela ferramenta `atualizar_ficha`. Só de lá. Até ela
 * perguntar, as telas mostram o número formatado, que é verdade.
 */
async function acharOuCriarLead(whatsapp: string): Promise<Lead> {
  const achados = await selecionar<Lead>(
    `crm_clinica?select=${CAMPOS_LEAD}&whatsapp_lead=eq.${whatsapp}&limit=1`,
  )
  if (achados.length) return achados[0]

  const criados = await inserir<Lead>('crm_clinica', {
    whatsapp_lead: whatsapp,
    nome_lead: null,
    status: 'iniciou_conversa',
  }, true)
  if (criados.length) return criados[0]

  // Corrida: outra execução criou entre o select e o insert.
  const denovo = await selecionar<Lead>(
    `crm_clinica?select=${CAMPOS_LEAD}&whatsapp_lead=eq.${whatsapp}&limit=1`,
  )
  return denovo[0]
}

/**
 * A conversa como o modelo vê — **texto puro, do começo ao fim**.
 *
 * A foto já chegou aqui descrita em uma linha (ver `descreverImagem`), e o
 * áudio transcrito. Não há mais anexo de imagem: a descrição de uma foto de
 * três semanas atrás continua no histórico igual à de agora, e a conversa
 * inteira custa o mesmo em qualquer modelo.
 */
async function montarHistorico(leadId: string): Promise<MensagemLLM[]> {
  const linhas = await selecionar<Mensagem>(
    `mensagens_whatsapp?select=id,autor,tipo,conteudo,criada_em&lead_id=eq.${leadId}` +
    `&order=criada_em.desc&limit=${HISTORICO}`,
  )
  linhas.reverse()

  const saida: MensagemLLM[] = []
  linhas.forEach((l) => {
    const rotulo = l.tipo === 'audio'
      ? (l.conteudo ?? '[áudio]')
      : l.tipo === 'imagem'
      ? (l.conteudo ? `[foto enviada] ${l.conteudo}` : '[foto enviada]')
      : l.tipo === 'video'
      ? '[vídeo enviado]'
      : l.tipo === 'documento'
      ? '[documento enviado]'
      : (l.conteudo ?? '')

    if (!rotulo.trim()) return

    if (l.autor === 'paciente') {
      saida.push({ papel: 'user', conteudo: rotulo })
    } else {
      // O que o atendente humano escreveu entra como fala da própria Letícia:
      // para o paciente foi a mesma pessoa, e ela precisa saber o que "disse".
      saida.push({ papel: 'assistant', conteudo: rotulo })
    }
  })

  return saida.length ? saida : [{ papel: 'user', conteudo: 'oi' }]
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
