/**
 * Os dois passos da instalação que eram conferência de olho e clique em painel
 * — agora comandos, para a IA da IDE conduzir a instalação sem a pessoa abrir
 * nenhum painel do Supabase.
 *
 *     npm run instalar:conferir
 *         confere os três arquivos de chave: formato, e se cada serviço aceita
 *
 *     npm run instalar:usuario -- dona@empresa.com.br --nome "Maria Souza"
 *         liga a regra de senha forte e cria o primeiro usuário, já confirmado,
 *         com uma senha provisória
 *
 * Quem chama os dois, e em que ordem, é o INSTALACAO.md (partes 2 e 3).
 *
 * ── NENHUMA CHAVE APARECE NA TELA ──────────────────────────────────────────
 *
 * A conferência diz se cada linha está certa, e nunca o valor dela. É o que
 * permite à IA conduzir a instalação sem que a pessoa cole chave nenhuma no
 * chat — chave colada na conversa fica gravada no histórico, e o token do
 * Supabase abre a conta inteira dela. E cada chave é testada só no próprio
 * dono: a da OpenAI vai para a OpenAI, a da ponte para o servidor da ponte.
 *
 * ── A CHAVE SECRETA DO PROJETO NÃO FICA EM LUGAR NENHUM ────────────────────
 *
 * Criar usuário exige a chave secreta do projeto (`service_role`), que este
 * repositório nunca guarda. O `usuario` pede ela à Management API com o token
 * de `.supabase-token.local`, usa uma vez, e ela morre com o processo — não
 * vai para arquivo, nem para a tela.
 */

import './nunca-estetica.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { randomInt } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANAGEMENT = 'https://api.supabase.com/v1'

// A Management API fica atrás do Cloudflare, que devolve `error code: 1010`
// para quem chega sem um User-Agent reconhecível (seção 10.5 do
// agente-ia/README.md).
const AGENTE = 'nucleo-instalacao/1.0'

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

function morrer(mensagem) {
  console.error(`\n  ✖  ${mensagem}\n`)
  process.exit(1)
}

/**
 * Um pedido com prazo. Nunca lança: `status 0` é "não respondeu" — sem
 * internet, endereço errado, servidor fora do ar.
 */
async function pedir(url, init = {}) {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) })
    const texto = await r.text()
    let corpo = null
    try { corpo = JSON.parse(texto) } catch { corpo = texto }
    return { status: r.status, corpo }
  } catch {
    return { status: 0, corpo: null }
  }
}

