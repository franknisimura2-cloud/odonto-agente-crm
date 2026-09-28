# Testar a tela sem celular e sem banco

Ferramentas para ver o sistema como um celular de verdade (390px), com dados
de exemplo no lugar do Supabase — do jeito que as etapas do celular e a fase
de várias clínicas foram conferidas. Nada aqui toca o banco de ninguém.

| Arquivo | O que faz |
|---|---|
| `celular.mjs` | Abre uma URL no Chrome sem tela, na largura pedida, e salva um print. Mede se algo vaza para os lados |
| `mock.mjs` | As respostas falsas do Supabase (conversas, agenda, funil, Dashboard) |
| `servidor.mjs` | Serve o `dist/` como a Vercel: `/clinicas/` que não existe é 404, o resto cai no `index.html` |
| `semear.html` | Cria uma sessão falsa no navegador, para passar do login |
| `instalavel.mjs` | Pergunta ao Chrome se o site é instalável como aplicativo, e qual manifesto ele leu |
| `chrome.mjs` | Acha o Chrome ou o Edge da máquina (ou use `CHROME=/caminho`) |

## Como rodar

```bash
npm run build
cp scripts/teste/semear.html dist/
node scripts/teste/servidor.mjs dist 4180          # deixe rodando num terminal

# noutro terminal — <ref> é o projeto do .env (as 20 letras da URL do Supabase)
node scripts/teste/celular.mjs "http://127.0.0.1:4180/semear.html?ref=<ref>&ir=/agenda" agenda.png
node scripts/teste/celular.mjs "http://127.0.0.1:4180/login" login-pc.png 1280 800
```

Argumentos do `celular.mjs`: `<url> <saida.png> [largura=390] [altura=844] [javascript]`.
O último roda na página antes do print — é como se clica em algo:

```bash
node scripts/teste/celular.mjs "<url>" gaveta.png 390 844 'document.querySelector("[aria-label=\"Abrir o menu\"]").click()'
```

## Testar várias clínicas (endereços diferentes)

O `celular.mjs` faz o Chrome achar `*.nucleo.test` em `127.0.0.1`. Ponha fichas
de teste em `dist/clinicas/` (nunca em `public/`):

```bash
mkdir -p dist/clinicas
# dist/clinicas/ativa.nucleo.test.json → { "nome": "…", "supabaseUrl": "…", "anonKey": "…", "situacao": "ativa" }
node scripts/teste/celular.mjs "http://ativa.nucleo.test:4180/login" ativa.png
node scripts/teste/celular.mjs "http://outra.nucleo.test:4180/" desconhecida.png
```

⚠️ O `npm run build` apaga o `dist/`: copie o `semear.html` e as fichas de
teste de novo depois de cada build.

## Limites

- O Chrome sem tela não abre janela com menos de 500px — é por isso que o
  script emula o aparelho em vez de só mudar o tamanho da janela.
- Teclado de celular, envio real de WhatsApp e instalação no aparelho não se
  testam aqui: só num celular de verdade.
