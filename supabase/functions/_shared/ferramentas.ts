/**
 * As ferramentas da Letícia.
 *
 * Cada uma chama uma função SQL que JÁ EXISTIA (migração 0004) — a mesma que a
 * API `agenda/` usa. A regra de jornada, a escolha de profissional livre e a
 * trava de horário sobreposto continuam num lugar só.
 *
 * DUAS COISAS QUE O MODELO NÃO PREENCHE, de propósito:
 *
 *   1. O WhatsApp e o id do lead — vêm do contexto da conversa. Se fossem
 *      parâmetro, um dia ele marcaria horário para um número inventado.
 *   2. O uuid do profissional — o modelo trabalha com NOME, e o código resolve.
 *      Uuid em prompt é convite para alucinação.
 *
 * O VOCABULÁRIO É NEUTRO, e é contrato com o prompt. Os nomes das ferramentas
 * e dos campos (`marcar_agendamento`, `servico`, `profissional`) são o que o
 * modelo chama — valem para qualquer ramo, e o `prompt.md` de todo kit usa
 * estes. As colunas do banco continuam com os nomes de origem
 * (`procedimentos_interesse`, `consultas`): quem traduz é este arquivo.
 */

import { rpc, selecionar, atualizar } from './db.ts'
import { paraInstante } from './tempo.ts'
import type { DefinicaoFerramenta } from './llm.ts'

export interface Contexto {
  leadId: string
  whatsapp: string
  fuso: string
}

const TEXTO = { type: 'string' }

/**
 * A lista de ferramentas, com o catálogo da clínica **dentro do schema**.
 *
 * ── POR QUE `enum`, E NÃO UM PEDIDO NO PROMPT ──────────────────────────────
 *
 * "Use o nome exato do procedimento" é um pedido, e pedido o modelo às vezes
 * atende. `enum` no JSON Schema é outra coisa: os dois fornecedores obrigam a
 * saída a ser um dos valores da lista. Ele **não consegue** escrever "lente pro
 * dente" nem "Clareamento" sem o "Dental" — a escolha é entre os vinte nomes
 * cadastrados, ou nada.
 *
 * Isso é o que transforma "qual o procedimento mais procurado?" numa pergunta
 * com resposta. Grafia livre não soma: "Lentes de Contato", "lentes" e "lente
 * de contato" viram três linhas do mesmo tratamento, e o relatório mente sem
 * avisar.
 *
 * ⚠️ **A lista é montada a cada mensagem**, com os procedimentos ATIVOS. Uma
 * lista fixa no código envelheceria no dia em que a clínica cadastrasse o
 * vigésimo primeiro — e o sintoma seria a Letícia não conseguir marcar algo que
 * está na tela dela.
 *
 * O banco continua conferindo por baixo (`0022` e `0023`): `enum` é o que
 * impede o erro, a trigger é o que garante que ele não passe.
 */
export function ferramentasCom(procedimentos: string[]): DefinicaoFerramenta[] {
  // Sem catálogo (falha de leitura), volta ao texto livre em vez de travar a
  // secretária inteira. Um `enum` vazio é recusado pelos dois fornecedores, e o
  // resultado seria ela parar de responder — muito pior que uma grafia solta.
  const lista = procedimentos.filter((p) => p.trim())
  const doCatalogo = lista.length
    ? { type: 'string', enum: lista }
    : { type: 'string' }

  return FERRAMENTAS.map((f) => {
    const props = f.parametros.properties as Record<string, unknown> | undefined
    if (!props) return f

    const novas: Record<string, unknown> = { ...props }
    let mudou = false

    for (const campo of ['servico', 'interesse'] as const) {
      if (campo in novas) {
        novas[campo] = { ...doCatalogo, description: (novas[campo] as { description?: string }).description }
        mudou = true
      }
    }
    if ('servicos_interesse' in novas) {
      const atual = novas.servicos_interesse as { description?: string }
      novas.servicos_interesse = {
        type: 'array',
        items: doCatalogo,
        description: atual.description,
      }
      mudou = true
    }

    return mudou ? { ...f, parametros: { ...f.parametros, properties: novas } } : f
  })
}

