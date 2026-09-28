import { useCallback, useEffect, useState } from 'react'
import { UserPlus, Copy, Check, KeyRound, ChevronDown, Power, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAcesso, type Papel, type Permissao } from '../lib/acesso'
import {
  listarEquipe, atualizarAcesso, criarLogin, gerarSenhaNova,
  PERMISSOES, NOME_DO_PAPEL, type Membro,
} from '../lib/equipe'
import { MARCA, MARCA_SUAVE } from '../lib/marca'

/**
 * A aba "Equipe" de Configurações: quem entra no sistema, com que papel, e o
 * que cada um pode — a dona liga e desliga por pessoa.
 *
 * A trava é do banco (0031, 0035): esta tela só mostra e pede. Uma mudança
 * que o banco recusa (a última dona, mexer em dona sem ser dona) volta como
 * mensagem, e a lista é relida.
 */

const FONTE = "'Plus Jakarta Sans', sans-serif"
const campo: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid #DCE6EA',
  fontSize: 13.5, fontFamily: FONTE, color: '#16232B', background: '#fff', boxSizing: 'border-box',
}
const cartao: React.CSSProperties = {
  background: '#fff', borderRadius: 14, border: '1px solid #DCE6EA', padding: '18px 20px', marginBottom: 12,
}

interface Prof { id: string; nome: string; sobrenome: string; ativo: boolean }

