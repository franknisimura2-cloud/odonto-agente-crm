import { useEffect, useRef, useState } from 'react'
import { Check, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  CORES_DO_SISTEMA, MARCA, aplicarCorDoSistema, corPorId, lembrarCorNoNavegador,
} from '../lib/marca'

/**
 * "Cor do sistema", na aba Empresa de Configurações (migração 0029).
 *
 * Clicar numa cor PINTA o sistema inteiro na hora, para a pessoa ver antes de
 * decidir — mas só o "Salvar" grava, e só a cor gravada vale para a equipe e
 * para o login deste computador. Quem sai da tela sem salvar leva o sistema de
 * volta para a cor salva: uma prévia esquecida não pode virar a cor de alguém.
 *
 * A lista e os tons moram em `src/lib/marca.ts`, e não aqui.
 */

const FONTE = "'Plus Jakarta Sans', sans-serif"

interface Props {
  /** A linha de `configuracoes_clinica`. Nula = ainda não existe, e o salvar cria. */
  clinicaId: string | null
  /** A chave gravada no banco. */
  corSalva: string
  onSalvo: (cor: string, clinicaId: string) => void
}

export default function SeletorDeCor({ clinicaId, corSalva, onSalvo }: Props) {
  const salva = corPorId(corSalva)
  const [escolhida, setEscolhida] = useState(salva.id)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState('')

  // A cor salva mais recente, para a saída sem salvar. Ref, e não o valor da
  // renderização: a limpeza do efeito roda uma vez só, no fim.
  const salvaRef = useRef(salva.id)
  useEffect(() => { salvaRef.current = salva.id }, [salva.id])
  useEffect(() => () => { aplicarCorDoSistema(salvaRef.current) }, [])

  const mudou = escolhida !== salva.id

  const escolher = (id: string) => {
    setEscolhida(id)
    setErro('')
    setSalvo(false)
    aplicarCorDoSistema(id)
  }

  const salvar = async () => {
    setSalvando(true)
    setErro('')
    const { data, error } = clinicaId
      ? await supabase.from('configuracoes_clinica').update({ cor_sistema: escolhida }).eq('id', clinicaId).select('id').single()
      : await supabase.from('configuracoes_clinica').insert({ cor_sistema: escolhida }).select('id').single()
    setSalvando(false)
    if (error || !data) {
      setErro('Não consegui salvar a cor. Tente de novo.')
      return
    }
    salvaRef.current = escolhida
    lembrarCorNoNavegador(escolhida)
    onSalvo(escolhida, data.id)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  return (
    <div className="cartao" style={{ background: '#fff', borderRadius: 14, border: '1px solid #DCE6EA', padding: '22px 26px', marginTop: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#16232B', marginBottom: 6 }}>Cor do sistema</div>
      <p style={{ fontSize: 12.5, color: '#6B818C', margin: 0, lineHeight: 1.6 }}>
        A cor dos botões, dos links e do menu. As etiquetas de status e as cores
        dos profissionais na agenda não mudam.
      </p>

      <div role="group" aria-label="Cor do sistema" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 18px', margin: '20px 0 4px' }}>
        {CORES_DO_SISTEMA.map((cor) => {
          const ativa = cor.id === escolhida
          return (
            <button
              key={cor.id}
              type="button"
              aria-pressed={ativa}
              onClick={() => escolher(cor.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
                minWidth: 64, padding: 4, background: 'none', border: 'none',
                borderRadius: 12, cursor: 'pointer', fontFamily: FONTE,
              }}
            >
              <span style={{
                width: 44, height: 44, borderRadius: '50%', background: cor.principal,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: ativa ? `0 0 0 3px #fff, 0 0 0 5px ${cor.principal}` : '0 0 0 3px #fff, 0 0 0 4px #DCE6EA',
                transition: 'box-shadow 0.2s',
              }}>
                {ativa && <Check size={20} color="#FFFFFF" strokeWidth={2.6} />}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: ativa ? 700 : 600, color: ativa ? '#16232B' : '#6B818C' }}>
                {cor.nome}
              </span>
            </button>
          )
        })}
      </div>

      {erro && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#DC2626', marginTop: 14 }}>{erro}</div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
        gap: '12px 20px', marginTop: 18, paddingTop: 14, borderTop: '1px solid #EDF2F4',
      }}>
        <p style={{ fontSize: 12.5, color: '#6B818C', margin: 0, lineHeight: 1.6, maxWidth: 520 }}>
          {mudou ? (
            <>
              Você está vendo <strong style={{ color: '#16232B' }}>{corPorId(escolhida).nome}</strong>.
              Sem salvar, o sistema volta para <strong style={{ color: '#16232B' }}>{salva.nome}</strong> quando
              você sair desta tela.
            </>
          ) : (
            <>
              Clicou numa cor, o sistema inteiro muda na hora para você ver.{' '}
              <strong style={{ color: '#16232B' }}>Salvar</strong> grava para a equipe toda.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={salvar}
          disabled={!mudou || salvando}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 9, border: 'none',
            background: salvo ? '#1A7A48' : mudou ? MARCA : '#B8CBD3',
            color: '#fff', cursor: mudou && !salvando ? 'pointer' : 'not-allowed',
            fontSize: 13, fontWeight: 600, fontFamily: FONTE, transition: 'background 0.2s',
          }}
        >
          {salvo ? <Check size={14} /> : <Save size={14} />}
          {salvo ? 'Salvo!' : salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
