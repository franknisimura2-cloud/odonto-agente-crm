/**
 * Qual clínica é esta — decidido pelo ENDEREÇO, antes de o sistema carregar.
 *
 * ── UM SITE, VÁRIAS CLÍNICAS ───────────────────────────────────────────────
 *
 * O Núcleo é vendido como uma instalação por clínica: cada uma tem o próprio
 * projeto no Supabase (banco, login, funções). A TELA é uma só para todas, e
 * cada clínica tem um endereço — `esteticajundiai.seudominio.com.br`. É o
 * endereço digitado que diz qual banco abrir.
 *
 * A ficha de cada clínica é um arquivo em `public/clinicas/<endereço>.json`:
 *
 *     { "nome": "Núcleo Clínica de Estética",
 *       "supabaseUrl": "https://abcd….supabase.co",
 *       "anonKey": "eyJ…",
 *       "situacao": "ativa",
 *       "cor": "petroleo" }
 *
 * Os dois valores do Supabase são os PÚBLICOS — os mesmos que antes iam no
 * `.env` e acabavam no JavaScript de qualquer visitante. Quem protege o banco
 * é o RLS, não o segredo deles. Chave secreta nunca entra aqui.
 *
 * Um arquivo por clínica, e não uma lista só: a lista inteira no site seria a
 * carteira de clientes para qualquer um que abrisse o JavaScript.
 *
 * ── POR QUE ANTES DE O SISTEMA CARREGAR ────────────────────────────────────
 *
 * Sete arquivos montam o endereço das funções no momento em que são
 * importados (`BASE_API`, `BASE`…). Então o `main.tsx` descobre a clínica
 * primeiro, e só depois importa o resto (`import('./App')`). Quem precisa do
 * endereço usa `SUPABASE_URL`, de `supabase.ts` — nunca mais o
 * `import.meta.env` direto.
 *
 * ── SEM FICHA ──────────────────────────────────────────────────────────────
 *
 * No computador de quem desenvolve (`localhost`) e nos endereços da própria
 * Vercel (`*.vercel.app`, inclusive os links de teste de cada branch), vale o
 * `.env` de sempre. Em qualquer outro endereço sem ficha, a tela diz que o
 * endereço não existe — e NÃO cai no `.env`: com o domínio coringa
 * (`*.seudominio.com.br`), um endereço inventado abriria o banco de outra
 * clínica.
 */

export type Situacao = 'ativa' | 'suspensa'

export interface Clinica {
  nome: string
  supabaseUrl: string
  anonKey: string
  situacao: Situacao
  /** O `id` de uma cor de `CORES_DO_SISTEMA`: a do login antes do 1º acesso. */
  cor?: string
}

export type Resolucao =
  | { estado: 'ok'; clinica: Clinica }
  | { estado: 'suspensa'; clinica: Clinica }
  | { estado: 'desconhecida'; endereco: string }

let atual: Clinica | null = null

/** A clínica deste endereço. Só existe depois de `descobrirClinica()`. */
export function clinicaAtual(): Clinica {
  if (!atual) throw new Error('clinicaAtual() antes de descobrirClinica() — ver main.tsx')
  return atual
}

/** Endereços onde, sem ficha, vale o `.env` (desenvolvimento e Vercel). */
function enderecoDeBastidor(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')
}

function fichaValida(x: unknown): x is Clinica {
  const c = x as Partial<Clinica> | null
  return !!c
    && typeof c.nome === 'string'
    && typeof c.supabaseUrl === 'string' && c.supabaseUrl.startsWith('https://')
    && typeof c.anonKey === 'string' && c.anonKey.length > 20
    && (c.situacao === 'ativa' || c.situacao === 'suspensa')
}

export async function descobrirClinica(): Promise<Resolucao> {
  // Só letras, números, ponto e hífen chegam ao nome do arquivo: um endereço
  // é isso, e qualquer outra coisa não pode virar caminho no servidor.
  const host = location.hostname.toLowerCase().replace(/[^a-z0-9.-]/g, '')

  let ficha: unknown = null
  try {
    // `no-store`: suspender uma clínica tem que valer no próximo F5, e não
    // quando o cache do navegador resolver expirar.
    const r = await fetch(`/clinicas/${host}.json`, { cache: 'no-store' })
    // Na Vercel, arquivo que não existe cai no rewrite e volta o index.html
    // com 200. É o `content-type` que separa uma ficha de uma página.
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) ficha = await r.json()
  } catch {
    // Sem rede ou arquivo quebrado: segue como "sem ficha".
  }

  if (fichaValida(ficha)) {
    atual = ficha
    return ficha.situacao === 'suspensa'
      ? { estado: 'suspensa', clinica: ficha }
      : { estado: 'ok', clinica: ficha }
  }

  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (enderecoDeBastidor(host) && url && anonKey) {
    atual = { nome: '', supabaseUrl: url, anonKey, situacao: 'ativa' }
    return { estado: 'ok', clinica: atual }
  }

  return { estado: 'desconhecida', endereco: host }
}
