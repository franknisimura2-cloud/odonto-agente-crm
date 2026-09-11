import { useSyncExternalStore } from 'react'

/**
 * A identidade do sistema: o nome do produto e a cor.
 */

/**
 * O nome do produto — o que aparece na tela de login, na aba do navegador e na
 * barra lateral enquanto a empresa não cadastrou o nome dela.
 *
 * É uma constante, e não dado do banco, porque a tela de login é lida SEM
 * sessão: o RLS devolve zero linhas para quem não entrou, sem erro nenhum, e
 * o nome sumiria justo na primeira tela.
 *
 * ⚠️ O `<title>` do `index.html` é um segundo lugar, e ele não lê este
 * arquivo (é HTML estático). Trocou aqui, troque lá.
 */
export const NOME_DO_SISTEMA = 'Núcleo'

// ---------------------------------------------------------------------------
// A cor do sistema
//
// A empresa escolhe uma das cores abaixo em Configurações → Empresa, e a
// escolha é gravada em `configuracoes_clinica.cor_sistema` (migração 0029).
//
// ── POR QUE UMA LISTA, E NÃO QUALQUER COR ───────────────────────────────────
//
// Pelo mesmo motivo da paleta das agendas (`cores.ts`): com cor livre, mais
// cedo ou mais tarde alguém escolhe amarelo, e a letra branca dos botões some.
// Cada cor daqui foi conferida com letra branca por cima (contraste de 4,5 ou
// mais) e tem os quatro tons ajustados à mão, em vez de calculados.
//
// Três ficaram de fora de propósito:
//   · cinza ou preto — o sistema já é cinza por baixo. O item ativo do menu
//     ficaria igual ao item sob o mouse, e o balão da atendente quase igual
//     ao da equipe;
//   · vermelho — é a cor de erro e do botão Excluir;
//   · amarelo — letra branca ilegível, e é a cor dos avisos.
//
// Acrescentar uma cor é acrescentar um item aqui: a coluna não tem CHECK.
// Confira o contraste da `principal` com branco antes (4,5 : 1 ou mais).
//
// ── O QUE NÃO SEGUE A COR ───────────────────────────────────────────────────
//
// As etiquetas de status (`statusLead.ts`) — inclusive "Iniciou Conversa",
// que é petróleo FIXO: seguindo a marca, numa empresa roxa ela ficaria igual a
// "Cliente Recorrente". E a cor de cada profissional na agenda (`cores.ts`),
// que é dado.
// ---------------------------------------------------------------------------

export interface CorDoSistema {
  /** O que vai para o banco. Nunca mude a chave de uma cor que já existe. */
  id: string
  /** O que aparece no seletor. */
  nome: string
  /** Botões, links, ícones em destaque, o balão da atendente. */
  principal: string
  /** O botão com o mouse em cima. */
  escuro: string
  /** O botão enquanto salva. */
  claro: string
  /** Fundo de realce: o item ativo do menu, o bloco atrás de um ícone. */
  suave: string
}

export const CORES_DO_SISTEMA: CorDoSistema[] = [
  { id: 'petroleo', nome: 'Petróleo', principal: '#1E6E8C', escuro: '#17576F', claro: '#4C90A8', suave: '#EAF3F6' },
  { id: 'azul',     nome: 'Azul',     principal: '#2563EB', escuro: '#1D4ED8', claro: '#5787F0', suave: '#ECF2FD' },
  { id: 'verde',    nome: 'Verde',    principal: '#15803D', escuro: '#166534', claro: '#4B9D6A', suave: '#EBF4EF' },
  { id: 'roxo',     nome: 'Roxo',     principal: '#6D28D9', escuro: '#5B21B6', claro: '#8F5AE2', suave: '#F3EDFC' },
  { id: 'rosa',     nome: 'Rosa',     principal: '#BE185D', escuro: '#9D174D', claro: '#CD4D82', suave: '#F9EBF1' },
  { id: 'laranja',  nome: 'Laranja',  principal: '#C2410C', escuro: '#9A3412', claro: '#D06D44', suave: '#FAEFEA' },
  { id: 'marrom',   nome: 'Marrom',   principal: '#7C4A2D', escuro: '#633A22', claro: '#9A745D', suave: '#F3ECE7' },
]

/** A cor de quem nunca escolheu, e a da tela de login no primeiro acesso. */
export const COR_PADRAO: CorDoSistema = CORES_DO_SISTEMA[0]

/** Chave desconhecida (ou vazia) vira a padrão — nunca um sistema sem cor. */
export function corPorId(id: string | null | undefined): CorDoSistema {
  return CORES_DO_SISTEMA.find((c) => c.id === id) ?? COR_PADRAO
}

