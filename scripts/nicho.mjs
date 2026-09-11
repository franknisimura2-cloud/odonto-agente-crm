#!/usr/bin/env node
/**
 * npm run nicho — onde as palavras de um nicho aparecem no texto do sistema.
 *
 * Conta só o que alguém LÊ: o texto das telas, as frases do servidor e o
 * prompt da Letícia. Comentário não conta, e nome interno (tabela, rota, chave
 * de status) fica numa conta à parte — `consultas` é o nome de uma tabela,
 * `'Consultas'` é o título de uma coluna, e só o segundo é vocabulário.
 *
 *   npm run nicho                      palavras do nicho de origem (odontologia)
 *   npm run nicho -- cliente serviço   outras palavras (o plural entra sozinho)
 *   npm run nicho -- --lista           cada ocorrência, com arquivo e linha
 *   npm run nicho -- --internos        inclui os nomes internos na conta
 *   npm run nicho -- --falhar          sai com erro se sobrar alguma
 *
 * Os arquivos .ts e .tsx são lidos pelo compilador do TypeScript, e não por
 * expressão regular: é ele que sabe onde termina um comentário e começa uma
 * string. As migrações ficam de fora — as antigas nunca são editadas, então
 * o texto delas não diz o que o banco tem hoje.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const PASTAS = [
  { pasta: 'src', extensoes: ['.ts', '.tsx'] },
  // prompt-oficial.ts é gerado a partir do prompt.md, que já é lido abaixo
  { pasta: 'supabase/functions', extensoes: ['.ts'], fora: ['_shared/prompt-oficial.ts'] },
]
const TEXTOS_CORRIDOS = ['agente-ia/prompt.md', 'index.html']

// `*` no fim = qualquer terminação (odontologia, odontológico…)
const PALAVRAS_DE_ORIGEM = [
  'paciente', 'dentista', 'consulta', 'procedimento', 'clínica',
  'odonto*', 'secretária', 'dente', 'dental', 'dentári*',
]

// ── Argumentos ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const opcoes = new Set(args.filter((a) => a.startsWith('--')))
const escolhidas = args.filter((a) => !a.startsWith('--'))
const palavras = escolhidas.length ? escolhidas : PALAVRAS_DE_ORIGEM

// ── Palavra → expressão ────────────────────────────────────────────────────

const VARIANTES = { a: 'aáàâã', e: 'eéê', i: 'ií', o: 'oóôõ', u: 'uúü', c: 'cç' }

const semAcento = (s) => s.normalize('NFD').replace(/\p{M}/gu, '')
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** "clínica" casa com Clínica, CLINICA e clinica — acento e caixa não importam. */
function tolerante(palavra) {
  return [...semAcento(palavra.toLowerCase())]
    .map((ch) => (VARIANTES[ch] ? `[${VARIANTES[ch]}]` : escapar(ch)))
    .join('')
}

/** Singular e plural, pela regra geral do português. */
function formas(palavra) {
  const p = palavra.toLowerCase()
  if (p.endsWith('ão')) {
    const raiz = p.slice(0, -2)
    return [p, `${raiz}ões`, `${raiz}ães`, `${raiz}ãos`]
  }
  if (/[aeou]l$/.test(p)) return [p, `${p.slice(0, -1)}is`] // profissional → profissionais
  if (p.endsWith('m')) return [p, `${p.slice(0, -1)}ns`]
  if (/[rzs]$/.test(p)) return [p, `${p}es`]
  return [p, `${p}s`]
}

const ANTES = '(?<![\\p{L}\\p{N}_])'
const DEPOIS = '(?![\\p{L}\\p{N}_])'

function expressao(palavra) {
  if (palavra.endsWith('*')) {
    return new RegExp(`${ANTES}${tolerante(palavra.slice(0, -1))}\\p{L}*`, 'giu')
  }
  const alternativas = formas(palavra).map(tolerante).join('|')
  return new RegExp(`${ANTES}(?:${alternativas})${DEPOIS}`, 'giu')
}

const regras = palavras.map((palavra) => ({ palavra, re: expressao(palavra) }))

// ── Nome interno ou texto? ─────────────────────────────────────────────────

/**
 * Minúsculo, sem acento e sem espaço é nome interno: `consultas` (tabela),
 * `/procedimentos` (rota), `consulta_agendada` (status). Com espaço, só a
 * lista de colunas de um `select` — vírgula junto de `_` ou parêntese.
 * "sem passar pelo dentista antes, ok" tem espaço e vírgula, mas nenhum dos
 * dois: é texto, e conta.
 */
function pareceNomeInterno(texto) {
  if (!/^[a-z0-9_\-/.:,()*!=&?\s]+$/.test(texto)) return false
  if (!/\s/.test(texto)) return true
  return texto.includes(',') && /[_(]/.test(texto)
}

// ── Leitura ────────────────────────────────────────────────────────────────

function trechosDoTypeScript(caminho, fonte) {
  const tipo = caminho.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(caminho, fonte, ts.ScriptTarget.Latest, true, tipo)
  const trechos = []

  const visitar = (no) => {
    // o caminho de um import não é texto de ninguém
    if (ts.isImportDeclaration(no) || ts.isExportDeclaration(no)) return

    const ehString = ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)
      || ts.isTemplateHead(no) || ts.isTemplateMiddle(no) || ts.isTemplateTail(no)

    if (ehString || ts.isJsxText(no)) {
      const inicio = no.getStart(sf)
      trechos.push({
        inicio,
        bruto: fonte.slice(inicio, no.getEnd()),
        interno: ehString && pareceNomeInterno(no.text),
      })
    }
    ts.forEachChild(no, visitar)
  }

  visitar(sf)
  return trechos
}

