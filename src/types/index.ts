export type LeadStatus =
  | 'iniciou_conversa'
  | 'conversando'
  | 'consulta_agendada'
  | 'consulta_cancelada'
  | 'follow_up_1_feito'
  | 'follow_up_2_feito'
  | 'follow_up_3_feito'
  | 'consulta_realizada'
  | 'paciente_recorrente'

/**
 * O estado de uma consulta.
 *
 * `realizada` é a única porta automática para Pacientes: o trigger
 * `consultas_sincroniza_lead` promove o lead quando a consulta vira isso.
 * `faltou` (migração 0015) não é `cancelada` — quem avisa e quem some pedem
 * telefonemas diferentes, e a clínica precisa medir a taxa de falta.
 *
 * Precisa bater com o CHECK de `consultas.status`. Nada sincroniza sozinho.
 */
export type ConsultaStatus = 'agendada' | 'realizada' | 'cancelada' | 'faltou'

/** Quem criou a consulta. `agente_ia` chega pela API; `equipe`, pela tela. */
export type ConsultaOrigem = 'equipe' | 'agente_ia'

/** Migração 0038. Nulo = ainda não se sabe. */
export type FormaPagamento = 'particular' | 'convenio'

export interface Convenio {
  id: string
  nome: string
  /** Desativado some da Letícia e das listas de escolha. Convênio em uso não se apaga. */
  ativo: boolean
  observacoes: string | null
  created_at: string
}

export interface Usuario {
  id: string
  nome: string
  avatar_url: string | null
  created_at: string
}

export interface ConfiguracoesClinica {
  id: string
  nome_clinica: string | null
  logo_url: string | null
  /** IANA (ex.: 'America/Sao_Paulo'). Base do cálculo de disponibilidade. */
  fuso_horario: string
  /** Rua, número e complemento num campo só: 'Rua das Flores, 120 - sala 3'. */
  endereco: string | null
  bairro: string | null
  cidade: string | null
  /** UF de duas letras. O banco recusa qualquer coisa fora das 27. */
  estado: string | null
  /** Só dígitos: '01010000'. A pontuação existe apenas na tela. */
  cep: string | null
  google_maps_url: string | null
  instagram_url: string | null
  site_url: string | null
  /**
   * Chave da cor do sistema ('petroleo', 'verde'...), migração 0029. Os tons
   * moram em `src/lib/marca.ts`; chave desconhecida vira a padrão.
   */
  cor_sistema: string
  created_at: string
  updated_at: string
}

/**
 * Uma linha da view `informacoes_clinica_agente` — frase pronta, coluna única.
 * É o que o Agente de IA lê pelo n8n quando precisa falar da clínica.
 * **Somente leitura:** a view é calculada a partir de `configuracoes_clinica`.
 */
export interface InformacaoClinica {
  informacao: string
}

export interface HorarioComercial {
  id: string
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  ativo: boolean
}

