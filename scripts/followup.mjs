/**
 * Liga, desliga e mostra o follow-up automático (migração 0030).
 *
 *     npm run followup:ligar      agenda o cron de minuto em minuto
 *     npm run followup:desligar   tira o cron da agenda
 *     npm run followup:estado     o job, as últimas batidas e a fila de agora
 *
 * ── POR QUE ISTO NÃO É UMA MIGRAÇÃO ────────────────────────────────────────
 *
 * Agendar o cron exige o ENDEREÇO da sua Edge Function, que carrega o ref do
 * seu projeto, e o WEBHOOK_SEGREDO da sua instalação. Nada disso pode entrar
 * num arquivo versionado — é a mesma regra que tirou o `--project-ref` de
 * dentro do `package.json` (ver `agente-ia/publicar.mjs`): quem clonasse o
 * repositório mandaria o cron do projeto dele bater na função de outra pessoa.
 *
 * Então a migração cria a máquina — a fila, o registro e a `disparar_followups()`
 * — e este script faz a fiação da SUA instalação: guarda endereço e segredo no
 * Vault do seu banco e cria o job.
 *
 * ── O SEGREDO NÃO APARECE NA TELA ──────────────────────────────────────────
 *
 * Ele sai de `agente-ia/.env.agente.local`, vai para o Vault (que guarda
 * cifrado) e nunca é impresso aqui — mesma disciplina do `instalar:conferir`.
 */

import './nunca-estetica.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clinicaDaLinhaDeComando, clinicaPorId, clinicaPorRef } from '../agente-ia/clinicas.mjs'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANAGEMENT = 'https://api.supabase.com/v1'

// A Management API fica atrás do Cloudflare, que devolve `error code: 1010`
// para quem chega sem User-Agent reconhecível.
const AGENTE = 'nucleo-followup/1.0'

/** O nome do job no `cron.job`. Também é como o `desligar` o encontra. */
const JOB = 'followups'

function morrer(mensagem) {
  console.error(`\n  ✖  ${mensagem}\n`)
  process.exit(1)
}

/** Um `.env` simples: `CHAVE=valor`, ignorando comentários. `null` = não existe. */
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

/** `'` vira `''` — o jeito do Postgres de escapar aspa simples em literal. */
const texto = (valor) => `'${String(valor).replace(/'/g, "''")}'`

const cfg = ler(join(RAIZ, '.supabase-token.local'))
if (!cfg) {
  morrer('Falta o .supabase-token.local.\n\n'
    + '     É dele que saem o token e o ref do projeto. O molde\n'
    + '     .supabase-token.example explica como preencher.')
}
const TOKEN = cfg.SUPABASE_ACCESS_TOKEN
const REF = cfg.SUPABASE_PROJECT_REF
if (!TOKEN) morrer('SUPABASE_ACCESS_TOKEN está vazio em .supabase-token.local.')
if (!REF) morrer('SUPABASE_PROJECT_REF está vazio em .supabase-token.local.')

