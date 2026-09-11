/**
 * API da Agenda — consumida pelo Agente de IA via n8n (nó HTTP).
 *
 * Contrato: API_AGENTE.md, na raiz do repositório.
 *
 * Esta camada é fina de propósito. As regras de negócio moram em funções SQL
 * (migração 0004), onde são atômicas e onde o fuso horário funciona de verdade.
 * Aqui só acontecem três coisas: conferir o token, chamar a função certa e
 * montar a frase que o paciente vai ouvir.
 *
 * PRINCÍPIO DAS RESPOSTAS: quem lê isto vai FALAR com alguém no WhatsApp. Toda
 * resposta traz `mensagem`, uma frase pronta — inclusive as falhas técnicas, com
 * texto neutro. Sem isso o agente improvisa, ou repassa detalhe técnico para o
 * paciente. O código do problema fica em `motivo`, que nunca sai da máquina.
 *
 * SEM DEPENDÊNCIA NENHUMA, DE PROPÓSITO: este runtime sobe com `--no-remote` e
 * recusa buscar qualquer módulo externo no boot — inclusive o `supabase-js`. A
 * função falha inteira com BOOT_ERROR antes de rodar uma linha. Como tudo que
 * precisamos é falar com o PostgREST, `fetch` resolve e não há o que quebrar.
 */

const URL_BASE = Deno.env.get('SUPABASE_URL')!
const CHAVE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CABECALHOS = {
  apikey: CHAVE,
  Authorization: `Bearer ${CHAVE}`,
  'Content-Type': 'application/json',
}