function management(caminho, token, init = {}) {
  return pedir(`${MANAGEMENT}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': AGENTE,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

/** `https://abc….supabase.co` → `abc…`. `null` quando não é esse formato. */
function refDaUrl(url) {
  return /^https:\/\/([a-z0-9]{20})\.supabase\.co$/.exec(url ?? '')?.[1] ?? null
}

// ===========================================================================
// npm run instalar:conferir
// ===========================================================================

const OK = 'ok'
const ERRO = 'erro'
const AVISO = 'aviso'
const INFO = 'info'

const SINAL = { [OK]: '✔', [ERRO]: '✖', [AVISO]: '!', [INFO]: '·' }

/**
 * A chave que vai no `.env` — que vira JavaScript no navegador — é pública ou
 * secreta? As antigas são JWT, com o papel escrito dentro; as novas trazem o
 * tipo no prefixo.
 */
function papelDaChave(chave) {
  if (chave.startsWith('sb_secret_')) return { tipo: 'secreta' }
  if (chave.startsWith('sb_publishable_')) return { tipo: 'publica' }
  if (chave.startsWith('eyJ')) {
    try {
      const corpo = JSON.parse(Buffer.from(chave.split('.')[1], 'base64url').toString('utf8'))
      if (corpo.role === 'anon') return { tipo: 'publica', ref: corpo.ref }
      if (corpo.role === 'service_role') return { tipo: 'secreta', ref: corpo.ref }
    } catch {
      // Cai no "não parece uma chave", logo abaixo.
    }
  }
  return { tipo: 'estranha' }
}

async function conferirEnv(env, relato) {
  const linha = (chave, estado, texto) => relato.push({ arquivo: '.env', chave, estado, texto })

  if (!env) {
    linha('', ERRO, 'o arquivo não existe. Crie a partir do molde: cp .env.example .env')
    return null
  }

  const url = env.VITE_SUPABASE_URL ?? ''
  const painel = /supabase\.com\/dashboard\/project\/([a-z0-9]{20})/.exec(url)
  let ref = null
  if (!url) {
    linha('VITE_SUPABASE_URL', ERRO, 'vazio. É o "Project URL" do painel do Supabase')
  } else if (painel) {
    // O ref está certo, só o formato não — e ele serve para conferir o resto.
    ref = painel[1]
    linha('VITE_SUPABASE_URL', ERRO,
      `isto é o endereço do PAINEL. O do projeto é https://${painel[1]}.supabase.co`)
  } else if (url.endsWith('/')) {
    linha('VITE_SUPABASE_URL', ERRO, 'tire a barra do fim')
  } else if (!(ref = refDaUrl(url))) {
    linha('VITE_SUPABASE_URL', ERRO, 'não parece o endereço de um projeto (https://….supabase.co)')
  } else {
    linha('VITE_SUPABASE_URL', OK, `o projeto ${ref}`)
  }

  const chave = env.VITE_SUPABASE_ANON_KEY ?? ''
  const papel = papelDaChave(chave)
  if (!chave) {
    linha('VITE_SUPABASE_ANON_KEY', ERRO, 'vazia. É a chave pública (anon / publishable) do painel')
  } else if (papel.tipo === 'secreta') {
    // O erro mais caro da instalação inteira: este arquivo vai para o
    // navegador de qualquer visitante, e esta chave passa por cima do RLS.
    linha('VITE_SUPABASE_ANON_KEY', ERRO,
      'PERIGO: esta é a chave SECRETA (service_role / secret). Aqui ela iria para o navegador '
      + 'de qualquer visitante, e ela passa por cima de toda a segurança do banco. '
      + 'Troque pela pública (anon / publishable)')
  } else if (papel.tipo === 'estranha') {
    linha('VITE_SUPABASE_ANON_KEY', ERRO,
      'não parece uma chave do Supabase. A pública começa com eyJ ou com sb_publishable_')
  } else if (papel.ref && ref && papel.ref !== ref) {
    linha('VITE_SUPABASE_ANON_KEY', ERRO, `é do projeto ${papel.ref}, e não do ${ref}`)
  } else if (ref && !painel) {
    const r = await pedir(`${url}/auth/v1/settings`, { headers: { apikey: chave } })
    if (r.status === 200) linha('VITE_SUPABASE_ANON_KEY', OK, 'a chave pública, e o Supabase aceitou')
    else if (r.status === 401 || r.status === 403) {
      linha('VITE_SUPABASE_ANON_KEY', ERRO, 'o Supabase recusou esta chave. Copie de novo, inteira')
    } else if (r.status === 0) {
      // Projeto recém-criado leva uns minutos para existir na rede.
      linha('VITE_SUPABASE_ANON_KEY', AVISO,
        'o formato está certo, mas o endereço não respondeu. O projeto já terminou de ser criado?')
    } else {
      linha('VITE_SUPABASE_ANON_KEY', AVISO, `o formato está certo, mas o Supabase respondeu ${r.status}`)
    }
  } else {
    linha('VITE_SUPABASE_ANON_KEY', AVISO, 'o formato está certo; o teste espera o endereço acima')
  }

  // Tudo que começa com VITE_ vira JavaScript no navegador. As duas de cima
  // podem; qualquer outra, só se não for segredo.
  for (const [nome, valor] of Object.entries(env)) {
    if (nome.startsWith('VITE_') && valor && !['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].includes(nome)) {
      linha(nome, AVISO, 'também vai para o navegador de quem abrir o site. Se for chave, tire daqui')
    }
  }

  return ref
}

async function conferirToken(cfg, refDaTela, relato) {
  const linha = (chave, estado, texto) =>
    relato.push({ arquivo: '.supabase-token.local', chave, estado, texto })

  if (!cfg) {
    linha('', AVISO,
      'o arquivo não existe. A instalação precisa dele (cp .supabase-token.example '
      + '.supabase-token.local); depois da parte 6 do INSTALACAO.md, é normal não existir')
    return
  }

  const ref = cfg.SUPABASE_PROJECT_REF ?? ''
  if (!ref) linha('SUPABASE_PROJECT_REF', ERRO, 'vazio. São as 20 letras da URL do painel')
  else if (!/^[a-z0-9]{20}$/.test(ref)) linha('SUPABASE_PROJECT_REF', ERRO, 'não parece um ref: são 20 letras minúsculas')
  else if (!refDaTela) linha('SUPABASE_PROJECT_REF', OK, 'o formato está certo; o .env ainda não tem endereço para comparar')
  else if (ref !== refDaTela) {
    linha('SUPABASE_PROJECT_REF', ERRO,
      `não bate com o VITE_SUPABASE_URL (${ref} × ${refDaTela}) — um dos dois é de outro projeto`)
  } else linha('SUPABASE_PROJECT_REF', OK, 'bate com o endereço do .env')

  const token = cfg.SUPABASE_ACCESS_TOKEN ?? ''
  const alvo = /^[a-z0-9]{20}$/.test(ref) ? ref : refDaTela
  if (!token) {
    linha('SUPABASE_ACCESS_TOKEN', ERRO, 'vazio. É o token da conta, gerado em supabase.com/dashboard/account/tokens')
  } else if (!token.startsWith('sbp_')) {
    linha('SUPABASE_ACCESS_TOKEN', ERRO,
      'o token da conta começa com sbp_. As chaves do projeto (anon, service_role) não servem aqui')
  } else if (!alvo) {
    linha('SUPABASE_ACCESS_TOKEN', AVISO, 'o formato está certo; o teste espera um ref válido')
  } else {
    const r = await management(`/projects/${alvo}`, token)
    if (r.status === 200) linha('SUPABASE_ACCESS_TOKEN', OK, `o Supabase aceitou, e ele enxerga o projeto ${alvo}`)
    else if (r.status === 401) {
      linha('SUPABASE_ACCESS_TOKEN', ERRO, 'o Supabase recusou: token errado, incompleto ou já revogado')
    } else if (r.status === 403 || r.status === 404) {
      linha('SUPABASE_ACCESS_TOKEN', ERRO, `o token vale, mas não enxerga o projeto ${alvo}. É de outra conta?`)
    } else if (r.status === 0) {
      linha('SUPABASE_ACCESS_TOKEN', AVISO, 'o formato está certo, mas não consegui testar (sem internet?)')
    } else {
      linha('SUPABASE_ACCESS_TOKEN', AVISO, `o formato está certo, mas o Supabase respondeu ${r.status}`)
    }
  }
}

/** Evolution: a chave abre o servidor, e a instância precisa existir lá dentro. */
async function conferirEvolution(url, chave, instancia, linha) {
  const r = await pedir(`${url}/instance/fetchInstances`, { headers: { apikey: chave } })
  if (r.status === 0) {
    linha('EVOLUTION_API_URL', ERRO, 'o servidor não respondeu. O endereço está certo? Ele está no ar?')
    return
  }
  if (r.status === 401 || r.status === 403) {
    linha('EVOLUTION_API_KEY', ERRO, 'o servidor da Evolution recusou esta chave')
    return
  }
  if (r.status !== 200) {
    linha('EVOLUTION_API_URL', ERRO, `o servidor respondeu ${r.status}. É mesmo o endereço da Evolution?`)
    return
  }
  const todas = (Array.isArray(r.corpo) ? r.corpo : [r.corpo])
    .map((i) => i?.instance ?? i)
    .map((i) => i?.name ?? i?.instanceName)
    .filter(Boolean)
  if (todas.includes(instancia)) {
    linha('Evolution', OK, `o servidor aceitou a chave, e a instância "${instancia}" existe`)
  } else {
    // Os nomes não são segredo: é o que se escolhe ao criar a instância.
    linha('EVOLUTION_INSTANCIA', ERRO,
      `o servidor aceitou a chave, mas não tem instância "${instancia}"`
      + (todas.length ? `. As que existem: ${todas.join(', ')}` : '. Ele não tem nenhuma'))
  }
}

/** uazapi: o token é da instância, e responde o estado dela. */
async function conferirUazapi(url, token, linha) {
  const r = await pedir(`${url}/instance/status`, { headers: { token } })
  if (r.status === 0) {
    linha('UAZAPI_API_URL', ERRO, 'o servidor não respondeu. O endereço está certo?')
    return
  }
  if (r.status === 401 || r.status === 403) {
    linha('UAZAPI_TOKEN', ERRO, 'a uazapi recusou este token. É o da INSTÂNCIA, e não o admin?')
    return
  }
  if (r.status !== 200) {
    linha('UAZAPI_API_URL', ERRO, `o servidor respondeu ${r.status}. É mesmo o endereço da uazapi?`)
    return
  }
  const conectado = r.corpo?.status?.connected === true
    || String(r.corpo?.instance?.status ?? '').toLowerCase() === 'connected'
  linha('uazapi', OK, conectado
    ? 'a uazapi aceitou o token, e já tem um número conectado'
    : 'a uazapi aceitou o token. Nenhum número conectado ainda — normal: ele se conecta pela tela')
}

async function conferirAgente(agente, relato) {
  const arquivo = 'agente-ia/.env.agente.local'
  const linha = (chave, estado, texto) => relato.push({ arquivo, chave, estado, texto })

  // Sem este arquivo o sistema de gestão funciona inteiro — só não tem o
  // WhatsApp. Não é erro: o INSTALACAO.md deixa ele para depois, se a empresa
  // quiser.
  if (!agente || Object.values(agente).every((v) => !v)) {
    linha('', INFO,
      'vazio ou inexistente. Sem ele o sistema de gestão funciona inteiro; '
      + 'o WhatsApp e a atendente de IA ficam para depois')
    return
  }

  const openai = agente.OPENAI_API_KEY ?? ''
  if (!openai) {
    linha('OPENAI_API_KEY', ERRO, 'vazia, e é obrigatória: é ela que ouve os áudios e vê as fotos, mesmo com um Claude na tela')
  } else if (!openai.startsWith('sk-')) {
    linha('OPENAI_API_KEY', ERRO, 'não parece uma chave da OpenAI: ela começa com sk-')
  } else {
    const r = await pedir('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${openai}` } })
    if (r.status === 200) linha('OPENAI_API_KEY', OK, 'a OpenAI aceitou (se a conta tem saldo, a primeira conversa diz)')
    else if (r.status === 401) linha('OPENAI_API_KEY', ERRO, 'a OpenAI recusou esta chave. Copie de novo, inteira')
    else linha('OPENAI_API_KEY', AVISO, r.status ? `a OpenAI respondeu ${r.status}` : 'não consegui testar (sem internet?)')
  }

  const anthropic = agente.ANTHROPIC_API_KEY ?? ''
  if (!anthropic) {
    linha('ANTHROPIC_API_KEY', INFO, 'vazia. É opcional: sem ela, os modelos Claude aparecem desligados na tela')
  } else if (!anthropic.startsWith('sk-ant-')) {
    linha('ANTHROPIC_API_KEY', ERRO, 'não parece uma chave da Anthropic: ela começa com sk-ant-')
  } else {
    const r = await pedir('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': anthropic, 'anthropic-version': '2023-06-01' },
    })
    if (r.status === 200) linha('ANTHROPIC_API_KEY', OK, 'a Anthropic aceitou')
    else if (r.status === 401) linha('ANTHROPIC_API_KEY', ERRO, 'a Anthropic recusou esta chave. Copie de novo, inteira')
    else linha('ANTHROPIC_API_KEY', AVISO, r.status ? `a Anthropic respondeu ${r.status}` : 'não consegui testar (sem internet?)')
  }

  // O segredo vai no cabeçalho (Evolution) ou na URL (uazapi), e passa pelo
  // `supabase secrets set`, que lê o arquivo com as regras dele: um `#` depois
  // de espaço vira comentário. Letras, números e hífen passam por tudo.
  const segredo = agente.WEBHOOK_SEGREDO ?? ''
  if (!segredo) {
    linha('WEBHOOK_SEGREDO', ERRO,
      'vazio: o sistema recusaria toda mensagem. Invente uma frase longa, como girafa-azul-42-parafuso-lento')
  } else if (/[^A-Za-z0-9_-]/.test(segredo)) {
    linha('WEBHOOK_SEGREDO', AVISO,
      'use só letras, números, hífen e sublinhado — espaço, # e & podem se perder no caminho')
  } else if (segredo.length < 16) {
    linha('WEBHOOK_SEGREDO', AVISO, `curto (${segredo.length} caracteres). Uma frase longa é mais difícil de adivinhar`)
  } else {
    linha('WEBHOOK_SEGREDO', OK, `preenchido (${segredo.length} caracteres)`)
  }

  // As pontes: UMA precisa estar completa. As duas preenchidas pode — quem
  // decide qual vale é o seletor da tela, e não a presença da chave.
  const evo = ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCIA']
  const uaz = ['UAZAPI_API_URL', 'UAZAPI_TOKEN']
  const temEvo = evo.some((c) => agente[c])
  const temUaz = uaz.some((c) => agente[c])

  if (!temEvo && !temUaz) {
    linha('Ponte do WhatsApp', ERRO, 'nenhuma preenchida. Preencha o bloco da Evolution OU o da uazapi')
  }
  if (temEvo && temUaz) {
    linha('Ponte do WhatsApp', INFO,
      'as duas preenchidas. Tudo bem: vale a escolhida na tela (Atendente de IA → Conexão do WhatsApp)')
  }

  for (const [tem, chaves, testar] of [
    [temEvo, evo, () => conferirEvolution(agente.EVOLUTION_API_URL.replace(/\/+$/, ''),
      agente.EVOLUTION_API_KEY, agente.EVOLUTION_INSTANCIA, linha)],
    [temUaz, uaz, () => conferirUazapi(agente.UAZAPI_API_URL.replace(/\/+$/, ''), agente.UAZAPI_TOKEN, linha)],
  ]) {
    if (!tem) continue
    const faltam = chaves.filter((c) => !agente[c])
    const url = agente[chaves[0]] ?? ''
    if (faltam.length) linha(faltam.join(', '), ERRO, 'vazio — o bloco desta ponte está pela metade')
    else if (!/^https?:\/\/\S+$/.test(url)) linha(chaves[0], ERRO, 'não parece um endereço (https://…)')
    else await testar()
  }

  if (agente.UAZAPI_ADMIN_TOKEN) {
    linha('UAZAPI_ADMIN_TOKEN', AVISO, 'deixe vazio: o sistema nunca usa, e chave a mais no servidor é risco à toa')
  }
}

async function conferir(pasta) {
  const relato = []
  const ref = await conferirEnv(ler(join(pasta, '.env')), relato)
  await conferirToken(ler(join(pasta, '.supabase-token.local')), ref, relato)
  await conferirAgente(ler(join(pasta, 'agente-ia', '.env.agente.local')), relato)

  console.log('\n  Conferindo as chaves — nenhum valor aparece aqui, só se ele está certo.')
  let atual = ''
  const largura = Math.max(...relato.map((l) => l.chave.length))
  for (const l of relato) {
    if (l.arquivo !== atual) {
      atual = l.arquivo
      console.log(`\n  ${atual}`)
    }
    console.log(`    ${SINAL[l.estado]} ${l.chave.padEnd(largura)}  ${l.texto}`)
  }

  const erros = relato.filter((l) => l.estado === ERRO).length
  const avisos = relato.filter((l) => l.estado === AVISO).length
  if (erros) {
    console.log(`\n  ${erros} ${erros === 1 ? 'coisa' : 'coisas'} para arrumar. Corrija no arquivo e rode de novo.\n`)
    process.exit(1)
  }
  console.log(avisos
    ? `\n  Nada impede seguir. ${avisos === 1 ? 'Um aviso' : `${avisos} avisos`} acima, para ler.\n`
    : '\n  Tudo certo.\n')
}

// ===========================================================================
// npm run instalar:usuario -- email [--nome "Nome"]
// ===========================================================================

/**
 * A mesma regra que a tela explica em Configurações → Perfil (`REGRAS_SENHA`)
 * — 10 caracteres e as quatro classes. É um dos quatro valores que a
 * Management API aceita, copiado da especificação dela: o conjunto de símbolos
 * é o do Supabase, com a barra e os dois-pontos escapados.
 */
const QUATRO_CLASSES =
  'abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};\'\\\\:"|<>?,./`~'

/**
 * A senha provisória: 16 caracteres, com uma de cada classe garantida.
 *
 * Sem os que se confundem na hora de ler e digitar (l, I, 1, O, 0), porque ela
 * vai ser lida numa tela e digitada em outra. Os símbolos são do conjunto que
 * o Supabase aceita.
 */
function senhaProvisoria() {
  const grupos = ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%&*?+=']
  const sortear = (s) => s[randomInt(s.length)]
  const letras = grupos.map(sortear)
  while (letras.length < 16) letras.push(sortear(grupos.join('')))
  for (let i = letras.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[letras[i], letras[j]] = [letras[j], letras[i]]
  }
  return letras.join('')
}

async function criarUsuario(args) {
  const email = (args[0] ?? '').trim().toLowerCase()
  const i = args.indexOf('--nome')
  const nome = i >= 0 ? (args[i + 1] ?? '').trim() : ''

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    morrer('Uso: npm run instalar:usuario -- dona@empresa.com.br --nome "Maria Souza"\n\n'
      + '     O e-mail é o de quem vai entrar no sistema. O nome é opcional.')
  }

  const cfg = ler(join(RAIZ, '.supabase-token.local'))
  const token = cfg?.SUPABASE_ACCESS_TOKEN
  const ref = cfg?.SUPABASE_PROJECT_REF
  if (!token || !ref) {
    morrer('Falta o .supabase-token.local, ou uma das duas linhas dele.\n\n'
      + '     Rode npm run instalar:conferir para ver qual.')
  }

  // 1. A regra de senha. Um projeto novo aceita seis caracteres sem exigência
  //    nenhuma — e a tela mostraria uma lista de requisitos que o servidor não
  //    cobra.
  const regra = await management(`/projects/${ref}/config/auth`, token, {
    method: 'PATCH',
    body: JSON.stringify({ password_min_length: 10, password_required_characters: QUATRO_CLASSES }),
  })
  if (regra.status !== 200) {
    morrer(`O Supabase não aceitou a regra de senha (resposta ${regra.status}).\n\n`
      + `     ${JSON.stringify(regra.corpo).slice(0, 300)}`)
  }
  console.log('\n  ✔ Regra de senha ligada: 10 caracteres ou mais, com minúscula, maiúscula, número e símbolo.')

  // 2. Senhas vazadas, num pedido à parte: o Supabase pode recusar pelo plano,
  //    e a recusa não pode derrubar a regra de cima junto.
  const vazadas = await management(`/projects/${ref}/config/auth`, token, {
    method: 'PATCH',
    body: JSON.stringify({ password_hibp_enabled: true }),
  })
  console.log(vazadas.status === 200
    ? '  ✔ Senhas que já vazaram na internet também são recusadas.'
    : '  · A recusa de senhas vazadas não ligou (no Supabase, ela costuma ser do plano pago). O resto da regra vale.')

  // 3. A chave que cria usuário — só em memória, e só até o fim do processo.
  const chaves = await management(`/projects/${ref}/api-keys?reveal=true`, token)
  const lista = Array.isArray(chaves.corpo) ? chaves.corpo : []
  const secreta = (lista.find((k) => k.name === 'service_role') ?? lista.find((k) => k.type === 'secret'))?.api_key
  if (!secreta) {
    morrer(`Não consegui a chave do projeto para criar o usuário (resposta ${chaves.status}).\n\n`
      + '     Dá para criar pelo painel: Authentication → Users → Add user,\n'
      + '     marcando "Auto Confirm User".')
  }

  // As chaves antigas são JWT e vão também no Authorization; as novas
  // (`sb_secret_`) não são JWT, e o Supabase só as aceita no `apikey`.
  const cabecalhos = { apikey: secreta, 'Content-Type': 'application/json' }
  if (secreta.startsWith('eyJ')) cabecalhos.Authorization = `Bearer ${secreta}`

  // 4. O usuário, já confirmado. Sem `email_confirm`, o Supabase exige clicar
  //    num e-mail — e o login responde "e-mail ou senha incorretos", que manda
  //    procurar o problema no lugar errado.
  const senha = senhaProvisoria()
  const criado = await pedir(`https://${ref}.supabase.co/auth/v1/admin/users`, {
    method: 'POST',
    headers: cabecalhos,
    body: JSON.stringify({
      email,
      password: senha,
      email_confirm: true,
      // O gatilho `handle_new_user` (0001) lê daqui o nome do perfil.
      user_metadata: nome ? { nome } : {},
    }),
  })

  if (criado.status !== 200 && criado.status !== 201) {
    if (criado.status === 422 && /already|exists/i.test(JSON.stringify(criado.corpo ?? ''))) {
      morrer(`Já existe um usuário com o e-mail ${email}.\n\n`
        + '     Se ninguém lembra a senha dele: apague-o no painel do Supabase\n'
        + '     (Authentication → Users) e rode este comando de novo.')
    }
    morrer(`O Supabase não criou o usuário (resposta ${criado.status}).\n\n`
      + `     ${JSON.stringify(criado.corpo).slice(0, 300)}`)
  }

  console.log(`  ✔ Usuário criado, e já confirmado.

      E-mail:            ${email}
      Senha provisória:  ${senha}

    Troque no primeiro acesso: Configurações → Perfil → Alterar Senha.
    A provisória fica escrita nesta conversa; a nova, só com você.
`)
}

// ===========================================================================

const [acao, ...resto] = process.argv.slice(2)

if (acao === 'conferir') await conferir(resto[0] ? resolve(resto[0]) : RAIZ)
else if (acao === 'usuario') await criarUsuario(resto)
else morrer(`Ação desconhecida: "${acao ?? ''}". Use: conferir, usuario`)
