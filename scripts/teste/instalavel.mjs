import { caminhoDoChrome } from './chrome.mjs'
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const porta = 9800 + Math.floor(Math.random() * 100)
const chrome = spawn(caminhoDoChrome(), ['--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pw-'))}`, 'about:blank'], { stdio: 'ignore' })
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
let alvo
for (let i = 0; i < 50 && !alvo; i++) { await espera(200); try { alvo = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find((t) => t.type === 'page') } catch {} }
const ws = new WebSocket(alvo.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pend = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id) { pend.get(m.id)?.(m); pend.delete(m.id) } })
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const { responder } = await import('./mock.mjs')
await cmd('Fetch.enable', { patterns: [{ urlPattern: '*supabase.co/*' }] })
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.method !== 'Fetch.requestPaused') return
  const { requestId, request } = m.params
  const objeto = Object.entries(request.headers).some(([k, v]) => k.toLowerCase() === 'accept' && v.includes('vnd.pgrst.object'))
  cmd('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: '*' }], body: Buffer.from(request.method === 'OPTIONS' ? '' : JSON.stringify(responder(request.url, objeto))).toString('base64') }) })
await cmd('Page.enable')
await cmd('Page.navigate', { url: process.argv[2] })
await espera(6000)
const ev = await cmd('Runtime.evaluate', { expression: 'JSON.stringify({manifesto: document.querySelector("link[rel=manifest]").getAttribute("href"), apple: document.querySelector("link[rel=apple-touch-icon]").getAttribute("href"), tema: document.querySelector("meta[name=theme-color]").content})', returnByValue: true })
console.log('na página:', ev.result.result.value)
const man = await cmd('Page.getAppManifest')
console.log('manifesto lido pelo Chrome:', man.result?.url, man.result?.errors?.length ? JSON.stringify(man.result.errors) : 'sem erros')
const inst = await cmd('Page.getInstallabilityErrors')
console.log('instalável?', JSON.stringify(inst.result?.installabilityErrors ?? inst))
ws.close(); chrome.kill(); process.exit(0)