export const FERRAMENTAS: DefinicaoFerramenta[] = [
  {
    nome: 'ver_horarios_livres',
    descricao:
      'Mostra os horários realmente livres na agenda. Use sempre que a ' +
      'pessoa falar de dia, horário ou perguntar se tem vaga. Nunca ' +
      'confirme um horário sem chamar isto antes.',
    parametros: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Dia desejado, no formato AAAA-MM-DD.' },
        hora: {
          type: 'string',
          description: 'Hora específica, HH:MM. Só envie se a pessoa disse uma hora.',
        },
        profissional: {
          type: 'string',
          description: 'Nome do profissional. Só envie se a pessoa pediu alguém específico.',
        },
        servico: {
          type: 'string',
          description:
            'O serviço que vai ser marcado, como está na lista. Mande sempre que ' +
            'souber: só entram os horários de quem faz esse serviço, com a ' +
            'duração dele.',
        },
      },
      required: ['data'],
      additionalProperties: false,
    },
  },
  {
    nome: 'marcar_agendamento',
    descricao:
      'Marca o agendamento de verdade na agenda. Só chame depois de confirmar ' +
      'o horário com ver_horarios_livres E de ter o nome completo da pessoa. ' +
      'Se a lista de serviços disser "Antes deste, marque X", o que se marca ' +
      'é X.',
    parametros: {
      type: 'object',
      properties: {
        nome_completo: TEXTO,
        servico: { type: 'string', description: 'O serviço, como está na lista.' },
        data_hora: {
          type: 'string',
          description: 'AAAA-MM-DDTHH:MM, na hora local — a mesma que a pessoa fala.',
        },
        profissional: {
          type: 'string',
          description: 'Nome do profissional. Deixe vazio para o sistema escolher quem está livre.',
        },
        interesse: {
          type: 'string',
          description:
            'Quando o que se marca é o serviço de entrada ("Antes deste, marque ' +
            'X"), o serviço que a pessoa procura de verdade. É o que o ' +
            'profissional vê na agenda.',
        },
      },
      required: ['nome_completo', 'servico', 'data_hora'],
      additionalProperties: false,
    },
  },
  {
    nome: 'ver_meus_agendamentos',
    descricao:
      'Lista os agendamentos já marcados desta pessoa. Use antes de remarcar ' +
      'ou cancelar — é de onde sai o identificador do agendamento.',
    parametros: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    nome: 'remarcar_agendamento',
    descricao:
      'Muda um agendamento existente para outro dia ou horário. Quando a ' +
      'pessoa só tem um agendamento marcado, não precisa do agendamento_id.',
    parametros: {
      type: 'object',
      properties: {
        agendamento_id: {
          type: 'string',
          description:
            'Só quando ela tiver MAIS DE UM marcado. Vem de ver_meus_agendamentos.',
        },
        nova_data_hora: { type: 'string', description: 'AAAA-MM-DDTHH:MM.' },
      },
      required: ['nova_data_hora'],
      additionalProperties: false,
    },
  },
  {
    nome: 'cancelar_agendamento',
    descricao:
      'Desmarca um agendamento. Antes de chamar, pergunte se a pessoa ' +
      'prefere remarcar. Quando ela só tem um marcado, não precisa do ' +
      'agendamento_id.',
    parametros: {
      type: 'object',
      properties: {
        agendamento_id: {
          type: 'string',
          description:
            'Só quando ela tiver MAIS DE UM marcado. Vem de ver_meus_agendamentos.',
        },
        motivo: TEXTO,
      },
      additionalProperties: false,
    },
  },
  {
    nome: 'detalhes_do_servico',
    descricao:
      'Traz a explicação completa de UM serviço, como a empresa escreveu: ' +
      'como funciona, quanto tempo leva e o que costuma gerar dúvida. Use ' +
      'quando a pessoa quiser saber mais do que a frase curta que você já ' +
      'tem — e sempre que ela trouxer medo, dúvida ou objeção sobre um serviço.',
    parametros: {
      type: 'object',
      properties: {
        servico: {
          type: 'string',
          description: 'O nome do serviço, como está na lista.',
        },
      },
      required: ['servico'],
      additionalProperties: false,
    },
  },
  {
    nome: 'historico_do_cliente',
    descricao:
      'Abre o histórico de atendimento desta pessoa: o que ela já fez aqui, ' +
      'quando, e com qual profissional. Use quando ela falar do passado ' +
      '("da última vez", "o que eu fiz mesmo?", "aquele serviço") ou quando ' +
      'precisar do que já foi feito para responder. Só traz o que já ' +
      'aconteceu — para agendamento futuro, use ver_meus_agendamentos.',
    parametros: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    nome: 'atualizar_ficha',
    descricao:
      'Guarda o que você descobriu na conversa. Use assim que souber de algo ' +
      'novo, sem esperar o fim do atendimento.',
    parametros: {
      type: 'object',
      properties: {
        nome: {
          type: 'string',
          description:
            'O nome que a PESSOA disse. Nunca um rótulo genérico como ' +
            '"cliente", "contato" ou "lead" — sem o nome dito, não mande este campo.',
        },
        servicos_interesse: {
          type: 'array',
          items: TEXTO,
          description:
            'TUDO o que esta pessoa procura, e não só o assunto de agora. ' +
            'Mande a lista inteira toda vez — ela substitui a anterior, não ' +
            'soma. Só nomes exatos da lista de serviços.',
        },
        resumo: {
          type: 'string',
          description:
            'A história do atendimento em TEXTO CORRIDO, na ordem em que as ' +
            'coisas aconteceram — um parágrafo, nunca lista nem tópicos. Fale ' +
            'da pessoa na terceira pessoa, pelo nome assim que souber ' +
            '("Carlos chegou porque…"). Conte o que ela procura, o que ' +
            'contou de si, o que mandou e perguntou, o que a preocupa, e em ' +
            'que pé ficou. O tamanho acompanha a conversa: duas mensagens ' +
            'pedem uma frase. Com MAIS DE 10 MENSAGENS, nunca menos de 4 ' +
            'frases — cada assunto da conversa vira pelo menos uma oração. NÃO ' +
            'pode contradizer a conversa. Reescreva o texto inteiro a cada ' +
            'vez, do começo até agora. Exemplo do tom e da forma: "Carlos ' +
            'chegou perguntando o preço, porque queria resolver antes do fim ' +
            'do mês. Mandou uma foto do que tinha em mente e insistiu para ' +
            'saber minha opinião sobre qual serviço escolher; expliquei que ' +
            'quem indica é o profissional. Perguntou o endereço. Aceitou ' +
            'marcar, escolheu o meio-dia e depois pediu para remarcar por ' +
            'causa de um compromisso. Agendamento marcado para 02/09 às 15h, ' +
            'com o Marcos."',
        },
      },
      additionalProperties: false,
    },
  },
]

