/**
 * O prompt e o código ainda combinam? Confere o que quebra EM SILÊNCIO.
 *
 * O `prompt.md` conversa com o código por nomes: as ferramentas, os
 * marcadores `{{...}}`, as nove seções e algumas frases que um lado escreve e
 * o outro reconhece. Nome trocado não dá erro em lugar nenhum — a atendente só
 * passa a atender pior, e nada na tela avisa. Este arquivo é a conferência.
 *
 * Roda sozinho dentro do `npm run prompt` (e portanto do `agente:deploy`). Se
 * alguma coisa não bater, o prompt NÃO é gerado nem publicado.
 *
 * Para conferir um kit antes de copiar os arquivos dele:
 *
 *     node agente-ia/conferir-contrato.mjs kits/clinica-odontologica
 *
 * ⚠️ Mudou uma frase de contrato nos DOIS lados (código e prompt)? Mude a lista
 * aqui também — senão a conferência acusa o que está certo.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

const SECOES = [
  'IDENTIDADE', 'SUA FUNÇÃO', 'TOM DE VOZ', 'A EMPRESA', 'FLUXO DE ATENDIMENTO',
  'REGRAS DE ATENDIMENTO', 'FERRAMENTAS', 'DATA E HORA ATUAL', 'QUEM ESTÁ FALANDO COM VOCÊ',
]

/** O que deixa de chegar até a atendente quando o marcador some. */
const MARCADORES = {
  NOME_AGENTE: 'o nome dela',
  INFORMACOES_EMPRESA: 'o endereço e o horário da empresa',
  SERVICOS: 'a lista de serviços',
  PROFISSIONAIS: 'a lista de profissionais',
  DATA_HOJE: 'a data e a hora de agora',
  FICHA_DO_CONTATO: 'a ficha da pessoa',
}

/** Frases que `_shared/prompt.ts` escreve na ficha e o prompt reconhece. */
const FRASES_DA_FICHA = ['JÁ TEM AGENDAMENTO MARCADO', 'já é cliente', 'Do que já falaram']

/** Nomes que as ferramentas tinham antes do vocabulário neutro. */
const NOMES_ANTIGOS = {
  dentista: 'profissional',
  procedimento: 'servico',
  consulta_id: 'agendamento_id',
  procedimentos_interesse: 'servicos_interesse',
}

const ler = (caminho) => readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n')
const semComentarios = (codigo) =>
  codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/**
 * Devolve `{ falhas, avisos, resumo }`. Falha trava a publicação; aviso só
 * aparece na tela.
 */