export interface ServicoClinica {
  id: string
  nome: string
  /**
   * A frase curta do catálogo. **Vai no prompt do Agente de IA em toda
   * mensagem**, junto com a de todos os outros procedimentos ativos — por isso
   * o editor avisa quando ela passa de ~120 caracteres.
   */
  descricao: string
  /**
   * A explicação completa. **Não** vai no prompt: o agente busca pela
   * ferramenta `detalhes_do_servico`, só quando a pessoa pergunta
   * daquele serviço. Vazia, ele cai na `descricao`.
   */
  descricao_longa: string | null
  ativo: boolean
  /**
   * Marcado **e existindo uma porta de entrada** (`e_avaliacao`): o agente
   * **não** agenda este serviço — agenda a porta e guarda este nome em
   * `Consulta.interesse`. Desmarcado, ou sem porta: agenda direto.
   *
   * Sem porta, a marcação fica guardada e não vale (migração `0026`) — e volta
   * a valer se a empresa escolher uma porta de novo. Quem confere é a função
   * SQL `agenda_marcar`, não o prompt. A recepção passa por fora e continua
   * marcando o que quiser.
   */
  exige_avaliacao: boolean
  /**
   * O piso do valor, e o campo tem **três** estados, não dois:
   *
   * - `null` → o agente não fala preço
   * - `0`    → "Sem custo" — a frase que derruba a objeção de quem não quer
   *            pagar só para saber o preço
   * - `> 0`  → "a partir de R$ X"
   *
   * Zero **não** é vazio aqui. E o nome é `a_partir_de` porque é assim que ela
   * fala: um campo chamado `preco` seria preenchido com valor fechado.
   *
   * Ignorado quando o serviço passa pela porta — por isso o campo some do modal.
   */
  preco_a_partir_de: number | null
  /** Valor de tabela do plano de tratamento (0044) — interno, a Letícia não lê. */
  valor_tabela: number | null
  /** Em quantos meses quem fez este serviço deve voltar (0043). Nulo = não gera retorno. */
  retorno_meses: number | null
  /** Quanto tempo o bloco ocupa na agenda. A avaliação são 30; o resto, 60. */
  duracao_minutos: number
  /**
   * A porta de entrada. **No máximo um** serviço tem isto (índice único) — e
   * nenhum é um estado normal: a porta é opcional desde a migração `0026`.
   */
  e_avaliacao: boolean
  created_at: string
}

export interface LeadClinica {
  id: string
  nome_lead: string | null
  whatsapp_lead: string | null
  /**
   * O que a pessoa procura. **Cada item existe em `servicos_clinica.nome`** —
   * a trigger `crm_procedimentos_validos` recusa o resto e normaliza a grafia.
   *
   * É a coluna que responde "qual o procedimento mais procurado?". Texto livre
   * não respondia: "Lentes de Contato", "lentes" e "lente pro dente" contavam
   * como três tratamentos diferentes.
   */
  procedimentos_interesse: string[]
  /**
   * ⚠️ **CALCULADA na view `crm_clinica`** — os itens acima juntados por
   * vírgula. Existe para as telas que mostram uma linha só (CRM, Dashboard,
   * exportação) e para a ficha que a Letícia lê.
   *
   * **Nunca grave aqui.** Escrever nesta coluna é escrever numa expressão da
   * view; quem recebe o valor é `procedimentos_interesse`.
   */
  procedimento_interesse: string | null
  resumo_conversa: string | null
  status: LeadStatus
  inicio_atendimento: string | null
  ultima_mensagem: string | null
  id_conta_chatwoot: string | null
  id_conversa_chatwoot: string | null
  id_lead_chatwoot: string | null
  inbox_id_chatwoot: string | null
  follow_up_1: string | null
  follow_up_2: string | null
  follow_up_3: string | null
  data_agendamento: string | null
  data_marcacao_agendamento: string | null
  id_agendamento: string | null
  anotacoes: string | null
  data_nascimento: string | null
  valor_pago_acumulado: number | null
  minutos_ultima_mensagem: number | null
  /**
   * A última consulta que a pessoa REALIZOU (migração 0016).
   *
   * Calculada na leitura, como `minutos_ultima_mensagem` — **nunca grave nela**.
   * Só conta `realizada`: consulta cancelada ou com falta não é visita.
   *
   * É o que a tela Pacientes mostra no lugar de `data_agendamento`, que ali
   * seria sempre vazia (virar paciente zera a próxima consulta).
   */
  ultima_consulta: string | null
  /**
   * Ligado, o Agente de IA salva a mensagem e **não responde** nesta conversa.
   * É o botão "Assumir conversa" da tela Conversas.
   */
  agente_pausado: boolean
  assumido_por: string | null
  assumido_em: string | null
  created_at: string
  /** Particular ou convênio (0038) — a preferência da pessoa. */
  forma_pagamento: FormaPagamento | null
  convenio_id: string | null
  convenio_carteirinha: string | null
  /** 'AAAA-MM-DD'. */
  convenio_validade: string | null
  /** CALCULADA na view `crm_clinica` — nunca grave. */
  convenio_nome: string | null
  /** O próximo retorno (0043): anda sozinho na baixa de um serviço com retorno. 'AAAA-MM-DD'. */
  proximo_retorno: string | null
  retorno_servico: string | null
}

