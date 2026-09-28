const agora = Date.now(), min = 60000
const iso = (m) => new Date(agora - m * min).toISOString()
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222'
export const conversas = [
  { lead_id: A, nome_lead: 'Juliana Prado', whatsapp_lead: '5511987654321', status: 'conversando', agente_pausado: false, assumido_por: null, assumido_em: null, assumido_por_nome: null, ultimo_conteudo: 'Perfeito! Te espero na quinta então 😊', ultimo_tipo: 'texto', ultimo_autor: 'agente', ultima_em: iso(3), nao_lidas: 0, data_agendamento: iso(-2880) },
  { lead_id: B, nome_lead: 'Carla Menezes Albuquerque de Souza', whatsapp_lead: '5511912345678', status: 'conversando', agente_pausado: true, assumido_por: 'u', assumido_em: iso(30), assumido_por_nome: 'Frank Nisimura', ultimo_conteudo: 'Quanto custa o preenchimento labial? Vi no Instagram de vocês', ultimo_tipo: 'texto', ultimo_autor: 'paciente', ultima_em: iso(12), nao_lidas: 2, data_agendamento: null },
  { lead_id: '3', nome_lead: null, whatsapp_lead: '5511955554444', status: 'iniciou_conversa', agente_pausado: false, assumido_por: null, assumido_em: null, assumido_por_nome: null, ultimo_conteudo: null, ultimo_tipo: 'audio', ultimo_autor: 'paciente', ultima_em: iso(200), nao_lidas: 1, data_agendamento: null },
  { lead_id: '4', nome_lead: 'Marcos Lima', whatsapp_lead: '5511933332222', status: 'consulta_cancelada', agente_pausado: false, assumido_por: null, assumido_em: null, assumido_por_nome: null, ultimo_conteudo: 'Tudo bem, obrigado!', ultimo_tipo: 'texto', ultimo_autor: 'paciente', ultima_em: iso(3000), nao_lidas: 0, data_agendamento: null },
]
let n = 0
const msg = (lead, autor, conteudo, m) => ({ id: String(++n), lead_id: lead, autor, tipo: 'texto', conteudo, midia_url: null, id_externo: null, enviada_por: null, lida: true, criada_em: iso(m) })
export const mensagens = {
  [A]: [
    msg(A, 'paciente', 'Oi, boa tarde! Queria saber sobre limpeza de pele', 40),
    msg(A, 'agente', 'Olá, muito prazer! Sou a Letícia, secretária aqui da clínica. Como posso te chamar?', 39),
    msg(A, 'paciente', 'Juliana', 38),
    msg(A, 'agente', 'Oi, Juliana! A limpeza de pele profunda remove cravos, impurezas e células mortas, e deixa a pele renovada.\n\nÉ a partir de R$ 180. Quer que eu veja um horário pra você?', 37),
    msg(A, 'paciente', 'Quero sim, quinta de manhã tem?', 10),
    msg(A, 'atendente', 'Oi Juliana, aqui é o Frank da recepção. Consegui encaixar quinta às 9h com a Elis, pode ser?', 8),
    msg(A, 'paciente', 'Pode sim!', 5),
    msg(A, 'agente', 'Perfeito! Te espero na quinta então 😊', 3),
  ],
  [B]: [
    msg(B, 'paciente', 'Olá! Vocês fazem preenchimento labial?', 20),
    msg(B, 'paciente', 'Quanto custa o preenchimento labial? Vi no Instagram de vocês', 12),
  ],
}
export const leads = {
  [A]: { id: A, nome_lead: 'Juliana Prado', whatsapp_lead: '5511987654321', procedimentos_interesse: ['Tratamento facial - Limpeza de Pele Profunda'], procedimento_interesse: null, resumo_conversa: 'Juliana procurou a clínica interessada em limpeza de pele. Pediu quinta de manhã e a recepção encaixou às 9h com a Elis.', status: 'consulta_agendada', inicio_atendimento: iso(40), ultima_mensagem: iso(3), data_agendamento: iso(-2880), anotacoes: null, data_nascimento: null, valor_pago_acumulado: 0, agente_pausado: false, created_at: iso(40) },
  [B]: { id: B, nome_lead: 'Carla Menezes Albuquerque de Souza', whatsapp_lead: '5511912345678', procedimentos_interesse: ['Tratamento facial - Preenchimento Facial'], procedimento_interesse: null, resumo_conversa: 'A cliente perguntou o preço do preenchimento labial.', status: 'conversando', inicio_atendimento: iso(20), ultima_mensagem: iso(12), data_agendamento: null, anotacoes: 'Prefere horário depois das 18h.', data_nascimento: null, valor_pago_acumulado: 0, agente_pausado: true, created_at: iso(20) },
}
// url → corpo. `objeto` = o PostgREST pediu uma linha só (maybeSingle).
export function responder(url, objeto) {
  const lead = (url.match(/lead_id=eq\.([\w-]+)/) || url.match(/[?&]id=eq\.([\w-]+)/) || [])[1]
  if (url.includes('/auth/v1/user')) return { id: '00000000-0000-0000-0000-000000000000', aud: 'authenticated', role: 'authenticated', email: 'teste@teste' }
  if (url.includes('/rest/v1/conversas_lista')) return conversas
  if (url.includes('/rest/v1/mensagens_whatsapp') && url.includes('select=')) return [...(mensagens[lead] || [])].reverse()
  if (url.includes('/rest/v1/crm_clinica?') && !lead) return funil
  if (url.includes('/rest/v1/crm_clinica?')) return objeto ? (leads[lead] || null) : [leads[lead]].filter(Boolean)
  if (url.includes('/rest/v1/usuarios')) return objeto ? { id: 'u', nome: 'Frank Nisimura', avatar_url: null } : []
  if (url.includes('/rest/v1/configuracoes_agente')) return objeto ? { nome_agente: 'Letícia' } : [{ nome_agente: 'Letícia' }]
  if (url.includes('/rest/v1/configuracoes_clinica')) { const c = { nome_clinica: 'Núcleo Clínica de Estética', cor_sistema: 'roxo', logo_url: null }; return objeto ? c : [c] }
  const rpc = url.includes('/rpc/') ? url.split('/rpc/')[1].split('?')[0] : null
  // MOCK_PAPEL=recepcao|profissional|dona (padrão) escolhe quem está logado.
  if (rpc === 'minhas_permissoes') {
    const papel = process.env.MOCK_PAPEL || 'dona'
    const todas = ['dashboard', 'valores', 'conversas', 'agenda_todas', 'agenda_editar', 'pessoas', 'crm', 'exportar', 'configurar', 'equipe']
    const liga = { dona: todas, recepcao: ['conversas', 'agenda_todas', 'agenda_editar', 'pessoas'], profissional: [] }[papel]
    return { papel, profissional_id: papel === 'profissional' ? 'pd' : null, permissoes: Object.fromEntries(todas.map((p) => [p, liga.includes(p)])) }
  }
  if (rpc === 'valores_das_consultas') return (process.env.MOCK_PAPEL || 'dona') === 'dona' ? consultas.map((c) => ({ id: c.id, valor_pago: 250 })) : []
  if (rpc === 'equipe') {
    const todas = ['dashboard', 'valores', 'conversas', 'agenda_todas', 'agenda_editar', 'pessoas', 'crm', 'exportar', 'configurar', 'equipe']
    const ef = (liga) => Object.fromEntries(todas.map((p) => [p, liga.includes(p)]))
    return [
      { id: '00000000-0000-0000-0000-000000000000', nome: 'Danielle Braga', email: 'dona@clinica.com', papel: 'dona', profissional_id: null, ativo: true, permissoes: {}, efetivas: ef(todas) },
      { id: 'u2', nome: 'Carla Recepção', email: 'carla@clinica.com', papel: 'recepcao', profissional_id: null, ativo: true, permissoes: { valores: true }, efetivas: ef(['conversas', 'agenda_todas', 'agenda_editar', 'pessoas', 'valores']) },
      { id: 'u3', nome: 'Elis Camargo', email: 'elis@clinica.com', papel: 'profissional', profissional_id: 'pe', ativo: true, permissoes: {}, efetivas: ef([]) },
      { id: 'u4', nome: 'Ex-funcionária', email: 'ex@clinica.com', papel: 'recepcao', profissional_id: null, ativo: false, permissoes: {}, efetivas: ef(['conversas', 'agenda_todas', 'agenda_editar', 'pessoas']) },
    ]
  }
  if (rpc === 'dashboard_numeros') return [{ novos_contatos: 48, consultas_agendadas: 19 }]
  if (rpc === 'dashboard_por_dia') return Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 29 + i); return { dia: d.toISOString().slice(0, 10), atendimentos: 1 + ((i * 7) % 5), agendamentos: (i * 3) % 3 } })
  if (rpc === 'dashboard_dia_semana') return [0,1,2,3,4,5,6].map((d) => ({ dia_semana: d, contatos: [2, 9, 11, 8, 10, 7, 1][d] }))
  if (rpc === 'dashboard_profissionais') return [{ profissional_id: 'pd', nome: 'Danielle Freitas', cor: '#1E6E8C', consultas: 9 }, { profissional_id: 'pe', nome: 'Elis Camargo', cor: '#B45309', consultas: 4 }, { profissional_id: 'pm', nome: 'Marina Souza', cor: '#7C3AED', consultas: 6 }]
  if (rpc === 'dashboard_procedimentos') return [['Tratamento facial - Aplicação de Toxina Botulínica', 14, 3], ['Tratamento facial - Limpeza de Pele Profunda', 11, 8], ['Avaliação Estética', 9, 7], ['Tratamento corporal - Depilação a Laser', 7, 0], ['Tratamento corporal - Drenagem Linfática Corporal', 4, 4]].map(([procedimento, procurado, realizado]) => ({ procedimento, procurado, realizado }))
  if (url.includes('/rest/v1/consultas?') && decodeURIComponent(url).includes('profissional:')) return consultas.filter((c) => c.status === 'agendada').map((c) => ({ ...c, profissional: profissionais.find((p) => p.id === c.profissional_id) }))
  if (url.includes('/rest/v1/profissionais?')) return profissionais
  if (url.includes('/rest/v1/profissional_horarios')) return horarios
  if (url.includes('/rest/v1/profissional_bloqueios')) return []
  if (url.includes('/rest/v1/consultas?') && decodeURIComponent(url).includes('lead:')) return consultas
  return objeto ? null : []
}

