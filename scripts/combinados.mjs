/**
 * Liga, desliga e mostra o relógio do retorno COMBINADO (não confundir com o
 * retorno periódico da limpeza, que é o `retornos.mjs`) (migração 0048).
 *
 *     npm run combinados:ligar      agenda o cron de 5 em 5 minutos
 *     npm run combinados:desligar   tira o cron da agenda
 *     npm run combinados:estado     o job, a fila de agora e o que saiu
 *
 * Aceita `-- --clinica <nome>`; sem ele, a clínica é achada pelo ref do
 * `.supabase-token.local` (ver `agente-ia/clinicas.mjs`).
 *
 * ── O RELÓGIO LIGADO NÃO MANDA NADA SOZINHO ────────────────────────────────
 *
 * Quem decide é a chave "Retornos combinados" da tela Atendente de IA
 * (`configuracoes_agente.retornos_combinados_ativo`), que nasce DESLIGADA.
 * Com ela desligada, a fila fica vazia e o cron bate sem acordar a função.
 *
 * DE 5 EM 5 MINUTOS, e não de minuto em minuto como os lembretes: o retorno
 * é marcado por dia, não por hora. Cinco minutos de atraso não mudam nada.
 *
 * Mesma disciplina do `lembretes.mjs`: endereço e segredo vão para o Vault do
 * banco, e o segredo nunca é impresso.
 */

import './nunca-estetica.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { RAIZ, clinicaDaLinhaDeComando, clinicaPorId, clinicaPorRef } from '../agente-ia/clinicas.mjs'

const MANAGEMENT = 'https://api.supabase.com/v1'
const AGENTE = 'odonto-combinados/1.0'
const JOB = 'retornos_combinados'

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
  const achou = await sql(`select 1 from pg_proc where proname = 'disparar_retornos_combinados' and pronamespace = 'public'::regnamespace`)
  if (!achou.length) morrer('A migração 0048 ainda não foi aplicada neste banco (node scripts/aplicar-migracoes.mjs).')

  const kit = clinica ? join(clinica.pasta, '.env.agente.local') : join(RAIZ, 'agente-ia', '.env.agente.local')
  const segredo = ler(kit)?.WEBHOOK_SEGREDO
  if (!segredo) morrer(`WEBHOOK_SEGREDO está vazio em ${kit.replace(RAIZ, '.')}.`)

  const url = `https://${REF}.supabase.co/functions/v1/whatsapp/retornos-combinados`

  for (const [nome, valor, descricao] of [
    ['retornos_combinados_url', url, 'Endereco da rota do retorno combinado da Edge Function whatsapp'],
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

  await sql(`select cron.schedule(${texto(JOB)}, '*/5 * * * *', 'select public.disparar_retornos_combinados()')`)
  console.log('  ✔ Cron agendado: de 5 em 5 minutos.')

  await estado()
}

async function desligar() {
  const achou = await sql(`select 1 from cron.job where jobname = ${texto(JOB)}`)
  if (!achou.length) {
    console.log('\n  · Não havia job agendado. Nada a desligar.\n')
    return
  }
  await sql(`select cron.unschedule(${texto(JOB)})`)
  console.log('\n  ✔ Cron desagendado. Nenhum retorno combinado será enviado.\n')
}

async function estado() {
  const [c] = await sql(`
    select ativo, modo_teste, retornos_combinados_ativo,
           to_char(followup_inicio, 'HH24:MI') as inicio, to_char(followup_fim, 'HH24:MI') as fim
    from public.configuracoes_agente limit 1
  `)
  const [job] = await sql(`select schedule, active from cron.job where jobname = ${texto(JOB)}`)
  const [fila] = await sql('select count(*)::int as n from public.retornos_combinados_pendentes()')
  const [n] = await sql(`
    select count(*) filter (where situacao = 'agendado')::int as agendados,
           count(*) filter (where situacao = 'enviado' and enviado_em > now() - interval '30 days')::int as enviados
    from public.retornos_combinados
  `)

  console.log('')
  console.log(`  Cron          ${job ? `${job.schedule}${job.active ? '' : ' (PAUSADO)'}` : 'não agendado — rode npm run combinados:ligar'}`)
  console.log(`  Agente        ${c?.ativo ? 'ligada' : 'DESLIGADA — nada é enviado'}${c?.modo_teste ? ', em modo teste (só os números de teste)' : ''}`)
  console.log(`  Retornos      ${c?.retornos_combinados_ativo ? `ligados, das ${c.inicio} às ${c.fim}` : 'DESLIGADOS — ligue na tela Atendente de IA'}`)
  console.log(`  Fila agora    ${fila?.n ?? 0}`)
  console.log(`  Combinados    ${n?.agendados ?? 0} a enviar · ${n?.enviados ?? 0} enviado(s) nos últimos 30 dias`)
  console.log('')
}

const acao = process.argv[2]
if (acao === 'ligar') await ligar()
else if (acao === 'desligar') await desligar()
else if (acao === 'estado') await estado()
else morrer(`Ação desconhecida: "${acao ?? ''}". Use: ligar, desligar, estado.`)