export interface Consulta {
  id: string
  lead_id: string
  profissional_id: string | null
  procedimento: string
  data_consulta: string
  duracao_minutos: number
  /**
   * Fim da consulta, mantido pelo trigger `consultas_data_fim`.
   * **Somente leitura** — grave `data_consulta` e `duracao_minutos`.
   * Existe como coluna porque a restrição anti-conflito precisa de uma
   * expressão imutável, e `timestamptz + interval` não é.
   */
  data_fim: string
  status: ConsultaStatus
  origem: ConsultaOrigem
  chave_externa: string | null
  valor_pago: number | null
  observacoes: string | null
  /**
   * O que o paciente procura, quando a consulta é a avaliação — "Lentes de
   * Contato" numa "Avaliação Odontológica".
   *
   * Diferente de `procedimento_interesse`, que é da **pessoa** e guarda um
   * valor só: este é congelado no ato de marcar, então a consulta de março não
   * passa a mentir quando a pessoa volta em agosto por outra coisa.
   */
  interesse: string | null
  /** Quando a pessoa confirmou presença (SIM ao lembrete, ou a equipe marcou). Volta a nulo se remarcar. */
  confirmada_em: string | null
  /**
   * Particular ou pelo convênio (0038). Preenchida SOZINHA na marcação pela
   * ficha da pessoa (convênio + serviço coberto → convênio; senão particular).
   */
  forma_pagamento: FormaPagamento | null
  convenio_id: string | null
  cancelado_em: string | null
  motivo_cancelamento: string | null
  created_at: string
  updated_at: string
}

/**
 * Dentista da clínica. NÃO é usuário do sistema — não faz login, é só um
 * recurso de agenda. A agenda dele são as consultas com este `id`; não existe
 * tabela de agenda.
 */
export interface Profissional {
  id: string
  nome: string
  sobrenome: string
  /** Hex de 6 dígitos. Identifica o profissional em toda a agenda. */
  cor: string
  ativo: boolean
  created_at: string
  updated_at: string
}

/**
 * Um serviço que o profissional faz (migração `0027`).
 *
 * **Profissional sem nenhuma linha faz todos os serviços.** A lista existe para
 * restringir, e só quem tem lista é restrito. A regra mora em
 * `profissional_faz()` no banco, e em `src/lib/servicosDosProfissionais.ts` na
 * tela.
 */
export interface ProfissionalServico {
  profissional_id: string
  servico_id: string
  created_at: string
}

/** Jornada do profissional. Uma linha por dia — 0 = domingo … 6 = sábado. */
export interface ProfissionalHorario {
  id: string
  profissional_id: string
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  ativo: boolean
}

/** Férias, feriado, almoço. `profissional_id` nulo = clínica inteira. */
export interface ProfissionalBloqueio {
  id: string
  profissional_id: string | null
  inicio: string
  fim: string
  motivo: string
  created_at: string
}

/**
 * Chave de acesso da API do Agente de IA.
 *
 * O valor em claro **não existe aqui, nem em lugar nenhum** — o banco guarda só
 * o `hash` (SHA-256). Por isso o token só pode ser exibido no instante da
 * criação: depois disso, nem o sistema consegue reconstruí-lo.
 *
 * Revogar é `ativo = false`, não `DELETE`: o histórico de quem teve acesso e
 * quando não pode sumir junto.
 */
export interface ApiToken {
  id: string
  nome: string
  /** Primeiros caracteres, visíveis na lista, para saber qual token é qual. */
  prefixo: string
  hash: string
  ativo: boolean
  criado_por: string | null
  /** Carimbado pela API no máximo a cada 5 minutos por token. */
  ultimo_acesso: string | null
  revogado_em: string | null
  created_at: string
}

/**
 * Consulta com os dados que a agenda precisa mostrar no bloco: de quem é a
 * consulta e qual o nome do paciente. Vem do join da Agenda.tsx.
 */