function trechosDeTextoCorrido(fonte) {
  // comentário de HTML vira espaço, preservando a posição de cada linha
  const limpo = fonte.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '))
  return [{ inicio: 0, bruto: limpo, interno: false }]
}

function arquivosDaPasta({ pasta, extensoes, fora = [] }) {
  const base = join(RAIZ, pasta)
  return readdirSync(base, { recursive: true })
    .map((r) => String(r).split(sep).join('/'))
    .filter((r) => extensoes.some((e) => r.endsWith(e)) && !fora.includes(r))
    .map((r) => `${pasta}/${r}`)
}

function inicioDasLinhas(fonte) {
  const inicios = [0]
  for (let i = 0; i < fonte.length; i++) if (fonte[i] === '\n') inicios.push(i + 1)
  return inicios
}

function linhaDe(inicios, posicao) {
  let baixo = 0
  let alto = inicios.length - 1
  while (baixo < alto) {
    const meio = Math.ceil((baixo + alto) / 2)
    if (inicios[meio] <= posicao) baixo = meio
    else alto = meio - 1
  }
  return baixo + 1
}

// ── Contagem ───────────────────────────────────────────────────────────────

const arquivos = [...PASTAS.flatMap(arquivosDaPasta), ...TEXTOS_CORRIDOS].sort()
const ocorrencias = []

for (const arquivo of arquivos) {
  const fonte = readFileSync(join(RAIZ, arquivo), 'utf8')
  const ehTs = arquivo.endsWith('.ts') || arquivo.endsWith('.tsx')
  const trechos = ehTs ? trechosDoTypeScript(arquivo, fonte) : trechosDeTextoCorrido(fonte)
  const inicios = inicioDasLinhas(fonte)
  const linhas = fonte.split('\n')

  for (const trecho of trechos) {
    for (const { palavra, re } of regras) {
      re.lastIndex = 0
      for (const m of trecho.bruto.matchAll(re)) {
        const linha = linhaDe(inicios, trecho.inicio + m.index)
        ocorrencias.push({
          arquivo, linha, palavra, achado: m[0], interno: trecho.interno,
          texto: linhas[linha - 1].trim(),
        })
      }
    }
  }
}

// ── Relatório ──────────────────────────────────────────────────────────────

const incluirInternos = opcoes.has('--internos')
const contadas = ocorrencias.filter((o) => incluirInternos || !o.interno)
const internas = ocorrencias.length - ocorrencias.filter((o) => !o.interno).length

const somar = (lista, chave) => {
  const mapa = new Map()
  for (const o of lista) mapa.set(o[chave], (mapa.get(o[chave]) ?? 0) + 1)
  return [...mapa].sort((a, b) => b[1] - a[1])
}

const largura = (lista) => Math.max(...lista.map(([k]) => k.length), 10)

console.log(`\nPalavras procuradas: ${palavras.join(', ')}`)
console.log(`Onde: ${PASTAS.map((p) => `${p.pasta}/`).join(', ')}, ${TEXTOS_CORRIDOS.join(', ')}`)
console.log(incluirInternos
  ? 'Contando também os nomes internos (tabelas, rotas, chaves).\n'
  : 'Fora de comentários e de nomes internos.\n')

if (!contadas.length) {
  console.log('Nenhuma ocorrência. ✔\n')
} else {
  const porPalavra = somar(contadas, 'palavra')
  const lp = largura(porPalavra)
  for (const [palavra, n] of porPalavra) console.log(`  ${palavra.padEnd(lp)}  ${String(n).padStart(5)}`)
  console.log(`  ${'TOTAL'.padEnd(lp)}  ${String(contadas.length).padStart(5)}\n`)

  const porArquivo = somar(contadas, 'arquivo')
  const la = largura(porArquivo)
  console.log(`Em ${porArquivo.length} arquivos:`)
  for (const [arquivo, n] of porArquivo) console.log(`  ${arquivo.padEnd(la)}  ${String(n).padStart(5)}`)
  console.log('')

  if (opcoes.has('--lista')) {
    console.log('Cada ocorrência:')
    for (const o of contadas) {
      const texto = o.texto.length > 110 ? `${o.texto.slice(0, 107)}...` : o.texto
      console.log(`  ${o.arquivo}:${o.linha}  [${o.achado}]  ${texto}`)
    }
    console.log('')
  } else {
    console.log('Para ver cada uma, com a linha: npm run nicho -- --lista\n')
  }
}

if (!incluirInternos && internas) {
  console.log(`(Fora da conta: ${internas} em nomes internos — veja com --internos.)\n`)
}

if (opcoes.has('--falhar') && contadas.length) process.exit(1)