// ---- Agenda ----
const hojeAs = (h, m = 0, diasDepois = 0) => { const d = new Date(); d.setDate(d.getDate() + diasDepois); d.setHours(h, m, 0, 0); return d.toISOString() }
export const profissionais = [
  { id: 'pd', nome: 'Danielle', sobrenome: 'Freitas', cor: '#1E6E8C', ativo: true },
  { id: 'pe', nome: 'Elis', sobrenome: 'Camargo', cor: '#B45309', ativo: true },
  { id: 'pm', nome: 'Marina', sobrenome: 'Souza', cor: '#7C3AED', ativo: true },
]
export const horarios = [0, 1, 2, 3, 4, 5, 6].flatMap((d) => [
  d >= 2 && d <= 5 && { id: 'hd' + d, profissional_id: 'pd', dia_semana: d, hora_inicio: '08:00:00', hora_fim: '18:00:00', ativo: true },
  d >= 1 && d <= 5 && { id: 'he' + d, profissional_id: 'pe', dia_semana: d, hora_inicio: '08:00:00', hora_fim: '18:00:00', ativo: true },
  d >= 2 && d <= 5 && { id: 'hm' + d, profissional_id: 'pm', dia_semana: d, hora_inicio: '10:00:00', hora_fim: '19:00:00', ativo: true },
].filter(Boolean))
const cons = (id, prof, nome, proc, iso, dur, status = 'agendada', interesse = null) => ({
  id, lead_id: 'l' + id, profissional_id: prof, procedimento: proc, data_consulta: iso, duracao_minutos: dur,
  data_fim: new Date(new Date(iso).getTime() + dur * 60000).toISOString(), status, origem: 'agente', chave_externa: null,
  interesse, lead: { id: 'l' + id, nome_lead: nome, whatsapp_lead: '5511900000000' },
})
export const consultas = [
  cons('1', 'pd', 'Juliana Prado', 'Avaliação Estética', hojeAs(9), 30, 'agendada', 'Tratamento facial - Preenchimento Facial'),
  cons('2', 'pe', 'Carla Menezes Albuquerque de Souza', 'Tratamento facial - Limpeza de Pele Profunda', hojeAs(10), 60),
  cons('3', 'pd', 'Beatriz Nogueira', 'Tratamento facial - Aplicação de Toxina Botulínica', hojeAs(11, 30), 30, 'cancelada'),
  cons('4', 'pm', 'Renata Alves', 'Tratamento corporal - Drenagem Linfática Corporal', hojeAs(14), 60),
  cons('5', 'pd', 'Patrícia Gomes', 'Tratamento facial - Microagulhamento facial', hojeAs(16), 60, 'realizada'),
  cons('6', 'pm', 'Luana Costa', 'Tratamento corporal - Massagem Modeladora', hojeAs(15, 0, 1), 50),
]

