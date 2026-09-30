import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CRM from './pages/CRM'
import Conversas from './pages/Conversas'
import Agenda from './pages/Agenda'
import Profissionais from './pages/Profissionais'
import Leads from './pages/Leads'
import Clientes from './pages/Clientes'
import LeadDetail from './pages/LeadDetail'
import Configuracoes from './pages/Configuracoes'
import Procedimentos from './pages/Procedimentos'
import Convenios from './pages/Convenios'
import Planos from './pages/Planos'
import OrcamentoPublico from './pages/OrcamentoPublico'
import SecretariaIA from './pages/SecretariaIA'
import TokenApi from './pages/TokenApi'
import { ExigeAcesso } from './components/AcessoProvider'
import { veAgenda, veFichas, type Acesso } from './lib/acesso'

// Cada rota com o acesso que ela exige (níveis de acesso, migração 0031).
// Sem ele, a pessoa vai para a primeira tela que pode usar. Configurações não
// tem exigência: a aba Perfil (nome, foto, senha) é de todo mundo.
const so = (permite: (a: Acesso) => boolean, tela: React.ReactNode) =>
  <ExigeAcesso permite={permite}>{tela}</ExigeAcesso>

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* O plano de tratamento visto pelo paciente: sem login (0041). */}
        <Route path="/orcamento/:token" element={<OrcamentoPublico />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={so((a) => a.pode('dashboard'), <Dashboard />)} />
            <Route path="/crm" element={so((a) => a.pode('crm'), <CRM />)} />
            <Route path="/conversas" element={so((a) => a.pode('conversas'), <Conversas />)} />
            <Route path="/agenda" element={so(veAgenda, <Agenda />)} />
            <Route path="/profissionais" element={so((a) => a.pode('configurar'), <Profissionais />)} />
            <Route path="/servicos" element={so((a) => a.pode('configurar'), <Procedimentos />)} />
            <Route path="/convenios" element={so((a) => a.pode('configurar'), <Convenios />)} />
            <Route path="/atendente-ia" element={so((a) => a.pode('configurar'), <SecretariaIA />)} />
            <Route path="/token-api" element={so((a) => a.pode('configurar'), <TokenApi />)} />
            <Route path="/leads" element={so((a) => a.pode('pessoas'), <Leads />)} />
            <Route path="/clientes" element={so((a) => a.pode('pessoas'), <Clientes />)} />
            <Route path="/planos" element={so((a) => a.pode('orcamentos') || a.pode('odontograma'), <Planos />)} />
            <Route path="/leads/:id" element={so(veFichas, <LeadDetail />)} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
