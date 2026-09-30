/**
 * Liga, desliga e mostra o relógio da retomada de planos (migração 0042).
 *
 *     npm run planos:ligar      agenda o cron de minuto em minuto
 *     npm run planos:desligar   tira o cron da agenda
 *     npm run planos:estado     o job, as batidas e a fila de agora
 *
 * Aceita `-- --clinica <nome>`; sem ele, vale o ref do `.supabase-token.local`.
 *
 * Ligar o relógio não manda nada: quem liga a retomada é a chave da tela
 * Atendente de IA (`planos_retomar_ativo`, que nasce desligada). Mesma
 * disciplina do `lembretes.mjs`: endereço e segredo no Vault, segredo nunca
 * impresso.
 */

import './nunca-estetica.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { RAIZ, clinicaDaLinhaDeComando, clinicaPorId, clinicaPorRef } from '../agente-ia/clinicas.mjs'

const MANAGEMENT = 'https://api.supabase.com/v1'
const JOB = 'planos'

function morrer(mensagem) {
  console.error(`\n  ✖  ${mensagem}\n`)
  process.exit(1)
}

function ler(caminho) {
  if (!existsSync(caminho)) return null
  const fora = {}
  for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const corte = linha.indexOf('=')
    if (corte < 1 || linha.trimStart().startsWith('#')) continue
    fora[linha.slice(0, corte).trim()] = linha.slice(corte + 1).trim()
  }
  return fora
}

const texto = (valor) => `'${String(valor).replace(/'/g, "''")}'`

const cfg = ler(join(RAIZ, '.supabase-token.local'))
if (!cfg?.SUPABASE_ACCESS_TOKEN) morrer('Falta o token em .supabase-token.local.')
const pedida = clinicaDaLinhaDeComando()
const clinica = pedida !== null ? clinicaPorId(pedida) : clinicaPorRef(cfg.SUPABASE_PROJECT_REF)
if (pedida !== null && !clinica) morrer(`Não achei a clínica "${pedida}" em clinicas/.`)
const REF = clinica?.supabase_ref ?? cfg.SUPABASE_PROJECT_REF
if (!REF) morrer('SUPABASE_PROJECT_REF está vazio em .supabase-token.local.')

async function sql(consulta) {
  const r = await fetch(`${MANAGEMENT}/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.SUPABASE_ACCESS_TOKEN}`, 'User-Agent': 'odonto-planos/1.0', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: consulta }),
  })
  const corpo = await r.text()
  if (!r.ok) morrer(`O banco recusou:\n\n     ${corpo.slice(0, 500)}`)
  try { return JSON.parse(corpo) } catch { return [] }
}

async function ligar() {
  const achou = await sql(`select 1 from pg_proc where proname = 'disparar_planos_retomar' and pronamespace = 'public'::regnamespace`)
  if (!achou.length) morrer('A migração 0042 ainda não foi aplicada (node scripts/aplicar-migracoes.mjs).')

  const kit = clinica ? join(clinica.pasta, '.env.agente.local') : join(RAIZ, 'agente-ia', '.env.agente.local')
  const segredo = ler(kit)?.WEBHOOK_SEGREDO
  if (!segredo) morrer(`WEBHOOK_SEGREDO está vazio em ${kit.replace(RAIZ, '.')}.`)

  for (const [nome, valor, descricao] of [
    ['planos_url', `https://${REF}.supabase.co/functions/v1/whatsapp/planos-retomar`, 'Endereco da rota de retomada de planos'],
    ['followup_segredo', segredo, 'O WEBHOOK_SEGREDO, para as rotas do cron aceitarem a chamada'],
  ]) {
    await sql(`
      select vault.update_secret(id, ${texto(valor)}, ${texto(nome)}, ${texto(descricao)})
      from vault.secrets where name = ${texto(nome)};
      select vault.create_secret(${texto(valor)}, ${texto(nome)}, ${texto(descricao)})
      where not exists (select 1 from vault.secrets where name = ${texto(nome)});
    `)
  }
  console.log(`\n  ✔ Endereço e segredo guardados no Vault${clinica ? ` (${clinica.id})` : ''}.`)
  await sql(`select cron.schedule(${texto(JOB)}, '* * * * *', 'select public.disparar_planos_retomar()')`)
  console.log('  ✔ Cron agendado: de minuto em minuto.')
  await estado()
}

async function desligar() {
  const achou = await sql(`select 1 from cron.job where jobname = ${texto(JOB)}`)
  if (!achou.length) { console.log('\n  · Não havia job agendado.\n'); return }
  await sql(`select cron.unschedule(${texto(JOB)})`)
  console.log('\n  ✔ Cron desagendado. Nenhum plano será retomado.\n')
}

async function estado() {
  const [c] = await sql(`select ativo, modo_teste, planos_retomar_ativo, planos_retomar_dias, planos_retomar_toques,
    to_char(followup_inicio, 'HH24:MI') as inicio, to_char(followup_fim, 'HH24:MI') as fim from public.configuracoes_agente limit 1`)
  const [job] = await sql(`select schedule, active from cron.job where jobname = ${texto(JOB)}`)
  const [fila] = await sql('select count(*)::int as n from public.planos_retomar_pendentes()')
  const [env] = await sql(`select count(*)::int as n from public.agente_planos_retomadas where enviado_em > now() - interval '30 days'`)
  console.log('')
  console.log(`  Cron          ${job ? `${job.schedule}${job.active ? '' : ' (PAUSADO)'}` : 'não agendado — rode npm run planos:ligar'}`)
  console.log(`  Agente        ${c?.ativo ? 'ligada' : 'DESLIGADA — nada é enviado'}${c?.modo_teste ? ', em modo teste (só os números de teste)' : ''}`)
  console.log(`  Retomada      ${c?.planos_retomar_ativo ? `ligada: ${c.planos_retomar_dias} dia(s) de silêncio, até ${c.planos_retomar_toques} toque(s), das ${c.inicio} às ${c.fim}` : 'DESLIGADA — ligue na tela Atendente de IA'}`)
  console.log(`  Fila agora    ${fila?.n ?? 0}`)
  console.log(`  Últimos 30d   ${env?.n ?? 0} retomada(s) enviada(s)`)
  console.log('')
}

const acao = process.argv[2]
if (acao === 'ligar') await ligar()
else if (acao === 'desligar') await desligar()
else if (acao === 'estado') await estado()
else morrer(`Ação desconhecida: "${acao ?? ''}". Use: ligar, desligar, estado.`)