/** A senha provisória, mostrada UMA vez, com o botão de copiar. */
function SenhaMostrada({ email, senha, onFechar }: { email: string | null; senha: string; onFechar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <div style={{ ...cartao, background: '#E8F8EF', borderColor: '#B7E7CB' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#14532D', marginBottom: 6 }}>Senha provisória</div>
      <div style={{ fontSize: 13, color: '#1A7A48', lineHeight: 1.55, marginBottom: 12 }}>
        Passe para a pessoa{email ? <> (<strong>{email}</strong>)</> : null}. Ela entra com esta senha e
        troca em <strong>Configurações → Perfil</strong>. <strong>Ela não aparece de novo</strong> — se
        perder, gere outra.
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <code style={{ fontSize: 17, fontWeight: 700, padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #B7E7CB', letterSpacing: 1 }}>
          {senha}
        </code>
        <button
          onClick={() => { void navigator.clipboard.writeText(senha).then(() => setCopiado(true)) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, border: 'none', background: '#1A7A48', color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: FONTE }}>
          {copiado ? <><Check size={14} /> Copiada</> : <><Copy size={14} /> Copiar</>}
        </button>
        <button onClick={onFechar}
          style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid #B7E7CB', background: '#fff', color: '#14532D', cursor: 'pointer', fontWeight: 600, fontFamily: FONTE }}>
          Já passei
        </button>
      </div>
    </div>
  )
}

function Interruptor({ ligado, travado, onMudar }: { ligado: boolean; travado?: boolean; onMudar: () => void }) {
  return (
    <button onClick={onMudar} disabled={travado} role="switch" aria-checked={ligado}
      style={{
        width: 40, height: 23, borderRadius: 12, border: 'none', padding: 2, flexShrink: 0,
        background: ligado ? MARCA : '#DCE6EA', cursor: travado ? 'default' : 'pointer',
        opacity: travado ? 0.55 : 1, display: 'flex', justifyContent: ligado ? 'flex-end' : 'flex-start',
        transition: 'background 0.15s',
      }}>
      <span style={{ width: 19, height: 19, borderRadius: '50%', background: '#fff', display: 'block' }} />
    </button>
  )
}

function Pessoa({ m, profs, souDona, meuId, onMudou, onSenha }: {
  m: Membro; profs: Prof[]; souDona: boolean; meuId: string | null
  onMudou: () => void; onSenha: (email: string | null, senha: string) => void
}) {
  const [aberta, setAberta] = useState(false)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const ehDona = m.papel === 'dona'
  // Mexer numa dona é só para outra dona (0035). Sem isso, a tela mostraria
  // controles que o banco recusa.
  const podeMexer = !ehDona || souDona

  async function mudar(campos: Parameters<typeof atualizarAcesso>[1]) {
    setOcupado(true); setErro('')
    try { await atualizarAcesso(m.id, campos) } catch (e) { setErro((e as Error).message) }
    setOcupado(false)
    onMudou()
  }

  async function senhaNova() {
    setOcupado(true); setErro('')
    try { const r = await gerarSenhaNova(m.id); onSenha(m.email, r.senha) } catch (e) { setErro((e as Error).message) }
    setOcupado(false)
  }

  const prof = profs.find((p) => p.id === m.profissional_id)
  const ajustada = Object.keys(m.permissoes ?? {}).length > 0

  return (
    <div style={{ ...cartao, opacity: m.ativo ? 1 : 0.6 }}>
      <button onClick={() => setAberta((a) => !a)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: FONTE }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: MARCA_SUAVE, color: MARCA, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
          {(m.nome || m.email || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#16232B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.nome || 'Sem nome'}{m.id === meuId ? ' (você)' : ''}
          </div>
          <div style={{ fontSize: 12.5, color: '#6B818C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.email ?? '—'}{prof ? ` · agenda de ${prof.nome}` : ''}
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: ehDona ? MARCA : MARCA_SUAVE, color: ehDona ? '#fff' : MARCA, flexShrink: 0 }}>
          {NOME_DO_PAPEL[m.papel]}
        </span>
        {!m.ativo && <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', flexShrink: 0 }}>Desligado</span>}
        <ChevronDown size={16} color="#9AAEB6" style={{ transform: aberta ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
      </button>

      {aberta && (
        <div style={{ marginTop: 16, borderTop: '1px solid #EDF2F4', paddingTop: 16 }}>
          {!podeMexer && (
            <div style={{ fontSize: 13, color: '#6B818C', marginBottom: 12 }}>Só uma dona mexe no acesso de uma dona.</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#16232B' }}>
              Papel
              <select value={m.papel} disabled={!podeMexer || ocupado}
                onChange={(e) => void mudar({ papel: e.target.value as Papel })}
                style={{ ...campo, marginTop: 6 }}>
                <option value="recepcao">{NOME_DO_PAPEL.recepcao}</option>
                <option value="profissional">{NOME_DO_PAPEL.profissional}</option>
                {(souDona || ehDona) && <option value="dona">{NOME_DO_PAPEL.dona}</option>}
              </select>
            </label>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#16232B' }}>
              Agenda da profissional
              <select value={m.profissional_id ?? ''} disabled={!podeMexer || ocupado}
                onChange={(e) => void mudar({ profissional_id: e.target.value || null })}
                style={{ ...campo, marginTop: 6 }}>
                <option value="">Nenhuma</option>
                {profs.filter((p) => p.ativo).map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}{p.sobrenome ? ` ${p.sobrenome}` : ''}</option>
                ))}
              </select>
            </label>
          </div>

          {ehDona ? (
            <div style={{ fontSize: 13, color: '#6B818C', marginBottom: 12 }}>A dona tem acesso a tudo, sempre.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {PERMISSOES.map(({ chave, nome, explica }) => (
                <div key={chave} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#16232B' }}>{nome}</div>
                    <div style={{ fontSize: 12, color: '#6B818C' }}>{explica}</div>
                  </div>
                  <Interruptor ligado={m.efetivas[chave]} travado={!podeMexer || ocupado}
                    onMudar={() => void mudar({ permissoes: { ...m.permissoes, [chave]: !m.efetivas[chave] } as Record<Permissao, boolean> })} />
                </div>
              ))}
            </div>
          )}

          {erro && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#DC2626', marginBottom: 12 }}>{erro}</div>
          )}

          {podeMexer && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!ehDona && ajustada && (
                <button onClick={() => void mudar({ permissoes: {} })} disabled={ocupado} style={botaoSecundario}>
                  <RotateCcw size={14} /> Voltar ao padrão do papel
                </button>
              )}
              <button onClick={() => void senhaNova()} disabled={ocupado} style={botaoSecundario}>
                <KeyRound size={14} /> Gerar senha nova
              </button>
              {m.id !== meuId && (
                <button onClick={() => void mudar({ ativo: !m.ativo })} disabled={ocupado}
                  style={{ ...botaoSecundario, color: m.ativo ? '#DC2626' : '#1A7A48' }}>
                  <Power size={14} /> {m.ativo ? 'Desligar acesso' : 'Religar acesso'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const botaoSecundario: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 9,
  border: '1px solid #DCE6EA', background: '#fff', color: '#16232B', cursor: 'pointer',
  fontSize: 13, fontWeight: 600, fontFamily: FONTE,
}

export default function TabEquipe() {
  const acesso = useAcesso()
  const souDona = acesso.papel === 'dona'
  const [equipe, setEquipe] = useState<Membro[]>([])
  const [profs, setProfs] = useState<Prof[]>([])
  const [meuId, setMeuId] = useState<string | null>(null)
  const [erroLista, setErroLista] = useState('')
  const [senha, setSenha] = useState<{ email: string | null; senha: string } | null>(null)

  const [novo, setNovo] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', papel: 'recepcao' as Papel, profissional_id: '' })
  const [criando, setCriando] = useState(false)
  const [erroNovo, setErroNovo] = useState('')

  const recarregar = useCallback(() => {
    listarEquipe().then(setEquipe).catch(() => setErroLista('Não consegui carregar a equipe.'))
  }, [])

  useEffect(() => {
    recarregar()
    void supabase.from('profissionais').select('id, nome, sobrenome, ativo').order('nome')
      .then(({ data }) => setProfs((data ?? []) as Prof[]))
    void supabase.auth.getUser().then(({ data }) => setMeuId(data.user?.id ?? null))
  }, [recarregar])

  async function criar() {
    setCriando(true); setErroNovo('')
    try {
      const r = await criarLogin({
        nome: form.nome.trim(), email: form.email.trim(), papel: form.papel,
        profissional_id: form.profissional_id || null,
      })
      setSenha({ email: form.email.trim().toLowerCase(), senha: r.senha })
      setNovo(false)
      setForm({ nome: '', email: '', papel: 'recepcao', profissional_id: '' })
      recarregar()
    } catch (e) {
      setErroNovo((e as Error).message)
    }
    setCriando(false)
  }

  // Profissionais que ainda não têm login: uma agenda, um login (0031).
  const semLogin = profs.filter((p) => p.ativo && !equipe.some((m) => m.profissional_id === p.id))

  return (
    <div>
      {senha && <SenhaMostrada email={senha.email} senha={senha.senha} onFechar={() => setSenha(null)} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: '#6B818C', maxWidth: 520, lineHeight: 1.55 }}>
          Cada pessoa entra com o próprio login. O papel dá o ponto de partida; os
          interruptores ajustam por pessoa.
        </div>
        {!novo && (
          <button onClick={() => setNovo(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: 'none', background: MARCA, color: '#fff', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, fontFamily: FONTE }}>
            <UserPlus size={15} /> Adicionar pessoa
          </button>
        )}
      </div>

      {novo && (
        <div style={cartao}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#16232B', marginBottom: 14 }}>Nova pessoa na equipe</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#16232B' }}>
              Nome
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={{ ...campo, marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#16232B' }}>
              E-mail (é o login)
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ ...campo, marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#16232B' }}>
              Papel
              <select value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value as Papel })} style={{ ...campo, marginTop: 6 }}>
                <option value="recepcao">{NOME_DO_PAPEL.recepcao}</option>
                <option value="profissional">{NOME_DO_PAPEL.profissional}</option>
                {souDona && <option value="dona">{NOME_DO_PAPEL.dona}</option>}
              </select>
            </label>
            {form.papel === 'profissional' && (
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#16232B' }}>
                Agenda dela
                <select value={form.profissional_id} onChange={(e) => setForm({ ...form, profissional_id: e.target.value })} style={{ ...campo, marginTop: 6 }}>
                  <option value="">Escolha…</option>
                  {semLogin.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}{p.sobrenome ? ` ${p.sobrenome}` : ''}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {form.papel === 'profissional' && semLogin.length === 0 && (
            <div style={{ fontSize: 12.5, color: '#B45309', marginTop: 10 }}>
              Todas as profissionais cadastradas já têm login. Cadastre a profissional em Profissionais primeiro.
            </div>
          )}
          {erroNovo && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#DC2626', marginTop: 12 }}>{erroNovo}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button onClick={() => void criar()}
              disabled={criando || !form.nome.trim() || !form.email.trim() || (form.papel === 'profissional' && !form.profissional_id)}
              style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: MARCA, color: '#fff', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, fontFamily: FONTE, opacity: criando ? 0.7 : 1 }}>
              {criando ? 'Criando…' : 'Criar login'}
            </button>
            <button onClick={() => { setNovo(false); setErroNovo('') }} style={botaoSecundario}>Cancelar</button>
          </div>
        </div>
      )}

      {erroLista && <div style={{ fontSize: 13, color: '#DC2626', marginBottom: 12 }}>{erroLista}</div>}

      {equipe.map((m) => (
        <Pessoa key={m.id} m={m} profs={profs} souDona={souDona} meuId={meuId}
          onMudou={recarregar} onSenha={(email, s) => setSenha({ email, senha: s })} />
      ))}
    </div>
  )
}
