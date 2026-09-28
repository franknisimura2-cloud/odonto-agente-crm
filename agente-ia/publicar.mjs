/**
 * Roda o CLI do Supabase com a identificação da SUA instalação.
 *
 *     node agente-ia/publicar.mjs secrets   →  npm run agente:secrets
 *     node agente-ia/publicar.mjs deploy    →  npm run agente:deploy
 *
 * POR QUE ISTO EXISTE: os dois comandos precisavam do `--project-ref` na linha
 * de comando, e ele estava **escrito dentro do `package.json`** — que é
 * versionado. Quem clonasse o repositório mandava publicar no projeto de outra
 * pessoa, e o erro que voltava era de permissão, sem dizer a causa.
 *
 * Agora os dois valores saem de `.supabase-token.local`, que é o arquivo de
 * identificação da instalação e já está fora do Git. Nada do projeto de
 * ninguém fica gravado em arquivo versionado.
 *
 * DE QUEBRA, RESOLVE O 401. O CLI usa a sessão do `supabase login`, que expira
 * — e o token do arquivo não entrava sozinho, então o deploy voltava
 * `Unauthorized` e parecia problema de código. Aqui ele é injetado no
 * processo filho, sempre.
 *
 * ── VÁRIAS CLÍNICAS ────────────────────────────────────────────────────────
 *
 *     npm run agente:deploy  -- --clinica <nome>
 *     npm run agente:secrets -- --clinica <nome>
 *
 * Com `--clinica`, o projeto é o de `clinicas/<nome>/clinica.json`, as chaves
 * são as de `clinicas/<nome>/.env.agente.local`, e a atendente publicada é a
 * de `clinicas/<nome>/prompt.md` (ver `clinicas.mjs`).
 *
 * SEM `--clinica`, vale o `SUPABASE_PROJECT_REF` do `.supabase-token.local` —
 * mas se esse projeto for de uma clínica cadastrada, o kit DELA é usado. É a
 * trava contra o erro mais caro daqui: publicar o prompt genérico por cima da
 * atendente de uma clínica em produção.
 *
 * `--simular` mostra o que seria feito e gera o prompt (conferindo o
 * contrato), sem chamar o Supabase.
 */

import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { RAIZ as raiz, clinicaDaLinhaDeComando, clinicaPorId, clinicaPorRef } from './clinicas.mjs'

const arquivo = join(raiz, '.supabase-token.local')
const simular = process.argv.includes('--simular')

/** Um `.env` simples: `CHAVE=valor`, ignorando comentários e linhas vazias. */
function ler(caminho) {
  const fora = {}
  for (const linha of readFileSync(caminho, 'utf8').split('\n')) {
    const corte = linha.indexOf('=')
    if (corte < 1 || linha.trimStart().startsWith('#')) continue
    fora[linha.slice(0, corte).trim()] = linha.slice(corte + 1).trim()
  }
  return fora
}

function morrer(mensagem) {
  console.error(`\n  ✖  ${mensagem}\n`)
  process.exit(1)
}

if (!existsSync(arquivo) && !simular) {
  morrer(
    'Falta o arquivo .supabase-token.local.\n\n' +
    '     cp .supabase-token.example .supabase-token.local\n\n' +
    '     Depois preencha as duas linhas de dentro dele. O próprio molde\n' +
    '     explica onde achar cada valor — e como revogar o token no fim.',
  )
}

const cfg = existsSync(arquivo) ? ler(arquivo) : {}
const token = cfg.SUPABASE_ACCESS_TOKEN

if (!token && !simular) morrer('SUPABASE_ACCESS_TOKEN está vazio em .supabase-token.local.')

// Qual projeto, e de qual clínica.
const idPedido = clinicaDaLinhaDeComando()
let clinica = null
let ref
if (idPedido !== null) {
  clinica = clinicaPorId(idPedido)
  if (!clinica) morrer(`Não existe a clínica "${idPedido}" em clinicas/.`)
  ref = clinica.supabase_ref
  if (!ref) morrer(`clinicas/${clinica.id}/clinica.json está sem "supabase_ref".`)
} else {
  ref = cfg.SUPABASE_PROJECT_REF
  if (!ref) {
    morrer(
      'SUPABASE_PROJECT_REF está vazio em .supabase-token.local.\n\n' +
      '     É o identificador do SEU projeto — as 20 letras que aparecem na URL\n' +
      '     do painel: https://supabase.com/dashboard/project/AQUI\n\n' +
      '     Publicando para uma clínica cadastrada? Use --clinica <nome>.',
    )
  }
  clinica = clinicaPorRef(ref)
  if (clinica) console.log(`\n  · O projeto ${ref} é da clínica "${clinica.id}" — usando o kit dela.`)
}

const arquivoDeChaves = clinica ? `clinicas/${clinica.id}/.env.agente.local` : 'agente-ia/.env.agente.local'

const acao = process.argv[2]
const comandos = {
  secrets: ['secrets', 'set', '--project-ref', ref, '--env-file', arquivoDeChaves],
  // `--no-verify-jwt` de propósito: quem chama o webhook é a ponte de WhatsApp,
  // que não tem sessão do Supabase. A autenticação é o WEBHOOK_SEGREDO,
  // conferido dentro da função. Publicar no padrão derruba o webhook com um
  // 401 que nem chega no nosso código.
  deploy: ['functions', 'deploy', 'whatsapp', '--project-ref', ref, '--no-verify-jwt'],
  // A API da agenda, pelo mesmo motivo: a autenticação dela é o nosso token.
  'deploy-agenda': ['functions', 'deploy', 'agenda', '--project-ref', ref, '--no-verify-jwt'],
}

if (!comandos[acao]) {
  morrer(`Ação desconhecida: "${acao ?? ''}". Use: ${Object.keys(comandos).join(', ')}`)
}

if (acao === 'secrets' && !existsSync(join(raiz, arquivoDeChaves))) {
  morrer(`Falta ${arquivoDeChaves} — são as chaves que sobem para o projeto ${ref}.`)
}

/** Roda o gerador do prompt; com a clínica, o dela. Morre se o contrato falhar. */
function gerarPrompt(daClinica) {
  const args = [join(raiz, 'agente-ia', 'gerar-prompt.mjs'), ...(daClinica ? ['--clinica', daClinica.id] : [])]
  const g = spawnSync(process.execPath, args, { cwd: raiz, stdio: 'inherit' })
  if (g.status !== 0) morrer('O prompt não passou na conferência. Nada foi publicado.')
}

// A função `whatsapp` leva o prompt embutido: gera o desta clínica logo antes.
if (acao === 'deploy') gerarPrompt(clinica)

console.log(`\n  → supabase ${comandos[acao].join(' ')}${simular ? '   (simulação: não executado)' : ''}\n`)

let status = 0
if (!simular) {
  const r = spawnSync('npx', ['--yes', 'supabase', ...comandos[acao]], {
    cwd: raiz,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
  })
  status = r.status ?? 1
}

// O `prompt-oficial.ts` é versionado, e o que fica no repositório é o
// GENÉRICO: publicar para uma clínica não pode deixar o arquivo "modificado"
// com a atendente dela no `git status`.
if (acao === 'deploy' && clinica) gerarPrompt(null)

process.exit(status)
