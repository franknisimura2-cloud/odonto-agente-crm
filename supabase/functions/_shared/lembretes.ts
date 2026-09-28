/**
 * Lembretes de agendamento — os textos e o reconhecimento do "sim".
 *
 * Tudo aqui é função pura, sem banco e sem rede: quem decide QUEM recebe é a
 * `lembretes_pendentes()` (migração 0037), e quem envia é a rota `/lembretes`
 * da função `whatsapp`.
 *
 * O TEXTO É FIXO, SEM MODELO DE IA. Lembrete é data, hora, com quem e o quê —
 * não há o que improvisar, e um modelo só traria o risco de errar a hora de
 * alguém.
 */

export interface Lembrete {
  nome: string | null
  etapa: 'vespera' | 'antes'
  data_consulta: string
  procedimento: string | null
  profissional: string | null
  pedir_confirmacao: boolean
}

/** "ana maria" → "Ana". Sem nome, sem vocativo. */
function primeiroNome(nome: string | null): string {
  const p = (nome ?? '').trim().split(/\s+/)[0] ?? ''
  if (!p) return ''
  return p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR')
}

/**
 * "Estética - Limpeza de pele" → "limpeza de pele". O catálogo usa a
 * categoria na frente; na frase ela sobra.
 */
function nomeCurto(procedimento: string | null): string {
  const p = (procedimento ?? '').trim()
  const depois = p.includes(' - ') ? p.split(' - ').slice(1).join(' - ').trim() : p
  return depois
}

/** Data no fuso da clínica, como 'AAAA-MM-DD' — para comparar dias. */
function diaNoFuso(d: Date, fuso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/**
 * "hoje às 14:00", "amanhã (terça, 29/09) às 14:00", "na sexta, 02/10, às 9:30".
 * Sempre no fuso da clínica — o servidor da função roda em UTC.
 */
export function quandoFalado(iso: string, fuso: string, agora = new Date()): string {
  const d = new Date(iso)
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso, weekday: 'long', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const v = (t: string) => partes.find((x) => x.type === t)?.value ?? ''
  const semana = v('weekday').replace('-feira', '')
  const hora = `${v('hour')}:${v('minute')}`
  const dataCurta = `${v('day')}/${v('month')}`

  const hoje = diaNoFuso(agora, fuso)
  const amanha = diaNoFuso(new Date(agora.getTime() + 86_400_000), fuso)
  const dia = diaNoFuso(d, fuso)

  if (dia === hoje) return `hoje às ${hora}`
  if (dia === amanha) return `amanhã (${semana}, ${dataCurta}) às ${hora}`
  return `${semana === 'sábado' || semana === 'domingo' ? 'no' : 'na'} ${semana}, ${dataCurta}, às ${hora}`
}

/**
 * As mensagens do lembrete. Cada item vira UMA mensagem no WhatsApp — duas
 * curtas leem melhor que um bloco.
 */
export function textoDoLembrete(l: Lembrete, fuso: string, agora = new Date()): string[] {
  const nome = primeiroNome(l.nome)
  const oi = nome ? `Oi, ${nome}!` : 'Oi!'
  const oque = nomeCurto(l.procedimento)
  const deQue = oque ? ` de ${oque}` : ''
  const comQuem = l.profissional ? ` com ${l.profissional}` : ''
  const quando = quandoFalado(l.data_consulta, fuso, agora)

  if (l.etapa === 'antes') {
    return [`${oi} Seu horário${deQue} é ${quando}${comQuem}. Até já! 😊`]
  }

  return [
    `${oi} Passando para lembrar do seu horário${deQue} ${quando}${comQuem}.`,
    l.pedir_confirmacao
      ? 'Você confirma sua presença? É só responder SIM 😊'
      : 'Se precisar remarcar, é só me avisar por aqui 😊',
  ]
}

/** A resposta ao SIM. Cita o dia: é o que dá certeza de que foi entendido. */
export function textoDaConfirmacao(nome: string | null, dataConsulta: string, fuso: string, agora = new Date()): string {
  const n = primeiroNome(nome)
  return `Presença confirmada${n ? `, ${n}` : ''}! Te esperamos ${quandoFalado(dataConsulta, fuso, agora)} 💜`
}

// ---------------------------------------------------------------------------
// O "sim"
// ---------------------------------------------------------------------------

function normalizar(texto: string): string {
  return texto
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[👍✅🙏😊🙂😀😄😁☺️💜❤️🥰🤩👌✔️]/gu, ' ok ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** O que, sozinho, é um "sim" a "você confirma?". */
const SIM = new Set([
  'sim', 's', 'ss', 'simm', 'siim', 'sim sim', 'sim senhora', 'sim senhor',
  'confirmo', 'confirmado', 'confirmada', 'confirmar', 'pode confirmar',
  'confirmo sim', 'sim confirmo', 'sim pode confirmar', 'confirmadissimo',
  'ok', 'okay', 'oki', 'certo', 'certinho', 'combinado', 'beleza', 'blz',
  'perfeito', 'isso', 'claro', 'com certeza', 'vou', 'vou sim', 'irei',
  'estarei', 'estarei ai', 'estarei la', 'estarei sim', 'la estarei',
  'ta bom', 'sim ta bom', 'otimo', 'sim otimo', 'fechado', 'pode ser',
])

/** O que pode acompanhar o "sim" sem mudar o sentido. */
const CORTESIA = /\b(obrigad[oa]s?|obg|brigad[oa]|valeu|vlw|bom dia|boa tarde|boa noite|ate amanha|ate la|ate mais|ate logo|tudo certo|ta|esta|t[aá]|ok)\b/g

/** "Sim", "sim, obrigada!", "👍" — só confirmação e cortesia. */
function soConfirma(texto: string): boolean {
  const n = normalizar(texto)
  if (!n) return false
  if (SIM.has(n)) return true
  const semCortesia = n.replace(CORTESIA, ' ').replace(/\s+/g, ' ').trim()
  // Sobrou só o "sim" (ou nada, se era "ok, obrigada": a cortesia inclui ok).
  return semCortesia === '' ? /\bok\b/.test(n) : SIM.has(semCortesia)
}

/** Só cortesia ("obrigada!", "bom dia") — não confirma, mas também não pede resposta nova. */
function soCortesia(texto: string): boolean {
  const n = normalizar(texto)
  return n !== '' && n.replace(CORTESIA, ' ').trim() === ''
}

/**
 * O que a rajada de mensagens da pessoa diz sobre a confirmação.
 *
 *   'so_confirma'    — só "sim" e cortesia: confirma e a resposta é fixa.
 *   'confirma_e_mais' — um "sim" solto mais outra coisa ("sim / posso levar
 *                       minha filha?"): confirma, e a agente responde o resto.
 *   'nada'           — não é confirmação: segue a conversa normal.
 */
export function lerConfirmacao(textos: string[]): 'so_confirma' | 'confirma_e_mais' | 'nada' {
  const validos = textos.map((t) => t ?? '').filter((t) => t.trim())
  if (!validos.length) return 'nada'
  const confirma = validos.some(soConfirma)
  if (!confirma) return 'nada'
  const resto = validos.filter((t) => !soConfirma(t) && !soCortesia(t))
  return resto.length ? 'confirma_e_mais' : 'so_confirma'
}