// ---------------------------------------------------------------------------

function hora(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

function dataHora(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

/**
 * Isto é um rótulo, e não o nome de uma pessoa.
 *
 * O modelo chamou `atualizar_ficha` com `nome: "cliente"` antes de perguntar
 * como a pessoa se chamava — e a partir dali o CRM tinha um lead chamado
 * "cliente", com o nome de verdade ("Carlos Menezes Duarte") dito dez
 * minutos depois e jogado fora.
 *
 * A lista é curta de propósito: ela veta o que é claramente um espaço
 * reservado, e deixa passar qualquer coisa que pareça nome. Um sobrenome raro
 * nunca pode ser recusado aqui.
 */
const NOMES_GENERICOS = new Set([
  'cliente', 'paciente', 'lead', 'contato', 'usuario', 'usuário', 'pessoa',
  'nome', 'sem nome', 'não informado', 'nao informado', 'desconhecido',
  'anonimo', 'anônimo', 'n/a', 'na', '-',
])

function ehNomeGenerico(nome: string): boolean {
  const limpo = nome.trim().toLowerCase().replace(/\s+/g, ' ')

  // ⚠️ `�` É TEXTO JÁ ESTRAGADO, e ele volta pela ficha.
  //
  // O caractere de substituição aparece quando alguma etapa leu bytes UTF-8
  // com a codificação errada — "Vitória" vira "Vit�ria". Aconteceu numa
  // escrita manual pelo terminal do Windows, não pelo agente: as 44 mensagens
  // da conversa estavam intactas.
  //
  // O perigo não é a escrita original, é a CÓPIA. A Letícia lê o nome na ficha
  // e o repete de boa-fé na próxima `atualizar_ficha` — e aí o erro deixa de
  // ter culpado e passa a se manter sozinho. Recusar aqui faz a ficha voltar a
  // ficar vazia, e vazia ela pergunta de novo.
  if (limpo.includes('�')) return true

  // Só dígitos também não é nome: é o telefone voltando pela porta dos fundos.
  return NOMES_GENERICOS.has(limpo) || /^[\d\s()+-]+$/.test(limpo)
}

/**
 * O resumo, como texto corrido — mesmo quando o modelo entregou uma lista.
 *
 * O resumo é lido por uma pessoa, na ficha do lead, e a forma dele é
 * **narrativa**: quem chegou, o que queria, o que aconteceu, em que pé ficou.
 * Foi assim que a clínica pediu, e é como se conta um caso para a colega que
 * vai assumir.
 *
 * Mas o modelo às vezes cai na lista — é o formato natural dele para "resuma".
 * Recusar seria perder a memória da conversa por causa de um hífen; pedir de
 * novo depende de ele colaborar na segunda tentativa. **Tirar os marcadores é
 * determinístico.**
 *
 * O que sai daqui não vira uma boa narrativa por mágica: vira uma sequência de
 * frases, que é bem melhor que uma lista solta e bem pior que o parágrafo que
 * o prompt pede. É rede de segurança, não o caminho principal.
 */
function arrumarResumo(bruto: string): string {
  const texto = bruto.trim()
  if (!texto) return ''

  // Só age quando é lista de verdade: duas ou mais linhas com marcador.
  const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean)
  const comMarcador = linhas.filter((l) => /^[-*•]\s+/.test(l))
  if (comMarcador.length < 2) return texto

  return linhas
    .map((l) => l.replace(/^[-*•]\s+/, ''))
    .map((l) => (/[.!?]$/.test(l) ? l : l + '.'))
    .join(' ')
}

/** Nome digitado pela pessoa → uuid do profissional. Nulo se não achar. */
async function acharProfissional(nome?: string): Promise<string | null> {
  if (!nome || !nome.trim()) return null
  const busca = encodeURIComponent(`%${nome.trim().split(/\s+/)[0]}%`)
  const achados = await selecionar<{ id: string }>(
    `profissionais?select=id&ativo=is.true&nome=ilike.${busca}&limit=1`,
  )
  return achados[0]?.id ?? null
}

const RECUSAS: Record<string, string> = {
  horario_ocupado: 'Esse horário já está ocupado.',
  sem_profissional_livre: 'Nenhum profissional livre nesse horário.',
  fora_expediente: 'Não há atendimento nesse dia e horário.',
  profissional_inexistente: 'Esse profissional não foi encontrado.',
  whatsapp_invalido: 'O número de WhatsApp não é válido.',
  dados_invalidos: 'Faltou alguma informação.',
  data_invalida: 'A data não foi entendida.',
  nao_encontrada: 'Esse agendamento não foi encontrado.',
  sem_agendamento: 'Esta pessoa não tem agendamento marcado.',
  varios_agendamentos: 'Ela tem mais de um agendamento marcado — pergunte qual.',
  // Sem citar o título da seção do prompt: o nome da lista muda de kit para
  // kit ("Serviços", "Procedimentos que a clínica faz"), e a frase é a mesma.
  procedimento_desconhecido:
    'Esse serviço não está no catálogo. Use um dos nomes da lista, ' +
    'exatamente como está escrito lá.',
  profissional_nao_faz:
    'Esse profissional não faz esse serviço. Ofereça quem faz (quem_faz), ou ' +
    'deixe o sistema escolher sem mandar profissional.',
  ninguem_faz: 'No momento, nenhum profissional faz esse serviço.',
}

/**
 * A recusa `profissional_nao_faz` (0027), com a saída junto.
 *
 * "A Ana não faz corte" sozinho é uma recusa sem saída: ela teria que chutar
 * outro nome ou desistir. Com `quem_faz`, a próxima frase dela já é uma oferta.
 */
function recusaQuemFaz(quem: string[]): Record<string, unknown> {
  return quem.length
    ? { ok: false, motivo: 'profissional_nao_faz', quem_faz: quem, mensagem: RECUSAS.profissional_nao_faz }
    : { ok: false, motivo: 'profissional_nao_faz', quem_faz: [], mensagem: RECUSAS.ninguem_faz }
}

/** Aceita só o formato de uuid. Qualquer outra coisa é um id que não existe. */
function ehUuid(v: unknown): boolean {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim())
}

