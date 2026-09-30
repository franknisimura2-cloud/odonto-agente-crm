/**
 * O plano de tratamento em aberto, em frases — para a Letícia (migração 0041
 * e 0042).
 *
 * Serve a dois leitores: a FICHA (toda mensagem de quem tem plano em aberto,
 * para ela saber do que se trata se a pessoa tocar no assunto) e a RETOMADA
 * (a rota /planos-retomar, quando ela volta a falar do plano por conta
 * própria).
 *
 * VALORES SÓ DAQUI. O texto traz os números exatos do plano; a instrução
 * proíbe qualquer outro. Um modelo que "arredonda" o preço de um implante é o
 * erro mais caro que ela pode cometer.
 */

import { selecionar } from './db.ts'

const ETAPAS: Record<number, string> = {
  1: 'Urgência e saúde', 2: 'Reabilitação', 3: 'Estética', 4: 'Etapa 4', 5: 'Etapa 5',
}

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface ItemResumo {
  etapa: number
  procedimento: string
  dente: number | null
  cobertura: 'particular' | 'convenio'
  valor: number
  status: string
  convenio: { nome: string } | null
}

export interface PlanoAberto {
  id: string
  apresentadoEm: string
  validade: string | null
  link: string | null
  /** As frases prontas, uma por linha. */
  resumo: string
  /** A primeira etapa que falta decidir — por onde a retomada puxa. */
  primeiraPendente: string | null
}

/** O plano apresentado mais recente da pessoa que ainda tem item a decidir, ou `null`. */
export async function planoAberto(leadId: string, fuso: string): Promise<PlanoAberto | null> {
  const planos = await selecionar<{ id: string; apresentado_em: string; validade: string | null; token: string; link_base: string | null; desconto: number }>(
    `planos_tratamento?select=id,apresentado_em,validade,token,link_base,desconto` +
    `&lead_id=eq.${leadId}&status=in.(apresentado,parcial)&order=apresentado_em.desc&limit=1`,
  )
  const p = planos[0]
  if (!p) return null

  const itens = await selecionar<ItemResumo>(
    `plano_itens?select=etapa,procedimento,dente,cobertura,valor,status,convenio:convenios(nome)` +
    `&plano_id=eq.${p.id}&order=etapa,ordem`,
  )
  const pendentes = itens.filter((i) => i.status === 'pendente')
  if (!pendentes.length) return null

  const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit' })
  const linhas: string[] = []
  linhas.push(`Plano de tratamento apresentado em ${data(p.apresentado_em)}` +
    (p.validade ? `, válido até ${p.validade.split('-').reverse().slice(0, 2).join('/')}` : '') + '.')

  const aprovadas = [...new Set(itens.filter((i) => ['aprovado', 'feito'].includes(i.status)).map((i) => i.etapa))]
  if (aprovadas.length) linhas.push(`Já aprovado: ${aprovadas.map((e) => `etapa ${e} (${ETAPAS[e]})`).join(', ')}.`)

  const etapasPendentes = [...new Set(pendentes.map((i) => i.etapa))].sort()
  for (const e of etapasPendentes) {
    const da = pendentes.filter((i) => i.etapa === e).map((i) => {
      const onde = i.dente ? ` no dente ${i.dente}` : ''
      const quanto = i.cobertura === 'convenio'
        ? `coberto pelo convênio${i.convenio?.nome ? ` ${i.convenio.nome}` : ''}`
        : `particular, ${reais(Number(i.valor))}`
      return `${i.procedimento}${onde} (${quanto})`
    })
    linhas.push(`Falta decidir — etapa ${e} (${ETAPAS[e]}): ${da.join('; ')}.`)
  }

  const particular = pendentes.filter((i) => i.cobertura === 'particular').reduce((s, i) => s + Number(i.valor), 0)
  if (particular > 0) {
    linhas.push(`Particular do que falta decidir: ${reais(particular)}` +
      (Number(p.desconto) > 0 ? ` (o plano tem desconto de ${reais(Number(p.desconto))} no total particular).` : '.'))
  }

  const link = p.link_base?.trim() ? `${p.link_base.trim().replace(/\/+$/, '')}/orcamento/${p.token}` : null
  if (link) linhas.push(`Link do plano (para ela rever e aprovar): ${link}`)

  return {
    id: p.id,
    apresentadoEm: p.apresentado_em,
    validade: p.validade,
    link,
    resumo: linhas.join('\n'),
    primeiraPendente: etapasPendentes.length ? `etapa ${etapasPendentes[0]} (${ETAPAS[etapasPendentes[0]]})` : null,
  }
}

/** A linha da ficha: o plano, e a instrução colada nele. */
export function linhaDaFicha(p: PlanoAberto): string {
  return 'PLANO DE TRATAMENTO EM ABERTO:\n' + p.resumo + '\n' +
    'Se ela falar do plano, tire as dúvidas com base só nisto — valor, só os escritos aqui. ' +
    'Aprovar é pelo link ou com a recepção. Detalhe clínico do tratamento é com o dentista.'
}

/**
 * A instrução da retomada, no fim do prompt. Mesmo lugar e mesmo motivo da do
 * follow-up: só existe nesta situação, e não entra no `prompt.md`.
 */
export function instrucaoDeRetomada(p: PlanoAberto, toque: number, ultimo: boolean, dias: number): string {
  const linhas = [
    '',
    '',
    '# AGORA: VOCÊ ESTÁ RETOMANDO O PLANO DE TRATAMENTO',
    '',
    `Faz ${dias} dia(s) que a pessoa recebeu o plano de tratamento e ainda não decidiu tudo. Ninguém`,
    'pediu nada agora: quem está te acordando é o relógio do sistema.',
    '',
    p.resumo,
    '',
    'Escreva UMA mensagem curta, de no máximo 40 palavras, que:',
    '',
    '-   Chame a pessoa pelo primeiro nome, se a ficha tiver.',
    '',
    `-   Retome o plano pelo que ele resolve para ela — comece pela ${p.primeiraPendente ?? 'etapa que falta'}.`,
    '    Fale de saúde, conforto e resultado, não de preço.',
    '-   Ofereça tirar dúvidas ou ajudar a marcar.',
    '-   Termine com uma pergunta fácil de responder.',
    '',
    'Nunca pressione, nunca fale em prazo acabando, e nunca invente desconto, parcelamento ou',
    'valor: se citar um valor, que seja exatamente um dos escritos acima. Não explique o',
    'procedimento em detalhe (isso é com o dentista). Não escreva o link: ele vai numa mensagem',
    'separada, logo depois da sua. Nunca use as palavras "sistema", "lembrete", "automático",',
    '"follow-up" ou "retomando".',
    '',
    'Responda só com o texto da mensagem. Uma mensagem só, sem ferramenta.',
  ]
  if (!p.link) {
    linhas.push('', 'Não há link para mandar agora: se ela quiser rever o plano, diga que a recepção reenvia.')
  }
  if (ultimo) {
    linhas.push('', 'Esta é a ÚLTIMA vez que você fala do plano por conta própria. Deixe a porta aberta,',
      'sem despedida dramática e sem dizer que é a última tentativa.')
  } else if (toque === 1) {
    linhas.push('', 'É o primeiro toque: leve, como quem pergunta se ficou alguma dúvida.')
  }
  return linhas.join('\n')
}
