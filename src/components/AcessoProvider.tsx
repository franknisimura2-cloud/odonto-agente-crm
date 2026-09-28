import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AcessoContexto, primeiraTela, useAcesso, type Acesso, type Papel, type Permissao } from '../lib/acesso'
import { MARCA, MARCA_SUAVE } from '../lib/marca'

interface Resposta {
  papel: Papel | null
  profissional_id: string | null
  permissoes: Record<Permissao, boolean> | null
}

/**
 * Carrega as permissões uma vez por sessão (e de novo no evento
 * `acesso-atualizado`, que a tela de Equipe dispara). Mora no `Layout`: toda
 * tela autenticada passa por ele.
 */
export function AcessoProvider({ children }: { children: ReactNode }) {
  const [resposta, setResposta] = useState<Resposta | null>(null)

  const recarregar = useCallback(() => {
    void supabase.rpc('minhas_permissoes').then(({ data, error }) => {
      // Falhou a pergunta: sem permissão nenhuma, e não com todas. Uma tela
      // vazia avisa que algo deu errado; uma tela cheia esconderia o erro.
      setResposta(error || !data ? { papel: null, profissional_id: null, permissoes: null } : data as Resposta)
    })
  }, [])

  useEffect(() => {
    recarregar()
    window.addEventListener('acesso-atualizado', recarregar)
    return () => window.removeEventListener('acesso-atualizado', recarregar)
  }, [recarregar])

  const valor = useMemo<Acesso>(() => ({
    carregado: resposta !== null,
    papel: resposta?.papel ?? null,
    profissionalId: resposta?.profissional_id ?? null,
    pode: (p) => resposta?.permissoes?.[p] === true,
    recarregar,
  }), [resposta, recarregar])

  return <AcessoContexto.Provider value={valor}>{children}</AcessoContexto.Provider>
}

/**
 * Uma rota que exige acesso. Sem ele, leva à primeira tela que a pessoa pode
 * usar — sem mensagem de erro: quem digitou `/dashboard` sem poder vê a agenda
 * dela, que é o que ela procurava de qualquer forma.
 */
export function ExigeAcesso({ permite, children }: { permite: (a: Acesso) => boolean; children: ReactNode }) {
  const acesso = useAcesso()
  if (!acesso.carregado) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 28, height: 28, border: `3px solid ${MARCA_SUAVE}`, borderTopColor: MARCA, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    )
  }
  if (!permite(acesso)) return <Navigate to={primeiraTela(acesso)} replace />
  return <>{children}</>
}
