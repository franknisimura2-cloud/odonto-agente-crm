import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { aplicarCorDoSistema, corLembradaNoNavegador } from './lib/marca'

// Antes da primeira tela: sem isto, as variáveis da cor não existiriam e todo
// botão nasceria transparente. A cor lembrada é a da última sessão neste
// computador (o login não lê o banco); sem nenhuma, vale a padrão. Depois do
// login, o Layout confere a do banco.
aplicarCorDoSistema(corLembradaNoNavegador())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