/** Roda SQL no banco pela Management API. Morre com a mensagem do Postgres. */
async function sql(consulta) {
  const r = await fetch(`${MANAGEMENT}/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': AGENTE,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: consulta }),
  })
  const corpo = await r.text()
  if (!r.ok) {
    const mensagem = (() => {
      try { return JSON.parse(corpo).message ?? corpo } catch { return corpo }
    })()
    morrer(`O banco recusou:\n\n     ${String(mensagem).slice(0, 500)}`)
  }
  try { return JSON.parse(corpo) } catch { return [] }
}

/** A migração 0030 rodou? Sem ela não há o que agendar. */
async function exigirMigracao() {
  const achou = await sql(
    `select 1 from pg_proc where proname = 'disparar_followups'
       and pronamespace = 'public'::regnamespace`,
  )
  if (!achou.length) {
    morrer('A migração 0030 ainda não foi aplicada neste banco.\n\n'
      + '     Aplique supabase/migrations/0030_follow_up.sql antes de ligar o\n'
      + '     follow-up — é ela que cria a fila e a função de disparo.')
  }
}

// ===========================================================================
// npm run followup:ligar
// ===========================================================================

async function ligar() {
  await exigirMigracao()

  // O segredo do kit da clínica (clinicas/<nome>/); instalação avulsa ainda
  // usa o de agente-ia/. `-- --clinica <nome>` escolhe; sem ele, vale o ref.
  const pedida = clinicaDaLinhaDeComando()
  const clinica = pedida !== null ? clinicaPorId(pedida) : clinicaPorRef(REF)
  const kit = clinica ? join(clinica.pasta, '.env.agente.local') : join(RAIZ, 'agente-ia', '.env.agente.local')
  const segredo = ler(kit)?.WEBHOOK_SEGREDO
  if (!segredo) {
    morrer(`WEBHOOK_SEGREDO está vazio em ${kit.replace(RAIZ, '.')}.\n\n`
      + '     É o mesmo segredo do webhook: a rota /follow-up recusa quem chega\n'
      + '     sem ele, senão qualquer um faria a agente escrever para os seus\n'
      + '     contatos. O npm run instalar:conferir também acusa esta falta.')
  }

  const url = `https://${REF}.supabase.co/functions/v1/whatsapp/follow-up`

  // O Vault não tem "upsert": ou cria, ou atualiza pelo id. As duas linhas
  // abaixo cobrem os dois casos sem precisar perguntar antes.
  for (const [nome, valor, descricao] of [
    ['followup_url', url, 'Endereco da rota de follow-up da Edge Function whatsapp'],
    ['followup_segredo', segredo, 'O WEBHOOK_SEGREDO, para a rota de follow-up aceitar o cron'],
  ]) {
    await sql(`
      select vault.update_secret(id, ${texto(valor)}, ${texto(nome)}, ${texto(descricao)})
      from vault.secrets where name = ${texto(nome)};

      select vault.create_secret(${texto(valor)}, ${texto(nome)}, ${texto(descricao)})
      where not exists (select 1 from vault.secrets where name = ${texto(nome)});
    `)
  }
  console.log('\n  ✔ Endereço e segredo guardados no Vault do seu projeto.')

  // `cron.schedule` com um nome que já existe REESCREVE o job. É o que faz
  // rodar isto duas vezes não criar dois cron batendo no mesmo minuto.
  await sql(`select cron.schedule(${texto(JOB)}, '* * * * *', 'select public.disparar_followups()')`)
  console.log('  ✔ Cron agendado: de minuto em minuto.')

  await estado()

  console.log('  O relógio está no ar. Quem liga o follow-up e escolhe as etapas é a')
  console.log('  tela Atendente de IA (cartão "Follow-up") — desligado lá, nada sai.\n')
}

// ===========================================================================
// npm run followup:desligar
// ===========================================================================

async function desligar() {
  const achou = await sql(`select 1 from cron.job where jobname = ${texto(JOB)}`)
  if (!achou.length) {
    console.log('\n  · Não havia job agendado. Nada a desligar.\n')
    return
  }
  await sql(`select cron.unschedule(${texto(JOB)})`)
  console.log('\n  ✔ Cron desagendado. Nenhum follow-up será enviado.')
  console.log('    A fila e o histórico continuam no banco, e o npm run')
  console.log('    followup:ligar recoloca tudo no ar.\n')
}

// ===========================================================================
// npm run followup:estado
// ===========================================================================

async function estado() {
  const [config] = await sql(`
    select ativo, followup_ativo, modo_teste,
           followup_1_ativo, followup_1_minutos, followup_2_ativo, followup_2_horas,
           followup_3_ativo, followup_3_dias,
           to_char(followup_inicio, 'HH24:MI') as inicio,
           to_char(followup_fim,    'HH24:MI') as fim
    from public.configuracoes_agente limit 1
  `)

  const [job] = await sql(
    `select schedule, active from cron.job where jobname = ${texto(JOB)}`,
  )

  const fila = await sql('select etapa, count(*)::int as quantos from public.followups_pendentes() group by etapa order by etapa')

  const enviados = await sql(`
    select etapa, count(*)::int as quantos
    from public.agente_followups
    where enviado_em > now() - interval '7 days'
    group by etapa order by etapa
  `)

  // `cron.job_run_details` guarda o `jobid`, não o nome — o join é obrigatório.
  const batidas = await sql(`
    select d.status, count(*)::int as quantas
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
    where j.jobname = ${texto(JOB)} and d.start_time > now() - interval '1 hour'
    group by d.status
  `)

  const conta = (linhas, etapa) =>
    linhas.find((l) => Number(l.etapa) === etapa)?.quantos ?? 0

  console.log('')
  console.log(`  Cron          ${job ? `${job.schedule}${job.active ? '' : ' (PAUSADO)'}` : 'não agendado — rode npm run followup:ligar'}`)
  console.log(`  Batidas 1h    ${batidas.length ? batidas.map((b) => `${b.quantas} ${b.status}`).join(', ') : 'nenhuma ainda'}`)
  console.log(`  Agente        ${config?.ativo ? 'ligado' : 'DESLIGADO — nada é enviado'}${config?.modo_teste ? ', em modo teste' : ''}`)
  console.log(`  Follow-up     ${config?.followup_ativo ? 'ligado' : 'DESLIGADO — ligue na tela Atendente de IA'}`)
  console.log(`  Etapa 1       ${config?.followup_1_ativo ? `${config.followup_1_minutos} minutos de silêncio, a qualquer hora` : 'desligada'}`)
  console.log(`  Etapa 2       ${config?.followup_2_ativo ? `${config.followup_2_horas} horas de silêncio, das ${config.inicio} às ${config.fim}` : 'desligada'}`)
  console.log(`  Etapa 3       ${config?.followup_3_ativo ? `${config.followup_3_dias} dias de silêncio, das ${config.inicio} às ${config.fim}` : 'desligada'}`)
  console.log(`  Fila agora    ${conta(fila, 1)} / ${conta(fila, 2)} / ${conta(fila, 3)} (etapas 1 / 2 / 3)`)
  console.log(`  Últimos 7d    ${conta(enviados, 1)} / ${conta(enviados, 2)} / ${conta(enviados, 3)} enviados (etapas 1 / 2 / 3)`)
  console.log('')
}

const acao = process.argv[2]
if (acao === 'ligar') await ligar()
else if (acao === 'desligar') await desligar()
else if (acao === 'estado') await estado()
else morrer(`Ação desconhecida: "${acao ?? ''}". Use: ligar, desligar, estado.`)