// ---- Funil ----
const nomes = ['Ana Ribeiro', 'Bruna Lopes', 'Camila Duarte', 'Daniela Rocha', 'Eduarda Pires', 'Fernanda Melo', 'Gabriela Sá', 'Helena Dias', 'Isabela Cruz', 'Joana Faria', 'Karina Leal', 'Larissa Moura', 'Mariana Teles', 'Natália Brito', 'Olívia Prado', 'Paula Vieira', 'Quésia Lima', 'Rafaela Nunes', 'Sabrina Couto', 'Tatiane Reis', 'Úrsula Maia', 'Vanessa Luz', 'Wanda Serra', 'Yasmin Paz', 'Zuleica Rios']
const etapas = ['iniciou_conversa', 'iniciou_conversa', 'conversando', 'conversando', 'conversando', 'conversando', 'consulta_agendada', 'consulta_agendada', 'consulta_agendada', 'consulta_realizada', 'consulta_realizada', 'paciente_recorrente', 'consulta_cancelada', 'follow_up_1_feito']
export const funil = nomes.map((n, i) => ({ id: 'f' + i, nome_lead: n, whatsapp_lead: '55119' + String(10000000 + i * 7919).slice(0, 8), status: etapas[i % etapas.length], procedimento_interesse: i % 3 ? 'Tratamento facial - Limpeza de Pele Profunda' : null, inicio_atendimento: iso(i * 300), data_agendamento: i % 4 ? null : iso(-1440), ultima_consulta: i % 5 ? null : iso(4000), minutos_ultima_mensagem: i * 97, created_at: iso(i * 300) }))
