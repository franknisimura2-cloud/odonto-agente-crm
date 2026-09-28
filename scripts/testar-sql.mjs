/**
 * Roda um teste de banco SEM DEIXAR RASTRO:
 *
 *     node scripts/testar-sql.mjs supabase/migrations/0031_x.sql supabase/testes/0031_x.sql
 *
 * Junta os arquivos num único pedido à Management API do Supabase, dentro de
 * uma transação. O teste termina com um `raise exception` que carrega o
 * resultado — e o erro desfaz tudo: a migração, os usuários e os dados de
 * teste. É o que permite testar uma migração no banco de uma clínica em uso.
 *
 * Usa o `.supabase-token.local` (token e projeto). `--clinica <nome>` troca o
 * projeto pelo da clínica (ver `agente-ia/clinicas.mjs`).
 *
 * ⚠️ NUNCA ponha `commit` num arquivo de teste: ele gravaria de verdade.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { RAIZ, clinicaDaLinhaDeComando, clinicaPorId } from '../agente-ia/clinicas.mjs'

const arquivos = process.argv.slice(2).filter((a) => a.endsWith('.sql'))
if (!arquivos.length) { console.error('Uso: node scripts/testar-sql.mjs <migração.sql> <teste.sql>'); process.exit(1) }

const cfg = {}
const tokenArq = join(RAIZ, '.supabase-token.local')
if (!existsSync(tokenArq)) { console.error('Falta o .supabase-token.local.'); process.exit(1) }
for (const l of readFileSync(tokenArq, 'utf8').split(/\r?\n/)) {
  const c = l.indexOf('='); if (c < 1 || l.trimStart().startsWith('#')) continue
  cfg[l.slice(0, c).trim()] = l.slice(c + 1).trim()
}
const id = clinicaDaLinhaDeComando()
const ref = id ? clinicaPorId(id)?.supabase_ref : cfg.SUPABASE_PROJECT_REF
if (!cfg.SUPABASE_ACCESS_TOKEN || !ref) { console.error('Faltam o token ou o projeto.'); process.exit(1) }

const sql = arquivos.map((a) => readFileSync(join(RAIZ, a), 'utf8')).join('\n;\n')
if (/^\s*commit\s*;/im.test(sql)) { console.error('Há um COMMIT nos arquivos — recusado.'); process.exit(1) }

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${cfg.SUPABASE_ACCESS_TOKEN}`,
    'User-Agent': 'nucleo-testar-sql/1.0',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: `begin;\n${sql}` }),
})
const corpo = await r.text()
let msg = corpo
try { msg = JSON.parse(corpo).message ?? corpo } catch { /* texto cru */ }
const resultado = msg.includes('RESULTADO') ? msg.slice(msg.indexOf('RESULTADO')) : null
if (resultado) {
  console.log(resultado.replace(/\\n/g, '\n'))
  process.exit(/RESULTADO — 0 falha/.test(resultado) ? 0 : 1)
}
console.error(`O teste não chegou ao fim (HTTP ${r.status}):\n${msg}`)
process.exit(1)