export interface ConsultaAgenda extends Consulta {
  lead: { id: string; nome_lead: string | null; whatsapp_lead: string | null } | null
}

/* ===========================================================================
 * Agente de IA — conversas do WhatsApp (migração 0010)
 * Documentação: agente-ia/README.md
 * =========================================================================== */

/** Quem escreveu. Define a cor do balão na tela Conversas. */
export type AutorMensagem = 'paciente' | 'agente' | 'atendente'

export type TipoMensagem = 'texto' | 'audio' | 'imagem' | 'video' | 'documento'

export interface MensagemWhatsapp {
  id: string
  lead_id: string
  autor: AutorMensagem
  tipo: TipoMensagem
  /** O texto. Em áudio, guarda a **transcrição** — é o que o modelo lê. */
  conteudo: string | null
  /** Caminho no bucket privado `midias-whatsapp`. Abrir com signed URL. */
  midia_url: string | null
  /** Id da mensagem na Evolution. Único — impede duplicata em reenvio. */
  id_externo: string | null
  /** Preenchido só quando `autor === 'atendente'`. */
  enviada_por: string | null
  /** Leitura da equipe inteira, não por usuário. */
  lida: boolean
  criada_em: string
}

/**
 * Modelos que a página "Secretária de IA" oferece.
 *
 * ⚠️ **Acrescentar um exige TRÊS lugares:** este tipo, a lista `MODELOS` de
 * `src/lib/modelosIA.ts` (o nome, a nota e o fornecedor) e o `conversar()` de
 * `supabase/functions/_shared/llm.ts`. Nada sincroniza isso sozinho.
 *
 * A coluna `configuracoes_agente.modelo` é `text` **sem `CHECK`**, de
 * propósito: acrescentar modelo não deve exigir migração, pela mesma razão de
 * `cores.ts` e da lista de fusos. Quem recusa o valor errado é a API do
 * fornecedor, e o motivo dela é melhor que o nosso.
 *
 * Estes foram testados contra a conta da clínica antes de entrarem — modelo
 * que existe na documentação e não responde nesta conta é uma opção que
 * promete e falha.
 */
export type ModeloAgente =
  | 'gpt-4.1-mini'
  | 'gpt-4.1'
  | 'gpt-5'
  | 'gpt-5.1'
  | 'gpt-5.4-mini'
  | 'gpt-5.5'
  | 'claude-sonnet-5'
  | 'claude-opus-5'