// ---------------------------------------------------------------------------
// Os tons, para usar nos estilos
//
// São variáveis CSS, e não o hex: trocar a cor muda o sistema inteiro na hora,
// sem re-renderizar nenhuma tela — inclusive os estilos declarados fora de
// componente, que nenhum hook alcançaria.
//
// ⚠️ DUAS COISAS NÃO ACEITAM VARIÁVEL, e pedem o hex de `useCorDoSistema()`:
//
//   · atributo de SVG — o `color` dos ícones do lucide vira o atributo
//     `stroke`, e o mesmo vale para `stroke`/`fill` do recharts. Nos ícones,
//     use `style={{ color: MARCA }}`: o ícone desenha com `currentColor`, e a
//     propriedade CSS aceita variável;
//   · o PDF (jsPDF), que quer números.
//
// E transparência não se faz concatenando: `${MARCA}1A` vira texto inválido.
// Use `marcaComAlfa()`.
// ---------------------------------------------------------------------------

export const MARCA = 'var(--cor-marca)'
export const MARCA_ESCURO = 'var(--cor-marca-escuro)'
export const MARCA_CLARO = 'var(--cor-marca-claro)'
export const MARCA_SUAVE = 'var(--cor-marca-suave)'

/** A cor da marca com transparência: `marcaComAlfa(10)` = 10% da cor. */
export function marcaComAlfa(porcento: number): string {
  return `color-mix(in srgb, ${MARCA} ${porcento}%, transparent)`
}

// ---------------------------------------------------------------------------
// A cor em uso, e quem quer saber quando ela muda
//
// Mesma receita do nome do agente (`agente.ts`): `useSyncExternalStore`, um
// valor, e quem se inscreve. A maioria das telas nem precisa se inscrever —
// elas usam as variáveis CSS acima. Quem precisa do hex (gráfico, PDF) usa
// `useCorDoSistema()`.
// ---------------------------------------------------------------------------

let atual: CorDoSistema = COR_PADRAO
const ouvintes = new Set<() => void>()

function inscrever(aviso: () => void): () => void {
  ouvintes.add(aviso)
  return () => { ouvintes.delete(aviso) }
}

/**
 * Pinta o sistema com uma cor. Só MOSTRA: não grava no banco nem no navegador.
 *
 * O seletor chama isto a cada clique, para a pessoa ver antes de salvar — e
 * chama de novo com a cor salva se ela sair sem salvar.
 */
export function aplicarCorDoSistema(id: string | null | undefined): void {
  const cor = corPorId(id)
  const raiz = document.documentElement.style
  raiz.setProperty('--cor-marca', cor.principal)
  raiz.setProperty('--cor-marca-escuro', cor.escuro)
  raiz.setProperty('--cor-marca-claro', cor.claro)
  raiz.setProperty('--cor-marca-suave', cor.suave)
  trocarIconeDaAba(cor.principal)
  if (cor !== atual) {
    atual = cor
    ouvintes.forEach((f) => { f() })
  }
}

/** Para código que não é componente (o PDF). Em componente, use o hook. */
export function corDoSistemaAtual(): CorDoSistema {
  return atual
}

/** A cor em uso, com os hex — para o que não aceita variável CSS. */
export function useCorDoSistema(): CorDoSistema {
  return useSyncExternalStore(inscrever, corDoSistemaAtual)
}

// ---------------------------------------------------------------------------
// O que o navegador lembra, para a tela de login
//
// O login abre antes de a pessoa entrar, e o RLS não deixa ler a cor do
// banco sem sessão. Então cada computador guarda a última cor SALVA que viu:
// na primeira vez o login abre na padrão; do primeiro acesso em diante, na cor
// da empresa. Decisão de produto de 11/09/2026 — abrir uma leitura pública no
// banco só para isso foi descartado.
//
// Só a cor SALVA entra aqui: a prévia do seletor não passa por esta função, e
// um clique sem "Salvar" não muda o login de ninguém.
// ---------------------------------------------------------------------------

const CHAVE_NO_NAVEGADOR = 'nucleo:cor-do-sistema'

export function lembrarCorNoNavegador(id: string): void {
  try {
    localStorage.setItem(CHAVE_NO_NAVEGADOR, id)
  } catch {
    // Navegador sem armazenamento (aba anônima, bloqueio): o login fica na
    // padrão, e o resto do sistema segue a cor do banco normalmente.
  }
}

export function corLembradaNoNavegador(): string | null {
  try {
    return localStorage.getItem(CHAVE_NO_NAVEGADOR)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// O ícone da aba acompanha a cor
//
// `public/favicon.svg` é o mesmo desenho, na cor padrão: é ele que aparece
// antes deste código rodar. ⚠️ Mudou o desenho, mude nos dois.
// ---------------------------------------------------------------------------

function trocarIconeDaAba(hex: string): void {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) return
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    `<rect width="24" height="24" rx="5.5" fill="${hex}"/>` +
    '<circle cx="12" cy="12" r="6.2" fill="none" stroke="#ffffff" stroke-width="2"/>' +
    '<circle cx="12" cy="12" r="2.3" fill="#ffffff"/>' +
    '</svg>'
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`
}