export function conferirContrato(promptBruto, descritorBruto) {
  const prompt = promptBruto.replace(/\r\n/g, '\n')
  const descritor = descritorBruto.replace(/\r\n/g, '\n')
  const ferramentas = ler(join(RAIZ, 'supabase/functions/_shared/ferramentas.ts'))
  const montagem = ler(join(RAIZ, 'supabase/functions/_shared/prompt.ts'))
  const webhook = ler(join(RAIZ, 'supabase/functions/whatsapp/index.ts'))

  const falhas = []
  const avisos = []

  // 1. Ferramentas: as do código, as que rodam e as que o prompt ensina a usar
  const definidas = [...ferramentas.matchAll(/nome: '([a-z_]+)'/g)].map((m) => m[1])
  const executadas = [...ferramentas.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1])
  const noPrompt = [...prompt.matchAll(/^## `([a-z_]+)`/gm)].map((m) => m[1])

  for (const nome of definidas) {
    if (!executadas.includes(nome)) {
      falhas.push(`A ferramenta \`${nome}\` está na lista de ferramentas.ts, mas não tem \`case\` em executar(). Ela seria oferecida e não rodaria.`)
    }
    if (!noPrompt.includes(nome)) {
      falhas.push(`A ferramenta \`${nome}\` existe no código e não tem a subseção "## \`${nome}\`" em # FERRAMENTAS. Sem ela, a atendente não sabe quando usar.`)
    }
  }
  for (const nome of noPrompt) {
    if (!definidas.includes(nome)) {
      falhas.push(`O prompt tem a subseção "## \`${nome}\`", mas não existe ferramenta com esse nome. A atendente vai tentar usar, e nada roda.`)
    }
  }

  // 2. Todo `nome_com_sublinhado` citado no prompt existe no código
  const codigo = semComentarios(ferramentas)
  const citados = [...new Set([...prompt.matchAll(/`([a-z]+_[a-z_]+)`/g)].map((m) => m[1]))]
  for (const nome of citados) {
    if (!new RegExp(`\\b${nome}\\b`).test(codigo)) {
      falhas.push(`O prompt cita \`${nome}\`, que não existe no código. Nome de ferramenta ou de campo escrito errado?`)
    }
  }
  const crases = new Set([...prompt.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]))
  for (const [antigo, atual] of Object.entries(NOMES_ANTIGOS)) {
    if (crases.has(antigo)) {
      falhas.push(`O prompt cita \`${antigo}\`, um nome antigo. Hoje o campo se chama \`${atual}\`.`)
    }
  }

  // 3. Marcadores: os que o prompt tem = os que o sistema preenche
  const noArquivo = new Set([...prompt.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]))
  const preenchidos = new Set([...montagem.matchAll(/'\{\{([A-Z_]+)\}\}'/g)].map((m) => m[1]))
  for (const m of noArquivo) {
    if (!preenchidos.has(m)) {
      falhas.push(`O prompt tem {{${m}}}, que o sistema não preenche. O modelo leria o marcador cru, como se fosse texto.`)
    }
  }
  for (const m of preenchidos) {
    if (!noArquivo.has(m)) {
      falhas.push(`O prompt perdeu o marcador {{${m}}}. Sem ele, ${MARCADORES[m] ?? 'o que ele traz'} não chega até a atendente.`)
    }
  }

  // 4. As nove seções, na ordem — e as duas que mudam a cada mensagem no fim
  const titulos = [...prompt.matchAll(/^# (.+)$/gm)].map((m) => m[1].trim())
  const faltando = SECOES.filter((s) => !titulos.includes(s))
  for (const s of faltando) falhas.push(`Falta a seção "# ${s}".`)
  const extras = titulos.filter((t) => !SECOES.includes(t))
  for (const t of extras) {
    avisos.push(`A seção "# ${t}" não é uma das nove. Se é de propósito, tudo bem — mas o esqueleto pede que o assunto vire um subtítulo (##) dentro de uma delas.`)
  }
  if (!faltando.length) {
    const ordem = titulos.filter((t) => SECOES.includes(t))
    if (ordem.join('|') !== SECOES.join('|')) {
      falhas.push(`As seções estão fora de ordem. O esperado é: ${SECOES.join(', ')}.`)
    }
    if (titulos.slice(-2).join('|') !== 'DATA E HORA ATUAL|QUEM ESTÁ FALANDO COM VOCÊ') {
      falhas.push('"# DATA E HORA ATUAL" e "# QUEM ESTÁ FALANDO COM VOCÊ" precisam ser as duas últimas seções. Elas mudam a cada mensagem, e tudo o que vier depois delas perde o desconto de cache, em todas as conversas.')
    }
  }
  const dentroDe = (marcador, secao) =>
    prompt.includes(`{{${marcador}}}`) && prompt.indexOf(`{{${marcador}}}`) > prompt.indexOf(`# ${secao}`)
  if (noArquivo.has('DATA_HOJE') && !dentroDe('DATA_HOJE', 'DATA E HORA ATUAL')) {
    falhas.push('{{DATA_HOJE}} precisa estar dentro de "# DATA E HORA ATUAL".')
  }
  if (noArquivo.has('FICHA_DO_CONTATO') && !dentroDe('FICHA_DO_CONTATO', 'QUEM ESTÁ FALANDO COM VOCÊ')) {
    falhas.push('{{FICHA_DO_CONTATO}} precisa estar dentro de "# QUEM ESTÁ FALANDO COM VOCÊ".')
  }

  // 5. As frases que um lado escreve e o outro reconhece
  for (const frase of FRASES_DA_FICHA) {
    if (!montagem.includes(frase)) {
      falhas.push(`A ficha (_shared/prompt.ts) não escreve mais "${frase}". Se a frase mudou de propósito, mude também o prompt e a lista do conferir-contrato.mjs.`)
    } else if (!prompt.includes(frase)) {
      falhas.push(`A ficha escreve "${frase}", e o prompt não reconhece mais essa frase. Ela precisa aparecer igual em # QUEM ESTÁ FALANDO COM VOCÊ.`)
    }
  }
  const FOTO = 'não consegui abrir esta foto'
  if (webhook.includes(`'${FOTO}'`) && !prompt.includes(FOTO)) {
    falhas.push(`Quando uma foto não abre, o sistema escreve "${FOTO}". O prompt precisa dizer o que fazer com essa frase, com estas palavras — senão ela comenta uma foto que nunca chegou.`)
  }
  const marcadorFoto = descritor.match(/exatamente com "([^"]+?):?"/)?.[1]
  if (marcadorFoto && !prompt.includes(marcadorFoto)) {
    falhas.push(`O descritor de fotos marca as fotos fora do assunto com "${marcadorFoto}", e o prompt não reconhece esse marcador. Descritor e prompt andam em par.`)
  }
  if (!marcadorFoto && /Sem relação com/.test(prompt)) {
    avisos.push('O prompt espera um marcador "Sem relação com ...", e o descritor de fotos não escreve nenhum. Descritor e prompt são do mesmo kit?')
  }
  if (/\bprofissional_nao_faz\b/.test(codigo) && !prompt.includes('profissional_nao_faz')) {
    falhas.push('A agenda recusa com `profissional_nao_faz` (e diz quem faz), e o prompt não explica o que fazer com essa recusa.')
  }

  const resumo = `${definidas.length} ferramentas, ${preenchidos.size} marcadores, ${SECOES.length} seções`
  return { falhas, avisos, resumo }
}

/** Imprime o resultado. Devolve `true` se passou. */
export function relatar({ falhas, avisos, resumo }) {
  for (const a of avisos) console.log(`  aviso: ${a}`)
  if (!falhas.length) {
    console.log(`Contrato do prompt com o código: tudo certo (${resumo}).`)
    return true
  }
  console.log(`\nO prompt e o código não combinam em ${falhas.length} ponto(s):\n`)
  for (const f of falhas) console.log(`  - ${f}`)
  console.log('\nO que liga o prompt ao código está no agente-ia/GUIA-DO-PROMPT.md, seção 2.')
  return false
}

// Rodando direto: `node agente-ia/conferir-contrato.mjs [pasta]`
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const pasta = resolve(process.argv[2] ?? join(RAIZ, 'agente-ia'))
  const resultado = conferirContrato(
    ler(join(pasta, 'prompt.md')),
    ler(join(pasta, 'descritor-de-fotos.md')),
  )
  process.exit(relatar(resultado) ? 0 : 1)
}