export interface ConfiguracoesAgente {
  id: string
  /** Desligado por padrão. Ligar é ato consciente, feito na tela. */
  ativo: boolean
  modelo: ModeloAgente
  /**
   * `null` = está rodando o prompt oficial de `agente-ia/prompt.md`.
   * Preenchido = alguém editou pela tela, e **este** é o que está no ar.
   */
  prompt: string | null
  /**
   * Ligado, o agente só responde aos números de `numeros_teste`. As demais
   * mensagens são gravadas, aparecem na tela, e ficam sem resposta.
   */
  modo_teste: boolean
  /** Formato canônico: só dígitos com DDI (`5511987654321`). */
  numeros_teste: string[]
  /**
   * Qual ponte com o WhatsApp está ativa (migração 0017). **UMA de cada vez.**
   *
   * ⚠️ Os valores vivem em dois lugares: o `CHECK` no banco e este tipo.
   * Acrescentou provedor? Mude os dois no mesmo commit.
   *
   * As credenciais NÃO vêm daqui — moram nas secrets do Supabase, fora do
   * alcance do navegador. Esta coluna diz quem está ativo, nunca como se
   * autentica.
   */
  provedor_whatsapp: 'evolution' | 'uazapi'
  /**
   * Como o Agente de IA se chama (migração `0019`).
   *
   * **Uma fonte, dois leitores**: as telas (pelo `useAgente()` de
   * `src/lib/agente.ts`) e o prompt (pelo marcador `{{NOME_AGENTE}}`). Antes
   * eram dois sistemas que não se falavam, e renomear exigia editar os dois.
   *
   * ⚠️ Isto é o NOME, não o cargo. "Secretária IA" e "Secretária de IA"
   * continuam constantes no código — trocar "Letícia" por "Sofia" não renomeia
   * a página. O banco garante não-vazio (`not null` + `CHECK` de 1 a 40).
   */
  nome_agente: string
  /**
   * Lembretes de agendamento (migração 0037). `lembretes_ativo` nasce FALSE:
   * a instalação que recebe a migração com consultas futuras não começa a
   * mandar mensagem sozinha.
   */
  lembretes_ativo: boolean
  lembrete_vespera_ativo: boolean
  /** 2 a 72. A véspera respeita a janela de horário do follow-up. */
  lembrete_vespera_horas: number
  lembrete_antes_ativo: boolean
  /** 10 a 360. */
  lembrete_antes_minutos: number
  /** A véspera pede "responda SIM"; o SIM vira o selo "Confirmada" na Agenda. */
  lembrete_pedir_confirmacao: boolean
  /** Follow-up (0030 e 0046): a chave geral nasce desligada e liga na tela. */
  followup_ativo: boolean
  followup_1_ativo: boolean
  /** Etapa 1: minutos de silêncio (a qualquer hora). */
  followup_1_minutos: number
  followup_2_ativo: boolean
  /** Etapa 2: horas de silêncio (só na janela). */
  followup_2_horas: number
  followup_3_ativo: boolean
  /** Etapa 3: dias de silêncio (só na janela). */
  followup_3_dias: number
  /** A janela das mensagens automáticas, 'HH:MM:SS' no fuso da empresa. */
  followup_inicio: string
  followup_fim: string
  /** Retomar o plano de tratamento não aprovado (0042). Nasce FALSE. */
  planos_retomar_ativo: boolean
  /** 1 a 30 dias de silêncio antes de cada toque. */
  planos_retomar_dias: number
  /** 1 a 3 toques no máximo. */
  planos_retomar_toques: number
  /** Chamar para o retorno (0043). Nasce FALSE. */
  retornos_ativo: boolean
  /** Quantos dias antes da data começa a chamar (0 a 60). */
  retornos_antecedencia: number
  /** Dias entre uma chamada e a próxima (1 a 60). */
  retornos_intervalo_dias: number
  /** 1 a 3 chamadas por retorno. */
  retornos_toques: number
  atualizado_por: string | null
  created_at: string
  updated_at: string
}

/**
 * Uma linha da view `conversas_lista` (migração 0013) — o que a coluna da
 * esquerda da tela Conversas mostra de cada pessoa.
 *
 * **Somente leitura:** é calculada na leitura, a partir de `crm_clinica_dados`
 * e `mensagens_whatsapp`. Para mudar algo aqui, escreva na tabela de origem.
 */
export interface ConversaResumo {
  lead_id: string
  nome_lead: string | null
  whatsapp_lead: string | null
  status: LeadStatus
  agente_pausado: boolean
  assumido_por: string | null
  assumido_em: string | null
  /** Nome de quem assumiu, já resolvido pelo join com `usuarios`. */
  assumido_por_nome: string | null
  ultimo_conteudo: string | null
  ultimo_tipo: TipoMensagem
  ultimo_autor: AutorMensagem
  ultima_em: string
  /** Só conta mensagem do paciente. É a bolinha azul da lista. */
  nao_lidas: number
  /**
   * A consulta ativa mais próxima do lead. Nula = sem consulta marcada.
   *
   * ⚠️ É ESTA COLUNA que responde "agendou?", **não** o `status`. O trigger
   * `consultas_sincroniza_lead` preserva `consulta_realizada` e
   * `paciente_recorrente` quando alguém marca de novo — então um paciente que
   * volta e marca NÃO fica em `consulta_agendada`. Ver `temConsultaMarcada()`
   * em `src/lib/conversas.ts` e a migração 0014.
   */
  data_agendamento: string | null
}
