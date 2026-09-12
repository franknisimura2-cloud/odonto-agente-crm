/**
 * Leva os dois textos de `agente-ia/` para dentro da Edge Function:
 *
 *   prompt.md              → PROMPT_OFICIAL      (quem ela é e como atende)
 *   descritor-de-fotos.md  → DESCRITOR_DE_FOTOS  (o que o modelo de visão
 *                                                  escreve sobre uma foto)
 *
 * POR QUE ISTO EXISTE: a Edge Function roda no Supabase e não enxerga o
 * repositório. Ela precisa dos textos embutidos no código. Em vez de manter
 * uma segunda cópia à mão — que envelheceria calada — o arquivo `.ts` é gerado
 * a partir dos `.md`, e os `.md` continuam sendo os únicos que alguém edita.
 *
 * Os dois moram juntos porque andam em par: o descritor pode começar uma
 * descrição com um marcador ("Sem relação com …:") que o prompt reconhece.
 * Trocar de ramo é trocar os dois — é o que um kit traz.
 *
 * Rode depois de mexer em qualquer um:
 *
 *     npm run prompt
 *
 * O deploy da função (`npm run agente:deploy`) já roda isto antes.
 *
 * ANTES DE GERAR, CONFERE (`conferir-contrato.mjs`): se o prompt perdeu um
 * marcador, uma seção ou o nome certo de uma ferramenta, nada é gerado — e o
 * deploy para aqui, com o motivo escrito, em vez de publicar uma atendente
 * quebrada sem ninguém perceber.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { conferirContrato, relatar } from './conferir-contrato.mjs'

const aqui = dirname(fileURLToPath(import.meta.url))
const destino = join(aqui, '..', 'supabase', 'functions', '_shared', 'prompt-oficial.ts')

/**
 * Lê um `.md` com quebra de linha SEMPRE em `\n`.
 *
 * ⚠️ O `.replace` não é firula de estilo. No Windows o Git entrega os arquivos
 * com CRLF (`core.autocrlf`), e sem esta linha o `\r` entrava no texto embutido
 * — o prompt publicado ficava com `\r\n` em cada quebra. Três estragos de uma
 * vez: ~375 caracteres a mais em TODA chamada ao modelo, um `prompt-oficial.ts`
 * que aparecia modificado no `git status` sem ninguém ter editado nada, e uma
 * atendente publicada diferente conforme o sistema de quem publicou.
 */
const lerMd = (nome) => readFileSync(join(aqui, nome), 'utf8').replace(/\r\n/g, '\n')

const prompt = lerMd('prompt.md')
const descritor = lerMd('descritor-de-fotos.md').trim()

if (!relatar(conferirContrato(prompt, descritor))) {
  console.log('\nNada foi gerado. Corrija o prompt e rode de novo.')
  process.exit(1)
}

// JSON.stringify em vez de template literal: o prompt tem crase, cifrão e
// chaves duplas. Escapar isso à mão é como se cria um bug que só aparece
// quando alguém acrescenta um exemplo com acento.
const saida = `/**
 * GERADO AUTOMATICAMENTE — NÃO EDITE ESTE ARQUIVO.
 *
 * Fontes: agente-ia/prompt.md e agente-ia/descritor-de-fotos.md
 * Regerar: npm run prompt
 *
 * Editar aqui funciona até o próximo deploy, e aí a sua mudança some sem
 * aviso. Edite os .md.
 */

export const PROMPT_OFICIAL = ${JSON.stringify(prompt)}

export const DESCRITOR_DE_FOTOS = ${JSON.stringify(descritor)}
`

writeFileSync(destino, saida, 'utf8')

const contar = (t) => `${t.split('\n').length} linhas, ${t.split(/\s+/).filter(Boolean).length} palavras`
console.log(`prompt.md             -> PROMPT_OFICIAL      (${contar(prompt)})`)
console.log(`descritor-de-fotos.md -> DESCRITOR_DE_FOTOS  (${contar(descritor)})`)
