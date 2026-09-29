/**
 * Trava: nenhum script deste repositório (CRM Odonto) mexe no projeto Supabase
 * do CRM de estética, que é outro produto, validado e congelado.
 *
 * Importado no topo de todo script que escolhe um projeto Supabase:
 *
 *     import './nunca-estetica.mjs'            (de scripts/)
 *     import '../scripts/nunca-estetica.mjs'   (de agente-ia/)
 *
 * Confere os três lugares de onde um ref pode vir — `.supabase-token.local`,
 * `.env` e as fichas `clinicas/<nome>/clinica.json` — e para tudo se achar o
 * ref da estética em qualquer um deles.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REF_ESTETICA = 'yrdbsrjdscyitrmearni'
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

const arquivos = [join(RAIZ, '.supabase-token.local'), join(RAIZ, '.env')]
const pastaClinicas = join(RAIZ, 'clinicas')
if (existsSync(pastaClinicas)) {
  for (const d of readdirSync(pastaClinicas, { withFileTypes: true })) {
    if (d.isDirectory()) arquivos.push(join(pastaClinicas, d.name, 'clinica.json'))
  }
}

const achou = arquivos.filter((a) => existsSync(a) && readFileSync(a, 'utf8').includes(REF_ESTETICA))
if (achou.length || process.argv.some((a) => a.includes(REF_ESTETICA))) {
  console.error('\n  ✖  Este é o CRM Odonto, e o projeto Supabase configurado é o do CRM de')
  console.error('     estética (' + REF_ESTETICA + '). Nada foi feito.')
  for (const a of achou) console.error('     → ' + a.replace(RAIZ, '.'))
  console.error('')
  process.exit(1)
}
