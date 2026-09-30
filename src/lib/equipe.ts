import { supabase, SUPABASE_URL } from './supabase'
import type { Papel, Permissao } from './acesso'

/**
 * A equipe e os acessos — o que a aba "Equipe" de Configurações usa.
 *
 * Ler a lista e mudar papel, permissões e "desligar" vão DIRETO ao banco: a
 * política e o gatilho (migrações 0031 e 0035) conferem quem pode. Criar
 * login e gerar senha precisam da chave de serviço e passam pela função
 * `whatsapp` (rotas /equipe/...), que confere o mesmo.
 */

export interface Membro {
  id: string
  nome: string
  email: string | null
  papel: Papel
  profissional_id: string | null
  ativo: boolean
  /** Só os ajustes da dona por cima do papel. */
  permissoes: Partial<Record<Permissao, boolean>>
  /** O que vale de fato: o papel com os ajustes — calculado pelo banco. */
  efetivas: Record<Permissao, boolean>
  created_at: string
}

/** As permissões, na ordem e com as palavras da tela. */
export const PERMISSOES: { chave: Permissao; nome: string; explica: string }[] = [
  { chave: 'conversas', nome: 'Conversas', explica: 'Ler e responder o WhatsApp' },
  { chave: 'agenda_todas', nome: 'Agenda de todas', explica: 'Ver a agenda de todas as profissionais' },
  { chave: 'agenda_editar', nome: 'Mexer na agenda', explica: 'Marcar, remarcar, cancelar e dar baixa' },
  { chave: 'pessoas', nome: 'Leads e Clientes', explica: 'Ver e editar as fichas' },
  { chave: 'odontograma', nome: 'Odontograma', explica: 'Marcar e alterar o odontograma (ver, vê quem vê a ficha)' },
  { chave: 'crm', nome: 'CRM', explica: 'O funil' },
  { chave: 'dashboard', nome: 'Dashboard', explica: 'Os números da empresa' },
  { chave: 'valores', nome: 'Valores', explica: 'O valor pago de cada pessoa e de cada consulta' },
  { chave: 'exportar', nome: 'Exportar', explica: 'Baixar as listas em CSV e PDF' },
  { chave: 'configurar', nome: 'Configurar', explica: 'Empresa, horários, serviços, profissionais, atendente de IA e API' },
  { chave: 'equipe', nome: 'Equipe', explica: 'Adicionar pessoas e mudar os acessos' },
]

// Na tela o papel 'dona' se chama Admin. O valor no banco continua 'dona':
// nome interno não muda (migrações, políticas e testes dependem dele).
export const NOME_DO_PAPEL: Record<Papel, string> = {
  dona: 'Admin',
  recepcao: 'Recepção',
  profissional: 'Profissional',
}

export async function listarEquipe(): Promise<Membro[]> {
  const { data, error } = await supabase.rpc('equipe')
  if (error) throw error
  return (data ?? []) as Membro[]
}

/** Uma mensagem para a dona, a partir do erro do banco ou da função. */
export function motivoLegivel(motivo: string | undefined): string {
  if (!motivo) return 'Não deu certo. Tente de novo.'
  if (motivo.includes('ultima_dona')) return 'A empresa precisa de pelo menos um admin ativo.'
  if (motivo.includes('so_dona') || motivo.includes('só uma dona')) return 'Só quem é admin pode mexer no acesso de outro admin.'
  if (motivo.includes('sem_permissao')) return 'Você não tem permissão para mudar acessos.'
  if (motivo === 'email_existe') return 'Já existe um login com esse e-mail.'
  if (motivo === 'profissional_ja_tem_login') return 'Essa profissional já tem um login.'
  if (motivo === 'dados_invalidos') return 'Confira o nome e o e-mail.'
  if (motivo.includes('usuarios_profissional_unico') || motivo.includes('duplicate')) return 'Essa profissional já está ligada a outro login.'
  return 'Não deu certo. Tente de novo.'
}

export async function atualizarAcesso(
  id: string,
  campos: Partial<Pick<Membro, 'papel' | 'permissoes' | 'profissional_id' | 'ativo'>>,
): Promise<void> {
  const { error } = await supabase.from('usuarios').update(campos).eq('id', id)
  if (error) throw new Error(motivoLegivel(error.message))
  // Mudou o próprio acesso? A barra e as telas releem.
  window.dispatchEvent(new Event('acesso-atualizado'))
}

async function chamarEquipe(rota: string, corpo: unknown): Promise<{ id?: string; senha: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp/equipe/${rota}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const resposta = await r.json().catch(() => ({}))
  if (!r.ok || !resposta.ok) throw new Error(motivoLegivel(resposta.motivo))
  return resposta
}

export function criarLogin(dados: { nome: string; email: string; papel: Papel; profissional_id: string | null }) {
  return chamarEquipe('criar', dados)
}

export function gerarSenhaNova(id: string) {
  return chamarEquipe('nova-senha', { id })
}
