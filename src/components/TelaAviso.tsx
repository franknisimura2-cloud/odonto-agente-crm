import { CircleDot } from 'lucide-react'
import { MARCA, MARCA_SUAVE, NOME_DO_SISTEMA } from '../lib/marca'

/**
 * A tela que aparece NO LUGAR do sistema: clínica suspensa, ou endereço que não
 * é de clínica nenhuma.
 *
 * ⚠️ Não importa o Supabase, nem nada que importe. Ela existe justamente para
 * quando não há banco a abrir — ver `main.tsx` e `clinica.ts`.
 */
export default function TelaAviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F2F6F7', padding: 24, fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{
        background: '#fff', border: '1px solid #DCE6EA', borderRadius: 16,
        padding: '32px 28px', maxWidth: 420, width: '100%', textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, background: MARCA_SUAVE, margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CircleDot size={26} style={{ color: MARCA }} />
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: '#16232B', margin: '0 0 8px' }}>{titulo}</h1>
        <p style={{ fontSize: 14, color: '#6B818C', lineHeight: 1.6, margin: 0 }}>{texto}</p>
        <div style={{ fontSize: 12, color: '#9AAEB6', marginTop: 20 }}>{NOME_DO_SISTEMA}</div>
      </div>
    </div>
  )
}