/**
 * Qual consulta remarcar ou cancelar, quando o modelo não tem o id na mão.
 *
 * ── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * **O modelo não guarda resultado de ferramenta entre uma mensagem e outra.**
 * `montarHistorico()` reconstrói a conversa a partir de `mensagens_whatsapp`,
 * que só tem os balões de texto — a chamada de `ver_meus_agendamentos` e o que
 * ela devolveu somem no fim da execução.
 *
 * Foi assim que a primeira remarcação falhou. Numa mensagem ela achou a
 * consulta ("Consegui achar sua avaliação marcada para amanhã meio-dia"); na
 * seguinte, o paciente disse "aham" — e o id já não existia. Ela chamou a
 * remarcação com o campo vazio, o Postgres recusou o uuid (`22P02`), o `rpc()`
 * levantou, e o paciente ouviu "não consegui acessar a agenda agora". A agenda
 * estava perfeita. (Na época as ferramentas se chamavam `ver_minhas_consultas`
 * e `remarcar_consulta`.)
 *
 * Exigir que ele chame `ver_meus_agendamentos` de novo, na mesma resposta, é
 * uma regra que depende de o modelo lembrar. **Não precisar do id é uma regra
 * que não depende de ninguém**: a pessoa quase sempre tem um agendamento só, e
 * o dono dele já é o `lead_id` do contexto.
 */
