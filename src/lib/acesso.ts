import { createContext, useContext } from 'react'

/**
 * O que o usuário desta sessão pode usar — para a TELA esconder o resto.
 *
 * ⚠️ Isto não é a trava. A trava são as políticas do banco (migração 0031) e
 * a conferência da função `whatsapp`. Esconder um botão aqui só evita que a
 * pessoa clique em algo que o banco vai recusar.
 *
 * As permissões vêm prontas do banco (`minhas_permissoes()`, migração 0032),
 * calculadas pela mesma `pode()` das políticas. Não recalcule aqui: duas
 * cópias da regra discordam no primeiro ajuste.
 *
 * A lista é a mesma do cabeçalho da 0031 e da 0032 — permissão nova entra
 * nos três.
 */
export type Permissao =
  | 'dashboard' | 'valores' | 'conversas' | 'agenda_todas' | 'agenda_editar'
  | 'pessoas' | 'crm' | 'exportar' | 'configurar' | 'equipe'

export type Papel = 'dona' | 'recepcao' | 'profissional'

export interface Acesso {
  /** `false` enquanto a pergunta ao banco não voltou. */
  carregado: boolean
  papel: Papel | null
  /** O cadastro de Profissionais ligado a este login, ou `null`. */
  profissionalId: string | null
  pode: (p: Permissao) => boolean
  /** Relê do banco — depois de a dona mudar os acessos, por exemplo. */
  recarregar: () => void
}

export const AcessoContexto = createContext<Acesso>({
  carregado: false,
  papel: null,
  profissionalId: null,
  pode: () => false,
  recarregar: () => {},
})

export function useAcesso(): Acesso {
  return useContext(AcessoContexto)
}

/** Vê a agenda: a de todas, ou a própria (profissional ligada a um cadastro). */
export function veAgenda(a: Acesso): boolean {
  return a.pode('agenda_todas') || !!a.profissionalId
}

/** Abre a ficha de uma pessoa (o banco decide QUAIS pessoas). */
export function veFichas(a: Acesso): boolean {
  return a.pode('pessoas') || a.pode('conversas') || a.pode('crm') || !!a.profissionalId
}

/**
 * Para onde vai quem entra, ou quem abriu uma tela que não é dele: a primeira
 * que ele pode usar, na ordem de quem mais usa. Sem nenhuma, Configurações —
 * a aba Perfil é de todo mundo (nome, foto, senha).
 */
export function primeiraTela(a: Acesso): string {
  if (a.pode('dashboard')) return '/'
  if (a.pode('conversas')) return '/conversas'
  if (veAgenda(a)) return '/agenda'
  if (a.pode('pessoas')) return '/leads'
  if (a.pode('crm')) return '/crm'
  return '/configuracoes'
}

/** Nenhuma permissão e nenhuma agenda: a dona ainda não liberou nada. */
export function semNenhumAcesso(a: Acesso): boolean {
  return a.carregado && a.papel !== 'dona' && !veAgenda(a) && !veFichas(a)
    && !a.pode('dashboard') && !a.pode('configurar')
}
