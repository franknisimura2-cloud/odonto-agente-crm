/**
 * Liga, desliga e mostra o relógio dos lembretes de agendamento (migração 0037).
 *
 *     npm run lembretes:ligar      agenda o cron de minuto em minuto
 *     npm run lembretes:desligar   tira o cron da agenda
 *     npm run lembretes:estado     o job, as últimas batidas e a fila de agora
 *
 * Aceita `-- --clinica <nome>`; sem ele, a clínica é achada pelo ref do
 * `.supabase-token.local` (ver `agente-ia/clinicas.mjs`).
 *
 * ── O RELÓGIO LIGADO NÃO MANDA NADA SOZINHO ────────────────────────────────
 *
 * Quem decide se há lembrete é a chave "Lembretes" da tela Atendente de IA
 * (`configuracoes_agente.lembretes_ativo`), que nasce DESLIGADA. Com ela
 * desligada, a fila fica vazia e o cron bate sem acordar a função. Ligar o
 * relógio é fiação; ligar os lembretes é decisão da clínica, na tela.
 *
 * Mesma disciplina do `followup.mjs`: endereço e segredo vão para o Vault do
 * banco, e o segredo nunca é impresso.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { RAIZ, clinicaDaLinhaDeComando, clinicaPorId, clinicaPorRef } from '../agente-ia/clinicas.mjs'

const MANAGEMENT = 'https://api.supabase.com/v1'
const AGENTE = 'nucleo-lembretes/1.0'
const JOB = 'lembretes'

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
if (!cfg) morrer('Falta o .supabase-token.local (o molde .supabase-token.example explica).')
const TOKEN = cfg.SUPABASE_ACCESS_TOKEN
if (!TOKEN) morrer('SUPABASE_ACCESS_TOKEN está vazio em .supabase-token.local.')

// A clínica: a pedida na linha de comando, ou a dona do ref do token.
const pedida = clinicaDaLinhaDeComando()
const clinica = pedida !== null ? clinicaPorId(pedida) : clinicaPorRef(cfg.SUPABASE_PROJECT_REF)
if (pedida !== null && !clinica) morrer(`Não achei a clínica "${pedida}" em clinicas/.`)
const REF = clinica?.supabase_ref ?? cfg.SUPABASE_PROJECT_REF
if (!REF) morrer('SUPABASE_PROJECT_REF está vazio em .supabase-token.local.')

async function sql(consulta) {
  const r = await fetch(`${MANAGEMENT}/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': AGENTE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: consulta }),
  })
  const corpo = await r.text()
  if (!r.ok) {
    const mensagem = (() => { try { return JSON.parse(corpo).message ?? corpo } catch { return corpo } })()
    morrer(`O banco recusou:\n\n     ${String(mensagem).slice(0, 500)}`)
  }
  try { return JSON.parse(corpo) } catch { return [] }
}

async function ligar() {
  const achou = await sql(`select 1 from pg_proc where proname = 'disparar_lembretes' and pronamespace = 'public'::regnamespace`)
  if (!achou.length) morrer('A migração 0037 ainda não foi aplicada neste banco (node scripts/aplicar-migracoes.mjs).')

  // O segredo do kit da clínica; instalação avulsa ainda usa o de agente-ia/.
  const kit = clinica ? join(clinica.pasta, '.env.agente.local') : join(RAIZ, 'agente-ia', '.env.agente.local')
  const segredo = ler(kit)?.WEBHOOK_SEGREDO
  if (!segredo) morrer(`WEBHOOK_SEGREDO está vazio em ${kit.replace(RAIZ, '.')}.`)

  const url = `https://${REF}.supabase.co/functions/v1/whatsapp/lembretes`

  // `followup_segredo` é compartilhado com o follow-up: um segredo só por
  // instalação, o WEBHOOK_SEGREDO.
  for (const [nome, valor, descricao] of [
    ['lembretes_url', url, 'Endereco da rota de lembretes da Edge Function whatsapp'],
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

  await sql(`select cron.schedule(${texto(JOB)}, '* * * * *', 'select public.disparar_lembretes()')`)
  console.log('  ✔ Cron agendado: de minuto em minuto.')

  await estado()
}

async function desligar() {
  const achou = await sql(`select 1 from cron.job where jobname = ${texto(JOB)}`)
  if (!achou.length) {
    console.log('\n  · Não havia job agendado. Nada a desligar.\n')
    return
  }
  await sql(`select cron.unschedule(${texto(JOB)})`)
  console.log('\n  ✔ Cron desagendado. Nenhum lembrete será enviado.\n')
}

async function estado() {
  const [c] = await sql(`
    select ativo, modo_teste, lembretes_ativo, lembrete_vespera_ativo, lembrete_vespera_horas,
           lembrete_antes_ativo, lembrete_antes_minutos, lembrete_pedir_confirmacao,
           to_char(followup_inicio, 'HH24:MI') as inicio, to_char(followup_fim, 'HH24:MI') as fim
    from public.configuracoes_agente limit 1
  `)
  const [job] = await sql(`select schedule, active from cron.job where jobname = ${texto(JOB)}`)
  const fila = await sql('select etapa, count(*)::int as quantos from public.lembretes_pendentes() group by etapa')
  const enviados = await sql(`
    select etapa, count(*)::int as quantos from public.agente_lembretes
    where enviado_em > now() - interval '7 days' group by etapa
  `)
  const [conf] = await sql(`select count(*)::int as n from public.consultas where confirmada_em > now() - interval '7 days'`)
  const batidas = await sql(`
    select d.status, count(*)::int as quantas from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
    where j.jobname = ${texto(JOB)} and d.start_time > now() - interval '1 hour'
    group by d.status
  `)
  const conta = (linhas, etapa) => linhas.find((l) => l.etapa === etapa)?.quantos ?? 0

  console.log('')
  console.log(`  Cron          ${job ? `${job.schedule}${job.active ? '' : ' (PAUSADO)'}` : 'não agendado — rode npm run lembretes:ligar'}`)
  console.log(`  Batidas 1h    ${batidas.length ? batidas.map((b) => `${b.quantas} ${b.status}`).join(', ') : 'nenhuma ainda'}`)
  console.log(`  Agente        ${c?.ativo ? 'ligada' : 'DESLIGADA — nada é enviado'}${c?.modo_teste ? ', em modo teste (só os números de teste)' : ''}`)
  console.log(`  Lembretes     ${c?.lembretes_ativo ? 'ligados' : 'DESLIGADOS — ligue na tela Atendente de IA'}`)
  console.log(`  Véspera       ${c?.lembrete_vespera_ativo ? `${c.lembrete_vespera_horas} h antes, das ${c.inicio} às ${c.fim}${c.lembrete_pedir_confirmacao ? ', pedindo SIM' : ''}` : 'desligada'}`)
  console.log(`  Antes         ${c?.lembrete_antes_ativo ? `${c.lembrete_antes_minutos} min antes` : 'desligado'}`)
  console.log(`  Fila agora    ${conta(fila, 'vespera')} véspera, ${conta(fila, 'antes')} antes`)
  console.log(`  Últimos 7d    ${conta(enviados, 'vespera')} véspera, ${conta(enviados, 'antes')} antes, ${conf?.n ?? 0} confirmações`)
  console.log('')
}

const acao = process.argv[2]
if (acao === 'ligar') await ligar()
else if (acao === 'desligar') await desligar()
else if (acao === 'estado') await estado()
else morrer(`Ação desconhecida: "${acao ?? ''}". Use: ligar, desligar, estado.`)
