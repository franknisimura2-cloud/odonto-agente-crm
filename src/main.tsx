import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { aplicarCorDoSistema, corLembradaNoNavegador } from './lib/marca'
import { descobrirClinica } from './lib/clinica'
import TelaAviso from './components/TelaAviso'

// ⚠️ NADA AQUI PODE IMPORTAR O SUPABASE, DIRETA OU INDIRETAMENTE.
//
// O banco é o da clínica deste endereço, e ele só é conhecido depois de
// `descobrirClinica()` (ver `lib/clinica.ts`). Por isso o `App` — e com ele
// todo o resto do sistema — é importado DEPOIS, com `import()`. Um `import App`
// no topo deste arquivo criaria o cliente do Supabase antes de saber qual.

const raiz = createRoot(document.getElementById('root')!)

async function iniciar() {
  const r = await descobrirClinica()

  // Antes da primeira tela: sem isto, as variáveis da cor não existiriam e todo
  // botão nasceria transparente. Vale a cor lembrada neste computador (a da
  // última sessão); na primeira visita, a da ficha da clínica; sem nenhuma, a
  // padrão. Depois do login, o Layout confere a do banco.
  const cor = r.estado === 'desconhecida' ? null : r.clinica.cor
  aplicarCorDoSistema(corLembradaNoNavegador() ?? cor ?? null)

  if (r.estado === 'suspensa') {
    raiz.render(<TelaAviso
      titulo="Acesso suspenso"
      texto={`O acesso de ${r.clinica.nome || 'esta empresa'} ao sistema está suspenso no momento. Os dados continuam guardados. Para reativar, fale com o suporte.`}
    />)
    return
  }
  if (r.estado === 'desconhecida') {
    raiz.render(<TelaAviso
      titulo="Endereço não encontrado"
      texto={`Não existe um sistema neste endereço (${r.endereco}). Confira o link que você recebeu.`}
    />)
    return
  }

  const { default: App } = await import('./App.tsx')
  raiz.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void iniciar()
