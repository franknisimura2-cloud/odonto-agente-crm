/**
 * Tokens da API do Agente de IA: geração, hash e o catálogo de endpoints que
 * alimenta os cURLs da tela.
 *
 * Fica fora do componente de propósito. O hash precisa bater **exatamente** com
 * o que a Edge Function calcula (`supabase/functions/agenda/index.ts`), e uma
 * regra dessas espalhada no meio de JSX é uma regra que ninguém encontra na
 * hora de conferir.
 *
 * Contrato completo dos endpoints: `API_AGENTE.md`, na raiz do repositório.
 */

import { SUPABASE_URL } from './supabase'

const PREFIXO = 'odk_'
const ALFABETO = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const TAMANHO = 40

/**
 * Token novo: `odk_` + 40 caracteres sorteados de um alfabeto de 62.
 * São ~238 bits de entropia — não há o que adivinhar.
 *
 * O descarte dos bytes acima de `LIMITE` existe porque 256 não é múltiplo de
 * 62: sem ele, os oito primeiros símbolos do alfabeto sairiam com probabilidade
 * maior que os demais. O viés seria irrelevante neste tamanho, mas escrever
 * sorteio enviesado num gerador de credencial é o tipo de coisa que envelhece
 * mal quando alguém reaproveita a função em outro lugar.
 */
export function gerarToken(): string {
  const LIMITE = 256 - (256 % ALFABETO.length) // 248
  const buffer = new Uint8Array(TAMANHO)
  let corpo = ''
  while (corpo.length < TAMANHO) {
    crypto.getRandomValues(buffer)
    for (const b of buffer) {
      if (b >= LIMITE) continue
      corpo += ALFABETO[b % ALFABETO.length]
      if (corpo.length === TAMANHO) break
    }
  }
  return PREFIXO + corpo
}

/**
 * SHA-256 em hexadecimal minúsculo.
 *
 * ⚠️ **Precisa ser idêntico ao `sha256()` da Edge Function.** É o único ponto de
 * encontro entre quem cria o token e quem o confere; se os dois divergirem, todo
 * token criado aqui nasce inválido e o sintoma é um 401 sem explicação.
 */
export async function hashToken(valor: string): Promise<string> {
  const bytes = new TextEncoder().encode(valor)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Os primeiros caracteres, guardados em claro para identificar o token na lista. */
export function prefixoDe(valor: string): string {
  return valor.slice(0, PREFIXO.length + 6)
}

/* ──────────────────────────────────────────────
   Catálogo dos endpoints
────────────────────────────────────────────── */

export interface EndpointApi {
  rota: string
  titulo: string
  metodo: 'GET' | 'POST'
  resumo: string
  precisa: string
  opcionais: string
  /** Corpo de exemplo do cURL. Ausente nos GET. */
  corpo?: Record<string, unknown>
}

export const ENDPOINTS: EndpointApi[] = [
  {
    rota: 'profissionais',
    titulo: 'Listar profissionais',
    metodo: 'GET',
    resumo: 'O agente carrega antes de marcar, para saber quem é quem e poder mandar o profissional_id. Só os ativos: id, nome e os serviços que cada um faz (lista vazia = faz todos).',
    precisa: 'nada',
    opcionais: '—',
  },
  {
    // A rota e os nomes dos campos (`procedimento`, `consulta_id`) são contrato
    // com quem integra de fora e NÃO mudam com o vocabulário da tela.
    rota: 'procedimentos',
    titulo: 'Listar serviços',
    metodo: 'GET',
    resumo: 'Para o agente saber o que a empresa oferece e não inventar serviço que não existe. Devolve só os nomes, dos que estão ativos.',
    precisa: 'nada',
    opcionais: '—',
  },
  {
    rota: 'disponibilidade',
    titulo: 'Consultar disponibilidade',
    metodo: 'POST',
    resumo: 'Com hora, responde "pode ser quinta às 9?". Sem hora, lista o dia. Se o dia estiver lotado, devolve o próximo com vaga. Mandando o serviço, só entram os horários de quem faz aquele serviço, na duração dele.',
    precisa: 'data',
    opcionais: 'hora, procedimento, profissional_id, duracao_minutos',
    corpo: {
      data: '2026-05-15',
      hora: '09:00',
      duracao_minutos: 60,
    },
  },
  {
    rota: 'marcar',
    titulo: 'Marcar agendamento',
    metodo: 'POST',
    resumo: 'Sem profissional_id, o sistema escolhe uma agenda livre entre quem faz o serviço. O whatsapp é a identidade: se não existir, o contato é criado com o nome informado.',
    precisa: 'nome, whatsapp, procedimento, data_hora',
    opcionais: 'profissional_id, duracao_minutos (padrão: a do serviço), interesse, chave_externa',
    corpo: {
      nome: 'Maria Pereira',
      whatsapp: '5511987654321',
      // Um nome de verdade aqui quebrava: desde a 0023 o banco recusa serviço
      // fora do catálogo, e cada empresa tem o seu. Placeholder, como o id.
      procedimento: 'COLE_O_NOME_DE_UM_SERVICO',
      data_hora: '2026-05-15T09:00',
      chave_externa: 'msg_abc123',
    },
  },
  {
    rota: 'consultas',
    titulo: 'Consultar agendamentos do cliente',
    metodo: 'POST',
    resumo: 'Só os agendamentos ativos e futuros. É daqui que o agente tira o id para cancelar ou remarcar.',
    precisa: 'whatsapp',
    opcionais: '—',
    corpo: {
      whatsapp: '5511987654321',
    },
  },
  {
    rota: 'cancelar',
    titulo: 'Cancelar agendamento',
    metodo: 'POST',
    resumo: 'O whatsapp é conferência: se vier, o sistema valida que o agendamento é mesmo daquele número. Evita que um id trocado cancele o agendamento de outra pessoa.',
    precisa: 'consulta_id',
    opcionais: 'whatsapp, motivo',
    corpo: {
      consulta_id: 'COLE_O_ID_DO_AGENDAMENTO',
      whatsapp: '5511987654321',
      motivo: 'Cliente pediu pelo WhatsApp',
    },
  },
  {
    rota: 'remarcar',
    titulo: 'Remarcar agendamento',
    metodo: 'POST',
    resumo: 'Operação atômica — nunca cancela e cria. Se o segundo passo falhasse, o cliente ficaria sem agendamento nenhum e ninguém perceberia.',
    precisa: 'consulta_id, nova_data_hora',
    opcionais: 'profissional_id, whatsapp',
    corpo: {
      consulta_id: 'COLE_O_ID_DO_AGENDAMENTO',
      nova_data_hora: '2026-05-16T14:00',
      whatsapp: '5511987654321',
    },
  },
]

/** Endereço da função implantada, derivado da mesma env var do cliente Supabase. */
export const BASE_API = `${SUPABASE_URL}/functions/v1/agenda`

/**
 * cURL pronto para o **Import cURL** do nó HTTP do n8n, que monta o nó sozinho.
 *
 * O corpo sai em uma linha só: o importador do n8n aceita, e o que é uma linha
 * sobrevive melhor a copiar e colar do que um JSON indentado.
 */
export function montarCurl(ep: EndpointApi, token: string): string {
  const partes = [
    `curl -X ${ep.metodo} '${BASE_API}/${ep.rota}'`,
    `-H 'X-Api-Key: ${token}'`,
  ]
  if (ep.corpo) {
    partes.push(`-H 'Content-Type: application/json'`)
    partes.push(`-d '${JSON.stringify(ep.corpo)}'`)
  }
  return partes.join(' \\\n  ')
}
