/**
 * O retorno periódico (a limpeza semestral), em frases — para a Letícia
 * (migração 0043).
 *
 * Dois leitores, como o plano de tratamento: a FICHA (se a pessoa quiser
 * marcar a limpeza, ela sabe que está na hora e qual serviço marcar) e a
 * CHAMADA (a rota /retornos, quando ela convida por conta própria).
 */

import { selecionar } from './db.ts'

export interface Retorno {
  servico: string
  /** 'AAAA-MM-DD' */
  paraData: string
  ultima: string | null
  convenio: string | null
  resumo: string
}

const dataBR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export async function retornoDaPessoa(
  leadId: string,
  pessoa: { proximo_retorno?: string | null; retorno_servico?: string | null; forma_pagamento?: string | null; convenio_id?: string | null },
  fuso: string,
): Promise<Retorno | null> {
  if (!pessoa.proximo_retorno || !pessoa.retorno_servico) return null
  const servico = pessoa.retorno_servico

  const [ultimas, cobertura] = await Promise.all([
    selecionar<{ data_consulta: string }>(
      `consultas?select=data_consulta&lead_id=eq.${leadId}&status=eq.realizada` +
      `&procedimento=eq.${encodeURIComponent(servico)}&order=data_consulta.desc&limit=1`,
    ),
    pessoa.forma_pagamento === 'convenio' && pessoa.convenio_id
      ? selecionar<{ convenio: { nome: string; ativo: boolean } | null; servico: { nome: string } | null }>(
        `convenio_coberturas?select=convenio:convenios(nome,ativo),servico:servicos_clinica(nome)&convenio_id=eq.${pessoa.convenio_id}`,
      )
      : Promise.resolve([]),
  ])

  const ultima = ultimas[0]?.data_consulta
    ? new Date(ultimas[0].data_consulta).toLocaleDateString('en-CA', { timeZone: fuso })
    : null
  const coberto = cobertura.find((c) => c.convenio?.ativo && c.servico?.nome?.toLowerCase().trim() === servico.toLowerCase().trim())
  const convenio = coberto?.convenio?.nome ?? null

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: fuso })
  const quando = pessoa.proximo_retorno < hoje
    ? `estava previsto para ${dataBR(pessoa.proximo_retorno)} (já passou)`
    : `está previsto para ${dataBR(pessoa.proximo_retorno)}`

  const resumo =
    `Retorno de ${servico}: ${quando}` +
    (ultima ? `; a última foi em ${dataBR(ultima)}` : '') +
    (convenio ? `; é coberto pelo convênio ${convenio}` : '') + '.'

  return { servico, paraData: pessoa.proximo_retorno, ultima, convenio, resumo }
}

export function linhaDaFichaRetorno(r: Retorno): string {
  return `${r.resumo} Se ela quiser marcar, o serviço é "${r.servico}".`
}

export function instrucaoDeRetorno(r: Retorno, toque: number, ultimo: boolean): string {
  const linhas = [
    '',
    '',
    '# AGORA: VOCÊ ESTÁ CHAMANDO PARA O RETORNO',
    '',
    'Ninguém pediu nada agora: quem está te acordando é o relógio do sistema. Esta pessoa',
    'já é paciente da clínica, e está na hora de voltar.',
    '',
    r.resumo,
    '',
    'Escreva UMA mensagem curta, de no máximo 35 palavras, que:',
    '',
    '-   Chame a pessoa pelo primeiro nome, se a ficha tiver.',
    `-   Lembre que está na hora da ${r.servico.toLowerCase()} de rotina — como cuidado, não como cobrança.`,
    r.convenio ? `-   Diga que é coberta pelo convênio ${r.convenio}.` : '-   Não fale de preço.',
    '-   Termine perguntando qual dia ou período fica melhor para ela.',
    '',
    'Não ofereça outro serviço, não invente data nem horário (quem vê horário livre é a',
    'ferramenta, depois que ela responder), e nunca use as palavras "sistema", "lembrete",',
    '"automático" ou "follow-up".',
    '',
    'Responda só com o texto da mensagem. Uma mensagem só, sem ferramenta.',
  ]
  if (ultimo && toque > 1) {
    linhas.push('', 'É a ÚLTIMA vez que você chama por conta própria para este retorno. Deixe a porta aberta, sem drama.')
  }
  return linhas.join('\n')
}