/** Chama uma função SQL. Retorna array (funções TABLE) ou escalar. */
async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${nome}`, {
    method: 'POST', headers: CABECALHOS, body: JSON.stringify(args),
  })
  if (!r.ok) throw new Error(`rpc ${nome}: ${r.status} ${await r.text()}`)
  return await r.json() as T
}

/** Leitura direta de tabela. O caminho já vem com os filtros do PostgREST. */
async function selecionar<T>(caminho: string): Promise<T[]> {
  const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, { headers: CABECALHOS })
  if (!r.ok) throw new Error(`select ${caminho}: ${r.status} ${await r.text()}`)
  return await r.json() as T[]
}

const FUSO_PADRAO = 'America/Sao_Paulo'

const MENSAGEM_GENERICA = 'Não consegui acessar a agenda agora. Só um instante, por favor.'

/** Frase falável para cada recusa. O `motivo` é para a máquina; isto, para o ouvido. */
const FRASES: Record<string, string> = {
  horario_ocupado: 'Esse horário já está ocupado.',
  sem_profissional_livre: 'Não tenho nenhum profissional livre nesse horário.',
  fora_expediente: 'Nesse dia e horário não tem atendimento.',
  profissional_inexistente: 'Não encontrei esse profissional.',
  whatsapp_invalido: 'Preciso de um número de WhatsApp válido, com o código do país.',
  dados_invalidos: 'Faltou alguma informação para eu concluir.',
  data_invalida: 'Não entendi a data.',
  nao_encontrada: 'Não encontrei esse agendamento.',
  nao_pertence: 'Esse agendamento não é desse número de WhatsApp.',
  ja_cancelada: 'Esse agendamento já estava cancelado.',
  nao_cancelavel: 'Esse agendamento já foi realizado e não pode ser cancelado.',
  paciente_nao_encontrado: 'Não encontrei nenhum cadastro com esse número.',
  token_invalido: MENSAGEM_GENERICA,
  token_ausente: MENSAGEM_GENERICA,
  metodo_invalido: MENSAGEM_GENERICA,
  rota_invalida: MENSAGEM_GENERICA,
  corpo_invalido: 'Faltou alguma informação para eu concluir.',
  erro_interno: MENSAGEM_GENERICA,

  // As duas recusas de NEGÓCIO das migrações 0018 e 0023. Sem elas aqui, o
  // `?? MENSAGEM_GENERICA` respondia "não consegui acessar a agenda agora" —
  // a frase de servidor fora do ar — para quem só tinha escrito o nome de um
  // procedimento fora do catálogo. Manda procurar defeito na máquina, e o
  // defeito está no pedido.
  //
  // A Letícia nunca caiu nisso: ela tem frase própria em `ferramentas.ts`.
  // Foi a porta de fora que ficou para trás quando as regras entraram.
  // A rota continua `/procedimentos`: é contrato de quem já integra, e só a
  // frase é que mudou de vocabulário.
  procedimento_desconhecido:
    'Esse serviço não está no catálogo. '
    + 'Confira os nomes exatos em GET /procedimentos.',
  exige_avaliacao:
    'Esse serviço começa por outro, que precisa ser marcado antes.',

  // A recusa da 0027. Em `marcar` e `disponibilidade` ela sai por
  // `recusaQuemFaz()`, que diz quem faz; esta frase fica para `remarcar`,
  // cuja função SQL não devolve a lista.
  profissional_nao_faz: 'Esse profissional não faz esse serviço.',
}

/**
 * `profissional_nao_faz` com a saída junto: quem faz. Uma recusa que só diz
 * "não" obriga quem integra a adivinhar o próximo nome.
 */
function recusaQuemFaz(quem: string[]): Response {
  return json({
    ok: false,
    motivo: 'profissional_nao_faz',
    quem_faz: quem,
    mensagem: quem.length
      ? `Esse profissional não faz esse serviço. Quem faz: ${quem.join(', ')}.`
      : 'No momento, nenhum profissional faz esse serviço.',
  })
}

/* ──────────────────────────────────────────────
   Datas

   ⚠️ CÓPIA. As duas funções abaixo existem também em
   `supabase/functions/_shared/tempo.ts`, palavra por palavra, porque a
   Letícia precisa exatamente da mesma conversão antes de chamar as mesmas
   funções SQL. Esta função aqui está publicada SEM NENHUM IMPORT, de
   propósito (o runtime sobe com `--no-remote`), e trocar isso arriscaria os
   sete endpoints por uma dedução não testada.

   **Mudou a regra aqui, mude lá.** Se divergirem, as duas portas passam a
   marcar em horas diferentes — e foi justamente a falta desta conversão do
   outro lado que gravou consulta três horas mais cedo em produção.
────────────────────────────────────────────── */

/** Deslocamento do fuso, em minutos, no instante dado. Cobre horário de verão. */
function offsetDoFuso(instante: Date, fuso: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = Object.fromEntries(dtf.formatToParts(instante).map((x) => [x.type, x.value]))
  const comoSeFosseUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return (comoSeFosseUtc - instante.getTime()) / 60000
}

/**
 * Texto → instante absoluto.
 *
 * Aceita '2026-05-15T09:00' (sem fuso, interpretado no fuso da clínica) e
 * '2026-05-15T09:00:00-03:00'. O primeiro caso é o que o agente costuma mandar,
 * e tratá-lo como UTC deslocaria toda consulta em três horas — silenciosamente.
 */
function paraInstante(texto: string, fuso: string): Date | null {
  if (!texto) return null
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(texto)) {
    const d = new Date(texto)
    return isNaN(d.getTime()) ? null : d
  }
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  const provisorio = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi))
  const off = offsetDoFuso(provisorio, fuso)
  return new Date(provisorio.getTime() - off * 60000)
}

function hora(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

/** 'quinta, 15/05/2026' */
function dataPorExtenso(iso: string, fuso: string): string {
  const d = new Date(iso)
  const semana = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, weekday: 'long' }).format(d)
  const curta = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d)
  return `${semana.replace('-feira', '')}, ${curta}`
}

/** '09:00, 10:30 e 14:00' */
function listarHoras(horarios: string[], fuso: string): string {
  const hs = horarios.map((h) => hora(h, fuso))
  if (hs.length === 1) return hs[0]
  return `${hs.slice(0, -1).join(', ')} e ${hs[hs.length - 1]}`
}

/* ──────────────────────────────────────────────
   Respostas
────────────────────────────────────────────── */

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function recusa(motivo: string, status = 200, mensagem?: string): Response {
  return json({ ok: false, motivo, mensagem: mensagem ?? FRASES[motivo] ?? MENSAGEM_GENERICA }, status)
}

/** Formato das funções SQL de escrita: marcar, cancelar e remarcar. */
interface Resultado {
  ok: boolean
  motivo: string | null
  consulta_id?: string
  data_hora: string
  profissional: string | null
  /**
   * Em `exige_avaliacao`: o nome da consulta que precisa vir antes. Em
   * `profissional_nao_faz` (0027): quem faz, separado por vírgula.
   */
  sugestao?: string | null
}

/* ──────────────────────────────────────────────
   Autenticação
────────────────────────────────────────────── */

async function sha256(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/* ──────────────────────────────────────────────
   Handler
────────────────────────────────────────────── */

Deno.serve(async (req) => {
  try {
    // ── Token ──────────────────────────────────────────────────────────────
    const chave = req.headers.get('x-api-key') ?? ''
    if (!chave) return recusa('token_ausente', 401)

    const tokenId = await rpc<string | null>('api_token_valido', { p_hash: await sha256(chave) })
    if (!tokenId) return recusa('token_invalido', 401)

    // ── Fuso da clínica ────────────────────────────────────────────────────
    const cfg = await selecionar<{ fuso_horario: string }>('configuracoes_clinica?select=fuso_horario&limit=1')
    const fuso = cfg[0]?.fuso_horario ?? FUSO_PADRAO

    // ── Rota ───────────────────────────────────────────────────────────────
    const rota = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? ''

    let corpo: Record<string, unknown> = {}
    if (req.method === 'POST') {
      try {
        corpo = await req.json()
      } catch {
        return recusa('corpo_invalido', 400)
      }
    }

    switch (rota) {
      /* ─────────────────────────────────────────────────────────────────── */
      case 'profissionais': {
        if (req.method !== 'GET') return recusa('metodo_invalido', 400)
        type Linha = {
          id: string; nome: string; sobrenome: string
          profissional_servicos: { servicos_clinica: { nome: string; ativo: boolean } | null }[] | null
        }
        const data = await selecionar<Linha>(
          'profissionais?select=id,nome,sobrenome,profissional_servicos(servicos_clinica(nome,ativo))'
          + '&ativo=eq.true&order=nome',
        )
        return json({
          ok: true,
          profissionais: data.map((p) => {
            const lista = (p.profissional_servicos ?? [])
              .map((ps) => ps.servicos_clinica)
              .filter((s): s is { nome: string; ativo: boolean } => !!s)
            return {
              id: p.id,
              nome: `${p.nome} ${p.sobrenome ?? ''}`.trim(),
              // Os serviços que a pessoa faz (0027). SEM LISTA = FAZ TODOS, e
              // `faz_todos` diz isso com todas as letras: uma lista vazia
              // também aparece em quem só tem serviços desativados, e as duas
              // coisas não podem ser confundidas por quem integra.
              faz_todos: lista.length === 0,
              servicos: lista.filter((s) => s.ativo).map((s) => s.nome),
            }
          }),
        })
      }

      /* ─────────────────────────────────────────────────────────────────── */
      case 'procedimentos': {
        if (req.method !== 'GET') return recusa('metodo_invalido', 400)
        const data = await selecionar<{ nome: string }>(
          'servicos_clinica?select=nome&ativo=eq.true&order=nome',
        )
        return json({ ok: true, procedimentos: data.map((s) => s.nome) })
      }

      /* ─────────────────────────────────────────────────────────────────── */
      case 'disponibilidade': {
        if (req.method !== 'POST') return recusa('metodo_invalido', 400)
        const data = String(corpo.data ?? '')
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return recusa('data_invalida')

        // Sem duração explícita, vale a do serviço — e sem serviço, 60, que era
        // o padrão de sempre. O `null` é que deixa o SQL decidir.
        const duracao = corpo.duracao_minutos ? Number(corpo.duracao_minutos) : null
        const profissional = (corpo.profissional_id as string) ?? null
        // O serviço (0027): só entram os horários de quem faz. Opcional — sem
        // ele, a resposta é a de antes, com todo mundo.
        const procedimento = typeof corpo.procedimento === 'string' && corpo.procedimento.trim()
          ? corpo.procedimento.trim()
          : null

        // Nome fora do catálogo não pode virar "sem filtro" em silêncio: seria
        // oferecer horário de quem não faz. `servico_a_agendar` compara do
        // mesmo jeito que o `agenda_marcar` (sem caixa, sem espaço sobrando).
        if (procedimento) {
          const alvo = await rpc<{ nome: string }[]>('servico_a_agendar', { p_nome: procedimento })
          if (!alvo.length) return recusa('procedimento_desconhecido')
        }

        if (profissional) {
          const existe = await selecionar<{ id: string }>(
            `profissionais?select=id&id=eq.${encodeURIComponent(profissional)}&ativo=eq.true&limit=1`,
          )
          if (existe.length === 0) return recusa('profissional_inexistente')

          // Pediu alguém que não faz o serviço: a resposta é quem faz, e não
          // uma lista vazia de horários que pareceria agenda lotada.
          if (procedimento) {
            const quemFaz = await rpc<{ profissional_id: string; nome: string }[]>(
              'agenda_quem_faz', { p_procedimento: procedimento },
            )
            if (!quemFaz.some((q) => q.profissional_id === profissional)) {
              return recusaQuemFaz(quemFaz.map((q) => q.nome))
            }
          }
        }

        const slots = await rpc<{ horario: string }[]>('agenda_horarios_disponiveis', {
          p_data: data, p_profissional: profissional, p_duracao: duracao, p_procedimento: procedimento,
        })

        const horarios: string[] = (slots ?? []).map((s) => s.horario)

        // Dia lotado: devolve o próximo com vaga. Sem isso o agente pergunta
        // dia a dia até acertar.
        if (horarios.length === 0) {
          const proxima = await rpc<string | null>('agenda_proxima_vaga', {
            p_a_partir_de: data, p_profissional: profissional, p_duracao: duracao,
            p_procedimento: procedimento,
          })
          return json({
            ok: true,
            horarios: [],
            proxima_data: proxima ?? null,
            mensagem: proxima
              ? `Não tenho horário em ${dataPorExtenso(`${data}T12:00`, fuso)}. O mais próximo é ${dataPorExtenso(proxima, fuso)}, às ${hora(proxima, fuso)}.`
              : 'Não encontrei horário disponível nos próximos dias.',
          })
        }

        // Com `hora`, responde à pergunta que foi feita e já oferece alternativa.
        if (corpo.hora) {
          const pedido = paraInstante(`${data}T${String(corpo.hora).slice(0, 5)}`, fuso)
          if (!pedido) return recusa('data_invalida')
          const alvo = pedido.toISOString()
          const livre = horarios.some((h) => new Date(h).toISOString() === alvo)
          const outros = horarios.filter((h) => new Date(h).toISOString() !== alvo)
          return json({
            ok: true,
            disponivel: livre,
            horarios,
            mensagem: livre
              ? `${dataPorExtenso(alvo, fuso)} às ${hora(alvo, fuso)} está livre, posso marcar.`
              : outros.length > 0
                ? `${dataPorExtenso(alvo, fuso)} às ${hora(alvo, fuso)} já está ocupado, mas tenho ${listarHoras(outros, fuso)}.`
                : `${dataPorExtenso(alvo, fuso)} às ${hora(alvo, fuso)} já está ocupado e não tenho outro horário nesse dia.`,
          })
        }

        return json({
          ok: true,
          horarios,
          mensagem: `${dataPorExtenso(horarios[0], fuso)}, tenho ${listarHoras(horarios, fuso)}.`,
        })
      }

      /* ─────────────────────────────────────────────────────────────────── */
      case 'marcar': {
        if (req.method !== 'POST') return recusa('metodo_invalido', 400)
        const quando = paraInstante(String(corpo.data_hora ?? ''), fuso)
        if (!quando) return recusa('data_invalida')

        const data = await rpc<Resultado[]>('agenda_marcar', {
          p_nome: corpo.nome ?? null,
          p_whatsapp: corpo.whatsapp ?? '',
          p_procedimento: corpo.procedimento ?? '',
          p_data_hora: quando.toISOString(),
          p_profissional_id: corpo.profissional_id ?? null,
          // Sem duração explícita, vale a do procedimento em servicos_clinica.
          // Quem já mandava um número continua mandando.
          p_duracao: corpo.duracao_minutos ? Number(corpo.duracao_minutos) : null,
          p_chave_externa: corpo.chave_externa ?? null,
          p_interesse: corpo.interesse ?? null,
        })

        const r = data?.[0]

        // A porta de entrada. A frase precisa do NOME da porta, que vem do
        // banco — por isso não cabe no mapa fixo de FRASES. "Começa por", e
        // não "passa pela": o nome é dado, e o artigo erraria o gênero de
        // "o Orçamento".
        if (r?.motivo === 'exige_avaliacao') {
          const porta = r.sugestao ?? 'o serviço de entrada'
          return json({
            ok: false,
            motivo: 'exige_avaliacao',
            marque_no_lugar: porta,
            mensagem:
              `Esse serviço começa por ${porta}. ` +
              `Posso marcar ${porta} para você?`,
          })
        }

        // O profissional pedido não faz este serviço (0027). A função SQL
        // devolve em `sugestao` quem faz.
        if (r?.motivo === 'profissional_nao_faz') {
          return recusaQuemFaz(r.sugestao ? r.sugestao.split(', ') : [])
        }

        if (!r?.ok) return recusa(r?.motivo ?? 'erro_interno')

        const nome = String(corpo.nome ?? '').trim()
        return json({
          ok: true,
          id: r.consulta_id,
          data_hora: r.data_hora,
          profissional: r.profissional,
          mensagem: `${nome ? `${nome}, s` : 'S'}eu agendamento foi marcado com sucesso${r.profissional ? ` com o profissional ${r.profissional}` : ''} para ${dataPorExtenso(r.data_hora, fuso)} às ${hora(r.data_hora, fuso)}.`,
        })
      }

      /* ─────────────────────────────────────────────────────────────────── */
      case 'consultas': {
        if (req.method !== 'POST') return recusa('metodo_invalido', 400)
        const whats = String(corpo.whatsapp ?? '').replace(/\D/g, '')
        if (whats.length < 10) return recusa('whatsapp_invalido')

        const lead = await selecionar<{ id: string }>(
          `crm_clinica_dados?select=id&whatsapp_lead=eq.${whats}&limit=1`,
        )
        if (lead.length === 0) return recusa('paciente_nao_encontrado')

        type Linha = {
          id: string; data_consulta: string; procedimento: string
          profissionais: { nome: string; sobrenome: string } | null
        }
        const data = await selecionar<Linha>(
          'consultas?select=id,data_consulta,procedimento,profissionais(nome,sobrenome)' +
          `&lead_id=eq.${lead[0].id}&status=eq.agendada` +
          `&data_consulta=gte.${encodeURIComponent(new Date().toISOString())}` +
          '&order=data_consulta',
        )

        const consultas = data.map((c) => ({
          id: c.id,
          data_hora: c.data_consulta,
          profissional: c.profissionais
            ? `${c.profissionais.nome} ${c.profissionais.sobrenome ?? ''}`.trim()
            : null,
          procedimento: c.procedimento,
        }))

        if (consultas.length === 0) {
          return json({ ok: true, consultas: [], mensagem: 'Você não tem nenhum agendamento no momento.' })
        }

        const p = consultas[0]
        return json({
          ok: true,
          consultas,
          mensagem: consultas.length === 1
            ? `Você tem um agendamento em ${dataPorExtenso(p.data_hora, fuso)}, às ${hora(p.data_hora, fuso)}${p.profissional ? `, com ${p.profissional}` : ''}.`
            : `Você tem ${consultas.length} agendamentos. O próximo é em ${dataPorExtenso(p.data_hora, fuso)}, às ${hora(p.data_hora, fuso)}${p.profissional ? `, com ${p.profissional}` : ''}.`,
        })
      }

      /* ─────────────────────────────────────────────────────────────────── */
      case 'cancelar': {
        if (req.method !== 'POST') return recusa('metodo_invalido', 400)
        if (!corpo.consulta_id) return recusa('dados_invalidos')

        const data = await rpc<Resultado[]>('agenda_cancelar', {
          p_consulta_id: corpo.consulta_id,
          p_whatsapp: corpo.whatsapp ?? null,
          p_motivo: corpo.motivo ?? null,
        })

        const r = data?.[0]
        if (!r?.ok) return recusa(r?.motivo ?? 'erro_interno')

        return json({
          ok: true,
          data_hora: r.data_hora,
          mensagem: `Seu agendamento de ${dataPorExtenso(r.data_hora, fuso)} às ${hora(r.data_hora, fuso)}${r.profissional ? ` com ${r.profissional}` : ''} foi cancelado.`,
        })
      }

      /* ─────────────────────────────────────────────────────────────────── */
      case 'remarcar': {
        if (req.method !== 'POST') return recusa('metodo_invalido', 400)
        if (!corpo.consulta_id) return recusa('dados_invalidos')
        const quando = paraInstante(String(corpo.nova_data_hora ?? ''), fuso)
        if (!quando) return recusa('data_invalida')

        const data = await rpc<Resultado[]>('agenda_remarcar', {
          p_consulta_id: corpo.consulta_id,
          p_nova_data_hora: quando.toISOString(),
          p_profissional_id: corpo.profissional_id ?? null,
          p_whatsapp: corpo.whatsapp ?? null,
        })

        const r = data?.[0]
        if (!r?.ok) return recusa(r?.motivo ?? 'erro_interno')

        return json({
          ok: true,
          data_hora: r.data_hora,
          profissional: r.profissional,
          mensagem: `Seu agendamento foi remarcado para ${dataPorExtenso(r.data_hora, fuso)}, às ${hora(r.data_hora, fuso)}${r.profissional ? `, com ${r.profissional}` : ''}.`,
        })
      }

      /* ─────────────────────────────────────────────────────────────────── */
      default:
        return recusa('rota_invalida', 404)
    }
  } catch (e) {
    console.error('erro inesperado:', e)
    return recusa('erro_interno', 500)
  }
})
