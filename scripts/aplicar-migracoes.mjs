/**
 * Aplica as migrações que faltam num banco — e anota cada uma.
 *
 *     node scripts/aplicar-migracoes.mjs                      # projeto do .supabase-token.local
 *     node scripts/aplicar-migracoes.mjs --clinica <nome>     # projeto da clínica
 *     node scripts/aplicar-migracoes.mjs --simular            # só mostra o que faltaria
 *
 * ── O REGISTRO ─────────────────────────────────────────────────────────────
 *
 * A tabela `public._migracoes_aplicadas` guarda o nome de cada arquivo de
 * `supabase/migrations/` que já rodou naquele banco. É por ela que o script
 * sabe o que falta — e é ela que vai deixar a fase 4 (atualizar todas as
 * clínicas) rodar sem adivinhar.
 *
 * Banco que nunca foi registrado (instalado antes deste script) e já tem o
 * esquema: as migrações até a mais recente que ele comprovadamente tem são
 * marcadas como aplicadas SEM rodar de novo. A prova é a tabela
 * `agente_followups`, criada pela 0030 — a última antes deste registro.
 *
 * Cada migração roda num pedido só, e a Management API faz dele uma
 * transação: se uma linha falha, a migração inteira volta, e o registro não é
 * escrito.
 */

import './nunca-estetica.mjs'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { RAIZ, clinicaDaLinhaDeComando, clinicaPorId } from '../agente-ia/clinicas.mjs'

const simular = process.argv.includes('--simular')

const cfg = {}
const tokenArq = join(RAIZ, '.supabase-token.local')
if (!existsSync(tokenArq)) { console.error('\n  ✖  Falta o .supabase-token.local.\n'); process.exit(1) }
for (const l of readFileSync(tokenArq, 'utf8').split(/\r?\n/)) {
  const c = l.indexOf('='); if (c < 1 || l.trimStart().startsWith('#')) continue
  cfg[l.slice(0, c).trim()] = l.slice(c + 1).trim()
}
const id = clinicaDaLinhaDeComando()
const clinica = id ? clinicaPorId(id) : null
if (id && !clinica) { console.error(`\n  ✖  Não existe a clínica "${id}".\n`); process.exit(1) }
const ref = clinica ? clinica.supabase_ref : cfg.SUPABASE_PROJECT_REF
if (!cfg.SUPABASE_ACCESS_TOKEN || !ref) { console.error('\n  ✖  Faltam o token ou o projeto.\n'); process.exit(1) }

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.SUPABASE_ACCESS_TOKEN}`,
      'User-Agent': 'nucleo-migracoes/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const corpo = await r.text()
  if (!r.ok) {
    let msg = corpo
    try { msg = JSON.parse(corpo).message ?? corpo } catch { /* cru */ }
    throw new Error(msg)
  }
  try { return JSON.parse(corpo) } catch { return [] }
}

const texto = (s) => `'${s.replace(/'/g, "''")}'`
const pasta = join(RAIZ, 'supabase', 'migrations')
const todas = readdirSync(pasta).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()

console.log(`\n  Projeto ${ref}${clinica ? ` (clínica "${clinica.id}")` : ''}\n`)

await sql(`
  create table if not exists public._migracoes_aplicadas (
    arquivo text primary key,
    aplicada_em timestamptz not null default now()
  );
  alter table public._migracoes_aplicadas enable row level security;
  revoke all on public._migracoes_aplicadas from anon, authenticated;
`)

let feitas = (await sql('select arquivo from public._migracoes_aplicadas')).map((r) => r.arquivo)

// Banco anterior ao registro: reconhece o que ele já tem.
if (feitas.length === 0) {
  const [{ tem }] = await sql(`select to_regclass('public.agente_followups') is not null as tem`)
  if (tem) {
    const ate = todas.filter((f) => f <= '0030_follow_up.sql')
    console.log(`  · Banco instalado antes do registro: marcando ${ate.length} migrações (até a 0030) como já aplicadas.`)
    if (!simular) {
      await sql(`insert into public._migracoes_aplicadas (arquivo) values ${ate.map((f) => `(${texto(f)})`).join(', ')} on conflict do nothing`)
    }
    feitas = ate
  }
}

const faltam = todas.filter((f) => !feitas.includes(f))
if (faltam.length === 0) { console.log('  ✔  Nada a aplicar: o banco está em dia.\n'); process.exit(0) }

for (const f of faltam) {
  if (simular) { console.log(`  · aplicaria ${f}`); continue }
  const corpo = readFileSync(join(pasta, f), 'utf8')
  try {
    // A migração e o registro dela no mesmo pedido: ou os dois, ou nenhum.
    await sql(`${corpo}\n;\ninsert into public._migracoes_aplicadas (arquivo) values (${texto(f)});`)
    console.log(`  ✔  ${f}`)
  } catch (e) {
    console.error(`  ✖  ${f}\n\n     ${String(e.message).slice(0, 800)}\n\n     Nada desta migração ficou gravado. As seguintes não foram tentadas.\n`)
    process.exit(1)
  }
}
console.log('')
