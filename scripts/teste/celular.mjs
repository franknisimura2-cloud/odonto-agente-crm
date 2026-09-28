// Uso: node celular.mjs <url> <saida.png> [largura] [altura] [js-para-rodar-antes-do-print]
import { caminhoDoChrome } from './chrome.mjs'
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, saida, larg = '390', alt = '844', acao = ''] = process.argv.slice(2)
const porta = 9300 + Math.floor(Math.random() * 500)
const chrome = spawn(caminhoDoChrome(), [
  '--headless=new', '--disable-gpu', '--host-resolver-rules=MAP *.nucleo.test 127.0.0.1', `--remote-debugging-port=${porta}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cel-'))}`, 'about:blank',
], { stdio: 'ignore' })
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

let alvo
for (let i = 0; i < 50 && !alvo; i++) {
  await espera(200)
  try { alvo = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find((t) => t.type === 'page') } catch {}
}
const ws = new WebSocket(alvo.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const pend = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') console.log('ERRO JS:', m.params.exceptionDetails.exception?.description?.split('\n')[0])
})
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })

await cmd('Runtime.enable')
const { responder } = await import('./mock.mjs')
await cmd('Fetch.enable', { patterns: [{ urlPattern: '*supabase.co/*' }] })
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method !== 'Fetch.requestPaused') return
  const { requestId, request } = m.params
  const objeto = Object.entries(request.headers).some(([k, v]) => k.toLowerCase() === 'accept' && v.includes('vnd.pgrst.object'))
  const corpo = request.method === 'OPTIONS' ? '' : JSON.stringify(responder(request.url, objeto))
  cmd('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' },
    { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: '*' }],
    body: Buffer.from(corpo).toString('base64') })
})
await cmd('Emulation.setDeviceMetricsOverride', { width: +larg, height: +alt, deviceScaleFactor: 2, mobile: +larg < 768 })
await cmd('Emulation.setTouchEmulationEnabled', { enabled: +larg < 768 })
await cmd('Page.navigate', { url })
await espera(6000)
if (acao) { await cmd('Runtime.evaluate', { expression: acao }); await espera(1200) }
const med = await cmd('Runtime.evaluate', { expression: 'JSON.stringify({vw: innerWidth, rolagemLateral: document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll("main")].some(m => m.scrollWidth > m.clientWidth + 1)})', returnByValue: true })
console.log('medidas:', med.result.result.value)
const img = await cmd('Page.captureScreenshot', { format: 'png' })
writeFileSync(saida, Buffer.from(img.result.data, 'base64'))
ws.close(); chrome.kill()
process.exit(0)