async function consultaAlvo(
  ctx: Contexto,
  idBruto: unknown,
): Promise<{ id: string } | { erro: string; agendamentos?: unknown[] }> {
  if (ehUuid(idBruto)) return { id: String(idBruto).trim() }

  const linhas = await selecionar<{ id: string; procedimento: string; data_consulta: string }>(
    `consultas?select=id,procedimento,data_consulta` +
    `&lead_id=eq.${ctx.leadId}&status=eq.agendada` +
    `&order=data_consulta.asc&limit=10`,
  )
  if (!linhas.length) return { erro: 'sem_agendamento' }
  if (linhas.length === 1) return { id: linhas[0].id }
  return {
    erro: 'varios_agendamentos',
    agendamentos: linhas.map((c) => ({
      agendamento_id: c.id,
      servico: c.procedimento,
      quando: dataHora(c.data_consulta, ctx.fuso),
    })),
  }
}

// ---------------------------------------------------------------------------

/**
 * Executa uma ferramenta e devolve o resultado que o modelo vai ler.
 *
 * Sempre devolve objeto com `ok`. Recusa de negócio NÃO é exceção — "horário
 * ocupado" é resposta, e o modelo precisa dela para dar a notícia ao paciente.
 */
export async function executar(
  nome: string,
  args: Record<string, unknown>,
  ctx: Contexto,
): Promise<Record<string, unknown>> {
  try {
    switch (nome) {
      case 'ver_horarios_livres': {
        const data = String(args.data ?? '')
        const profissional = await acharProfissional(args.profissional as string)
        // O SERVIÇO FILTRA QUEM ATENDE (0027): só entram os horários de quem
        // faz, e a duração passa a ser a dele — a avaliação ocupa 30 minutos,
        // uma coloração ocupa duas horas. Sem serviço, vale a regra antiga (60).
        // E se ele passa pela porta de entrada, o SQL já devolve os horários
        // da porta, que é o que vai ser marcado.
        const servico = String(args.servico ?? '').trim() || null

        // Pediu alguém que não faz o serviço: "não tenho horário" seria mentir
        // sobre a agenda. A resposta certa é quem faz.
        if (profissional && servico) {
          const quemFaz = await rpc<{ profissional_id: string; nome: string }[]>(
            'agenda_quem_faz', { p_procedimento: servico },
          )
          if (!quemFaz.some((q) => q.profissional_id === profissional)) {
            return recusaQuemFaz(quemFaz.map((q) => q.nome))
          }
        }

        const slots = await rpc<{ horario: string }[]>('agenda_horarios_disponiveis', {
          p_data: data,
          p_profissional: profissional,
          p_procedimento: servico,
        })
        const horarios = slots.map((s) => hora(s.horario, ctx.fuso))

        if (!horarios.length) {
          const proxima = await rpc<string | null>('agenda_proxima_vaga', {
            p_a_partir_de: data,
            p_profissional: profissional,
            p_procedimento: servico,
          })
          return proxima
            ? { ok: true, horarios: [], proxima_vaga: dataHora(proxima, ctx.fuso) }
            : { ok: true, horarios: [], proxima_vaga: null }
        }

        // Se o paciente pediu uma hora, responda especificamente por ela.
        const pedida = typeof args.hora === 'string' ? args.hora.slice(0, 5) : null
        return {
          ok: true,
          data,
          ...(pedida ? { hora_pedida: pedida, disponivel: horarios.includes(pedida) } : {}),
          horarios,
        }
      }

      case 'marcar_agendamento': {
        // O modelo manda hora local ("2026-09-01T14:00"), sem fuso. Texto sem
        // fuso NÃO é um instante: `agenda_marcar` recebe `timestamptz`, e a
        // sessão do PostgREST roda em UTC — sem esta conversão, 14:00 da
        // empresa é gravado como 14:00 de Londres, ou seja, 11:00 aqui.
        // Ver `_shared/tempo.ts` para o estrago que isso já causou.
        const quando = paraInstante(String(args.data_hora ?? ''), ctx.fuso)
        if (!quando) {
          return { ok: false, motivo: 'data_invalida', mensagem: RECUSAS.data_invalida }
        }

        const servico = String(args.servico ?? '')
        const profissional = await acharProfissional(args.profissional as string)
        const linhas = await rpc<{
          ok: boolean; motivo: string | null; consulta_id: string | null
          data_hora: string | null; profissional: string | null; sugestao: string | null
        }[]>('agenda_marcar', {
          p_nome: String(args.nome_completo ?? ''),
          p_whatsapp: ctx.whatsapp,
          p_procedimento: servico,
          p_data_hora: quando.toISOString(),
          p_profissional_id: profissional,
          // O que a pessoa procura, para o profissional ver na agenda. Só faz
          // sentido quando o que está sendo marcado é a porta de entrada — e
          // quando ela esquece, a própria função busca na ficha.
          p_interesse: String(args.interesse ?? '') || null,
          // Nulo de propósito: a duração sai de `servicos_clinica`. A avaliação
          // ocupa 30 minutos, e chumbar 60 aqui desperdiçaria meia hora de
          // agenda em toda primeira consulta.
          p_duracao: null,
          // Idempotência: se esta execução repetir por timeout, devolve o
          // agendamento que já existe em vez de criar um segundo.
          //
          // A chave é o INSTANTE, não o texto que o modelo escreveu: "14:00" e
          // "14:00:00-03:00" são o mesmo horário, e com o texto cru virariam
          // duas consultas.
          p_chave_externa: `wa_${ctx.leadId}_${quando.toISOString()}`,
        })
        const r = linhas[0]

        // A PORTA DE ENTRADA. Esta recusa não é um erro — é o fluxo certo, e
        // ela precisa saber para onde ir. A instrução vem junto com o nome da
        // porta, que sai do banco: renomear a porta na tela não deixa esta
        // frase para trás.
        //
        // "Começa por", e não "passa pela": o nome da porta é dado, e o artigo
        // de "a Avaliação" erraria o gênero de "o Orçamento".
        if (r?.motivo === 'exige_avaliacao') {
          const porta = r.sugestao ?? 'o serviço de entrada'
          return {
            ok: false,
            motivo: 'exige_avaliacao',
            marque_no_lugar: porta,
            mensagem:
              `${servico} começa por ${porta}. Marque "${porta}" no mesmo ` +
              `horário, com interesse="${servico}".`,
          }
        }

        // O profissional pedido não faz este serviço (0027). A função manda em
        // `sugestao` quem faz, e é isso que vira a próxima oferta.
        if (r?.motivo === 'profissional_nao_faz') {
          return recusaQuemFaz(r.sugestao ? r.sugestao.split(', ') : [])
        }

        if (!r?.ok) {
          return { ok: false, motivo: r?.motivo, mensagem: RECUSAS[r?.motivo ?? ''] ?? 'Não consegui marcar.' }
        }
        return {
          ok: true,
          agendamento_id: r.consulta_id,
          quando: dataHora(r.data_hora!, ctx.fuso),
          profissional: r.profissional,
        }
      }

      case 'ver_meus_agendamentos': {
        const linhas = await selecionar<{
          id: string; procedimento: string; data_consulta: string; status: string
        }>(
          `consultas?select=id,procedimento,data_consulta,status` +
          `&lead_id=eq.${ctx.leadId}&status=eq.agendada` +
          `&order=data_consulta.asc&limit=10`,
        )
        return {
          ok: true,
          agendamentos: linhas.map((c) => ({
            agendamento_id: c.id,
            servico: c.procedimento,
            quando: dataHora(c.data_consulta, ctx.fuso),
          })),
        }
      }

      case 'remarcar_agendamento': {
        // Mesma conversão do marcar_agendamento, e pelo mesmo motivo.
        const quando = paraInstante(String(args.nova_data_hora ?? ''), ctx.fuso)
        if (!quando) {
          return { ok: false, motivo: 'data_invalida', mensagem: RECUSAS.data_invalida }
        }

        const alvo = await consultaAlvo(ctx, args.agendamento_id)
        if ('erro' in alvo) {
          return {
            ok: false, motivo: alvo.erro, mensagem: RECUSAS[alvo.erro],
            ...(alvo.agendamentos ? { agendamentos: alvo.agendamentos } : {}),
          }
        }

        const linhas = await rpc<{
          ok: boolean; motivo: string | null; data_hora: string | null; profissional: string | null
        }[]>('agenda_remarcar', {
          p_consulta_id: alvo.id,
          p_nova_data_hora: quando.toISOString(),
          p_profissional_id: null,
          p_whatsapp: ctx.whatsapp,
        })
        const r = linhas[0]
        if (!r?.ok) {
          return { ok: false, motivo: r?.motivo, mensagem: RECUSAS[r?.motivo ?? ''] ?? 'Não consegui remarcar.' }
        }
        return { ok: true, quando: dataHora(r.data_hora!, ctx.fuso), profissional: r.profissional }
      }

      case 'cancelar_agendamento': {
        const alvo = await consultaAlvo(ctx, args.agendamento_id)
        if ('erro' in alvo) {
          return {
            ok: false, motivo: alvo.erro, mensagem: RECUSAS[alvo.erro],
            ...(alvo.agendamentos ? { agendamentos: alvo.agendamentos } : {}),
          }
        }

        const linhas = await rpc<{
          ok: boolean; motivo: string | null; data_hora: string | null
        }[]>('agenda_cancelar', {
          p_consulta_id: alvo.id,
          p_whatsapp: ctx.whatsapp,
          p_motivo: (args.motivo as string) ?? null,
        })
        const r = linhas[0]
        if (!r?.ok) {
          return { ok: false, motivo: r?.motivo, mensagem: RECUSAS[r?.motivo ?? ''] ?? 'Não consegui cancelar.' }
        }
        return { ok: true, cancelado: r.data_hora ? dataHora(r.data_hora, ctx.fuso) : null }
      }

      case 'detalhes_do_servico': {
        const pedido = String(args.servico ?? '').trim()
        if (!pedido) return { ok: false, mensagem: 'Preciso saber qual serviço.' }

        // Busca pelo nome, sem exigir escrita exata — o modelo às vezes
        // abrevia ("clareamento" em vez de "Clareamento Dental").
        const busca = encodeURIComponent(`%${pedido}%`)
        const achados = await selecionar<{
          nome: string; descricao: string | null; descricao_longa: string | null
        }>(
          `servicos_clinica?select=nome,descricao,descricao_longa` +
          `&ativo=is.true&nome=ilike.${busca}&limit=1`,
        )

        if (!achados.length) {
          return {
            ok: false,
            motivo: 'nao_encontrado',
            mensagem: 'A empresa não trabalha com esse serviço.',
          }
        }

        const p = achados[0]
        return {
          ok: true,
          servico: p.nome,
          // Sem texto longo, devolve o curto. Nunca "não tenho informação" —
          // isso faria a Letícia dizer que não sabe do que a empresa faz.
          detalhes: p.descricao_longa?.trim() || p.descricao || '',
        }
      }

      case 'historico_do_cliente': {
        // Só o que JÁ ACONTECEU. O agendamento futuro é assunto de
        // `ver_meus_agendamentos`, que devolve o id que remarcar e cancelar
        // precisam — e misturar as duas faria ela tentar cancelar um
        // atendimento de 2023.
        const linhas = await selecionar<{
          procedimento: string; data_consulta: string; status: string
          profissional: { nome: string; sobrenome: string } | null
        }>(
          `consultas?select=procedimento,data_consulta,status,profissional:profissionais(nome,sobrenome)` +
          `&lead_id=eq.${ctx.leadId}&status=in.(realizada,cancelada,faltou)` +
          `&order=data_consulta.desc&limit=20`,
        )

        if (!linhas.length) {
          return { ok: true, historico: [], mensagem: 'Esta pessoa ainda não tem atendimento concluído aqui.' }
        }

        return {
          ok: true,
          historico: linhas.map((c) => ({
            servico: c.procedimento,
            quando: dataHora(c.data_consulta, ctx.fuso),
            situacao: c.status,
            profissional: c.profissional
              ? `${c.profissional.nome} ${c.profissional.sobrenome}`
              : null,
          })),
        }
      }

      case 'atualizar_ficha': {
        const campos: Record<string, unknown> = {}

        // ⚠️ NOME DE MENTIRA É PIOR QUE NOME VAZIO.
        //
        // Gravado "cliente", a ficha passa a parecer preenchida: a Letícia lê
        // "já sei o nome" e nunca mais pergunta, e as telas mostram um lead
        // chamado "cliente" para sempre. Vazio, o número formatado aparece na
        // tela e ela continua perguntando — que é o certo. Mesma razão pela
        // qual o `pushName` do WhatsApp é ignorado.
        const nome = String(args.nome ?? '').trim()
        if (nome && !ehNomeGenerico(nome)) campos.nome_lead = nome.slice(0, 120)
        // A LISTA SUBSTITUI, e por isso um array vazio é diferente de campo
        // ausente: vazio apaga o que havia, ausente não mexe. Sem essa
        // diferença não haveria como corrigir um interesse gravado errado.
        if (Array.isArray(args.servicos_interesse)) {
          campos.procedimentos_interesse = (args.servicos_interesse as unknown[])
            .map((p) => String(p).trim())
            .filter(Boolean)
            .slice(0, 20)
        }
        const resumo = arrumarResumo(String(args.resumo ?? ''))
        if (resumo) campos.resumo_conversa = resumo.slice(0, 2000)
        if (!Object.keys(campos).length) return { ok: true, nada_a_fazer: true }

        // `crm_clinica` é view auto-atualizável. Nunca escrever em
        // `minutos_ultima_mensagem`, que é calculada na leitura.
        await atualizar('crm_clinica', `id=eq.${ctx.leadId}`, campos)
        return { ok: true }
      }

      default:
        return { ok: false, mensagem: 'Ferramenta desconhecida.' }
    }
  } catch (e) {
    // Falha técnica nunca vai crua para o paciente: o modelo recebe uma frase
    // neutra e o detalhe fica no log.
    console.error(`ferramenta ${nome}:`, e)
    return { ok: false, mensagem: 'Não consegui acessar a agenda agora.' }
  }
}
