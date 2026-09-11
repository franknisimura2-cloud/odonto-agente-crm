import type { LeadStatus, ConsultaStatus } from '../types'

/**
 * As cores e os rótulos do status de um lead.
 *
 * **Cor de status não é cor de marca.** Ela comunica significado — verde é
 * agendamento marcado, vermelho é cancelado — e não muda junto com a
 * identidade visual da empresa.
 *
 * ⚠️ "Iniciou Conversa" é petróleo, o mesmo hex da cor padrão do sistema, e
 * FICA petróleo quando a empresa escolhe outra cor no seletor (`marca.ts`).
 * Seguindo a marca, numa empresa roxa ela ficaria igual a "Cliente
 * Recorrente". Por isso ela é o hex escrito, e não `MARCA`.
 *
 * **Os rótulos moram só aqui.** CRM, listas de Leads e Clientes, ficha e
 * exportação leem `ROTULO_LEAD` — adaptar o sistema a outro nicho troca as
 * palavras neste arquivo, e as telas acompanham. As chaves (`consulta_agendada`
 * etc.) NÃO mudam: são identificadores, gravados no banco e no trigger da 0015.
 *
 * Os rótulos do funil são verbos ("Agendou", "Compareceu") de propósito: verbo
 * não tem gênero, e "Maria — Agendado" seria erro de concordância.
 *
 * Os valores precisam bater com o `CHECK` de `crm_clinica_dados.status` e com
 * `LeadStatus` em `src/types/index.ts`. Nada sincroniza isso sozinho.
 */

export interface EstiloStatus {
  bg: string
  color: string
  /** Pisca. Só o lead recém-chegado, que é quem pede atenção. */
  pulse?: boolean
}

export const STATUS_LEAD: Record<LeadStatus, EstiloStatus> = {
  iniciou_conversa:    { bg: '#EAF3F6', color: '#1E6E8C', pulse: true },
  conversando:         { bg: '#EEF2FF', color: '#4F46E5' },
  consulta_agendada:   { bg: '#E8F8EF', color: '#1A7A48' },
  consulta_cancelada:  { bg: '#FEF2F2', color: '#DC2626' },
  follow_up_1_feito:   { bg: '#FFFBEB', color: '#D97706' },
  follow_up_2_feito:   { bg: '#FFFBEB', color: '#D97706' },
  follow_up_3_feito:   { bg: '#FFFBEB', color: '#D97706' },
  consulta_realizada:  { bg: '#14532D', color: '#FFFFFF' },
  paciente_recorrente: { bg: '#F3E8FF', color: '#7C3AED' },
}

export const ROTULO_LEAD: Record<LeadStatus, string> = {
  iniciou_conversa:    'Iniciou Conversa',
  conversando:         'Conversando',
  consulta_agendada:   'Agendou',
  consulta_cancelada:  'Cancelou',
  follow_up_1_feito:   'Follow-up 1',
  follow_up_2_feito:   'Follow-up 2',
  follow_up_3_feito:   'Follow-up 3',
  consulta_realizada:  'Compareceu',
  paciente_recorrente: 'Cliente Recorrente',
}

export const STATUS_CONSULTA: Record<ConsultaStatus, EstiloStatus> = {
  agendada:  { bg: '#E8F8EF', color: '#1A7A48' },
  realizada: { bg: '#14532D', color: '#FFFFFF' },
  cancelada: { bg: '#FEF2F2', color: '#DC2626' },
  // Falta é âmbar, não vermelha: o vermelho já é cancelamento, e as duas
  // precisam se separar de longe — é a distinção que a 0015 existe para
  // preservar.
  faltou:    { bg: '#FFFBEB', color: '#B45309' },
}

/** O status de um agendamento (masculino: "o agendamento"). */
export const ROTULO_CONSULTA: Record<ConsultaStatus, string> = {
  agendada:  'Agendado',
  realizada: 'Realizado',
  cancelada: 'Cancelado',
  faltou:    'Faltou',
}
