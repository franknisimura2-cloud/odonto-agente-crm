/**
 * As clínicas cadastradas, e o kit de cada uma — para os scripts de
 * publicação saberem QUAL atendente vai para QUAL projeto.
 *
 * Cada clínica é uma pasta em `clinicas/`:
 *
 *     clinicas/<nome>/
 *       clinica.json          nome e projeto Supabase (sem segredo — é versionado)
 *       prompt.md             a atendente desta clínica
 *       descritor-de-fotos.md o par do prompt
 *       .env.agente.local     as chaves desta clínica (fora do Git)
 *
 * O `agente-ia/` continua existindo: é o prompt GENÉRICO, o ponto de partida
 * de uma clínica nova, e o da instalação avulsa (INSTALACAO.md), que não usa
 * `clinicas/`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const PASTA = join(RAIZ, 'clinicas')

/** Todas as clínicas: `{ nome, pasta, supabase_ref, ... }`. */
export function listarClinicas() {
  if (!existsSync(PASTA)) return []
  return readdirSync(PASTA, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(PASTA, d.name, 'clinica.json')))
    .map((d) => ({
      ...JSON.parse(readFileSync(join(PASTA, d.name, 'clinica.json'), 'utf8')),
      id: d.name,
      pasta: join(PASTA, d.name),
    }))
}

/** A clínica pelo nome da pasta. */
export function clinicaPorId(id) {
  return listarClinicas().find((c) => c.id === id) ?? null
}

/** A clínica dona de um projeto Supabase — ou `null`, se o projeto é avulso. */
export function clinicaPorRef(ref) {
  return listarClinicas().find((c) => c.supabase_ref === ref) ?? null
}

/** `--clinica nome` da linha de comando, ou `null`. */
export function clinicaDaLinhaDeComando(argv = process.argv) {
  const i = argv.indexOf('--clinica')
  return i >= 0 ? (argv[i + 1] ?? '') : null
}
