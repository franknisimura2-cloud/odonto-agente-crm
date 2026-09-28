// Serve o dist como a Vercel: arquivo que existe sai; /clinicas/ que não existe é 404; o resto cai no index.html.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
const raiz = process.argv[2], porta = +process.argv[3]
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }
createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  try {
    const dados = await readFile(join(raiz, caminho))
    res.writeHead(200, { 'content-type': tipos[extname(caminho)] ?? 'application/octet-stream' }); res.end(dados)
  } catch {
    if (caminho.startsWith('/clinicas/')) { res.writeHead(404); res.end('404'); return }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(await readFile(join(raiz, 'index.html')))
  }
}).listen(porta)
