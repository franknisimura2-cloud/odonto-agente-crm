// Gera os PNG do aplicativo: 3 tamanhos x 7 cores, pelo Chrome sem tela.
import { caminhoDoChrome } from './teste/chrome.mjs'
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const destino = process.argv[2]
const cores = { petroleo: '#1E6E8C', azul: '#2563EB', verde: '#15803D', roxo: '#6D28D9', rosa: '#BE185D', laranja: '#C2410C', marrom: '#7C4A2D' }
const tamanhos = { 'icone-192': 192, 'icone-512': 512, 'apple-touch-icon': 180 }
const porta = 9400 + Math.floor(Math.random() * 400)
const chrome = spawn(caminhoDoChrome(), ['--headless=new', '--disable-gpu', `--remote-debugging-port=${porta}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ic-'))}`, 'about:blank'], { stdio: 'ignore' })
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
let alvo
for (let i = 0; i < 50 && !alvo; i++) { await espera(200); try { alvo = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find((t) => t.type === 'page') } catch {} }
const ws = new WebSocket(alvo.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pend = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id) { pend.get(m.id)?.(m); pend.delete(m.id) } })
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
for (const [nomeCor, hex] of Object.entries(cores)) {
  for (const [arquivo, px] of Object.entries(tamanhos)) {
    // Quadrado cheio, sem canto arredondado: quem arredonda é o sistema do
    // celular. O desenho ocupa o miolo, dentro da zona segura do "maskable".
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${px}" height="${px}"><rect width="24" height="24" fill="${hex}"/><circle cx="12" cy="12" r="5.4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="2" fill="#fff"/></svg>`
    await cmd('Emulation.setDeviceMetricsOverride', { width: px, height: px, deviceScaleFactor: 1, mobile: false })
    await cmd('Page.navigate', { url: 'data:text/html,' + encodeURIComponent(`<body style="margin:0">${svg}</body>`) })
    await espera(300)
    const img = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: px, height: px, scale: 1 } })
    writeFileSync(join(destino, `${arquivo}-${nomeCor}.png`), Buffer.from(img.result.data, 'base64'))
  }
}
ws.close(); chrome.kill(); process.exit(0)
