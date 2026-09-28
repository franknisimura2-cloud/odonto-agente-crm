// Onde está o Chrome (ou o Edge) desta máquina. `CHROME=/caminho` na frente do
// comando manda sobre a busca.
import { existsSync } from 'node:fs'

const CANDIDATOS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]

export function caminhoDoChrome() {
  const achado = [process.env.CHROME, ...CANDIDATOS].find((c) => c && existsSync(c))
  if (!achado) {
    console.error('\n  ✖  Não achei o Chrome. Rode com CHROME=/caminho/do/chrome na frente do comando.\n')
    process.exit(1)
  }
  return achado
}
