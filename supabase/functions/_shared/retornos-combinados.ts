/**
 * O retorno combinado, em frases — para a Letícia (migração 0048).
 *
 * Dois leitores, como os outros contatos com motivo: a FICHA (a pessoa
 * respondeu, ou escreveu antes do dia, e a Letícia precisa saber do
 * combinado) e a CHAMADA (a rota /retornos-combinados, no dia marcado).
 *
 * O motivo é anotação da EQUIPE, escrita para a equipe ("pediu pra chamar
 * depois da viagem, achou caro"). A Letícia usa o assunto; nunca copia a
 * anotação, que pode ter coisa que não se diz para a pessoa.
 */

import { selecionar } from './db.ts'

interface RetornoDaFicha {
  para_data: string
  motivo: string
  situacao: 'agendado' | 'enviado' | 'cancelado'
  enviado_em: string | null
}

const dataBR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/**
 * As linhas da ficha: o que foi combinado e ainda vai acontecer, e o contato
 * que ela mandou há pouco (se a pessoa está respondendo a ele, é disso que
 * a conversa trata).
 */
export async function linhasDoRetornoCombinado(leadId: string): Promise<string[]> {
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [agendados, enviados] = await Promise.all([
    selecionar<RetornoDaFicha>(
      `retornos_combinados?select=para_data,motivo,situacao,enviado_em` +
      `&lead_id=eq.${leadId}&situacao=eq.agendado&order=para_data.asc&limit=3`,
    ),
    selecionar<RetornoDaFicha>(
      `retornos_combinados?select=para_data,motivo,situacao,enviado_em` +
      `&lead_id=eq.${leadId}&situacao=eq.enviado&enviado_em=gt.${encodeURIComponent(desde)}` +
      `&order=enviado_em.desc&limit=1`,
    ),
  ])

  const linhas: string[] = []
  const ultimo = enviados[0]
  if (ultimo?.enviado_em) {
    linhas.push(
      `VOCÊ PROCUROU ESTA PESSOA em ${dataBR(ultimo.enviado_em)}, num retorno combinado com a equipe. ` +
      `Assunto (anotação interna da equipe, não repita palavra por palavra): ${ultimo.motivo}. ` +
      'Se ela está respondendo a esse contato, siga esse assunto.',
    )
  }
  for (const r of agendados) {
    linhas.push(
      `Retorno combinado para ${dataBR(r.para_data)} (anotação interna da equipe): ${r.motivo}. ` +
      'Se ela tocar nesse assunto antes, siga normalmente.',
    )
  }
  return linhas
}

export function instrucaoDeRetornoCombinado(motivo: string, paraData: string): string {
  return [
    '',
    '',
    '# AGORA: VOCÊ ESTÁ RETOMANDO UM CONTATO COMBINADO',
    '',
    'Ninguém escreveu agora: quem está te acordando é o relógio. A equipe combinou de procurar',
    `esta pessoa em ${dataBR(paraData)}, por este motivo (anotação INTERNA da equipe):`,
    '',
    `"${motivo}"`,
    '',
    'Escreva UMA mensagem curta, de no máximo 40 palavras, que:',
    '',
    '-   Chame a pessoa pelo primeiro nome, se a ficha tiver.',
    '-   Retome o ASSUNTO do motivo com naturalidade, como quem lembra do que foi conversado.',
    '-   Termine com uma pergunta simples SOBRE ESSE ASSUNTO, que convide a responder.',
    '',
    'NÃO AFIRME NADA QUE O MOTIVO NÃO DIGA QUE JÁ ACONTECEU. Você não sabe o que aconteceu desde',
    'então: se o motivo diz "avisar quando X acontecer", NÃO diga que X aconteceu, nem que está',
    'para acontecer, nem dê data ou resultado. Só conte um fato se ele estiver escrito no motivo',
    'como fato ("foi aprovado em 10/11"). Sem o fato, retome o assunto e diga que a equipe segue',
    'acompanhando.',
    '',
    'A anotação foi escrita para a equipe: use o assunto, NUNCA copie o texto, e não mencione',
    'nada que pareça anotação interna (opinião sobre a pessoa, preço que ela achou caro, etc.).',
    'Fale SÓ desse assunto: não ofereça outro serviço, tratamento ou "outra opção", nem pergunte',
    '"como posso ajudar". Não invente preço, promoção, data nem horário que não estejam na ficha ou',
    'nas informações da empresa, e nunca use as palavras "sistema", "lembrete",',
    '"automático", "agendado" ou "follow-up".',
    '',
    'Responda só com o texto da mensagem. Uma mensagem só, sem ferramenta.',
  ].join('\n')
}
