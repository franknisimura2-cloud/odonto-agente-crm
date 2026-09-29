# Instalação — do zero até a Letícia atendendo

Este é o **caminho completo**. O [`README.md`](README.md) conta o que o sistema
faz; este arquivo conta como colocá-lo no ar.

> ### 📌 Só existe um passo a passo, e é este
>
> A instalação já esteve espalhada em três documentos, e eles discordavam entre
> si. Agora **este arquivo manda**: se algum outro texto do repositório
> descrever a instalação de outro jeito, o certo é o que está aqui.

> ### 👉 Como começar
>
> Abra o projeto na sua IDE com IA (Claude Code, Codex, Cursor) e diga:
>
> *"Quero instalar este sistema."*
>
> A IA lê o [`CLAUDE.md`](CLAUDE.md), vê que é uma instalação nova e conduz
> daqui, uma parte de cada vez. Este arquivo é o roteiro que ela segue — e o
> que você lê para saber o que vem pela frente.

---

## Como este guia é organizado

Instalar não é uma coisa só — são duas, e elas se alternam. Umas só você pode
fazer, porque passam pela sua conta ou pelo seu celular; o resto a **IA da sua
IDE** faz sozinha.

Cada parte abaixo diz de quem é a vez:

| | Parte | O que acontece | Tempo |
|:-:|---|---|---|
| 👤 | **1. As contas** | Você cria as contas e copia 6 valores | ~20 min |
| 👤🤖 | **2. Os arquivos** | A IA cria 3 arquivos, você cola os valores, ela confere | ~5 min |
| 🤖 | **3. A IDE trabalha** | O banco, as funções, o seu acesso e o link do sistema | ~10 min |
| 👤 | **4. Entrar e conectar** | Pela tela: trocar a senha e conectar o WhatsApp | ~10 min |
| 👤 | **5. A cara da sua empresa** | Dentro do sistema: a empresa, os horários, os serviços | ~30 min |
| 👤 | **6. Conferir e encerrar** | O teste final, e revogar o que sobrou | ~10 min |

**O que é opcional:** o WhatsApp (4.2 e 4.3) e a Vercel (4.4). Sem o WhatsApp,
o sistema de gestão — agenda, CRM, clientes, faturamento — funciona inteiro,
e a Letícia fica para depois. Sem a Vercel, ele roda na sua máquina.

> 🔒 **Você não cola chave nenhuma no chat.** Elas vão para arquivos na sua
> máquina, e a IA confere se estão certas sem precisar ver o valor (parte 2).
> Chave colada na conversa fica gravada no histórico — e uma delas, o token do
> Supabase, abre a sua conta inteira.

> ⚠️ **A parte 5 não é opcional, e é a que mais se esquece.** O banco nasce
> **sem nenhum serviço cadastrado e sem o nome da empresa** — e é dessa lista
> que a Letícia tira o que oferece. Instalar sem fazer a parte 5 deixa o
> sistema **funcionando e sem nada para oferecer**: ela não consegue marcar
> coisa nenhuma.

---

## Parte 0 — Antes de começar

### O que precisa estar na máquina

- **Node.js 20.19+ ou 22.12+** — confira com `node -v`. É a exigência do Vite 8;
  um Node 20.0–20.18, ou qualquer 21, falha no `npm install`
- **Git**
- Uma **IDE com IA** — Claude Code, Codex, Cursor. É ela quem monta o banco

### O repositório é privado

`git clone` sozinho **não funciona**: o GitHub pede credencial e falha.

1. **Peça acesso ao autor**, informando o seu usuário do GitHub
2. **Autentique o clone.** Gere um **Personal Access Token do GitHub** com
   permissão de leitura e entregue à sua IA — `git clone` interativo abre um
   diálogo que ela não consegue responder. Fazendo à mão, `gh auth login` ou
   uma chave SSH resolvem igual

```bash
git clone https://github.com/afonsopereiralopes/agente-crm-generico.git
cd agente-crm-generico
npm install
```

> ⚠️ **Esse token do GitHub é descartável.** Terminado o clone, revogue em
> **github.com → Settings → Developer settings → Tokens**. É o primeiro de
> dois tokens que morrem no fim desta instalação.

---

## Parte 1 — 👤 As contas

Nesta parte você não roda nenhum comando. Só cria contas e **copia seis
valores**, que vão para os arquivos da parte 2.

> **Dá para colar direto nos arquivos.** Peça à IA para criá-los antes (é o
> primeiro passo da parte 2) e cole cada valor assim que copiar. Juntar tudo
> num bloco de notas cria mais uma cópia das chaves, esquecida no computador.

### 1.1. Supabase — o banco e o servidor

Crie uma conta em [supabase.com](https://supabase.com) e depois
**New Project**.

- Escolha a região mais perto dos seus usuários — no Brasil,
  `South America (São Paulo)`
- **Guarde a senha do banco num gerenciador de senhas.** Ela aparece uma vez só
- Espere alguns minutos até o projeto ficar pronto

Depois, em **Settings → API Keys**, copie:

| # | Valor | Onde está | Parece com |
|:-:|---|---|---|
| 1️⃣ | **Project URL** | campo "Project URL" | `https://abcdefgh….supabase.co` |
| 2️⃣ | **A chave pública** | a `anon` / `public` — nos projetos novos, a **publishable** | `eyJhbGciOi…` (bem longa) ou `sb_publishable_…` |
| 3️⃣ | **Project ref** | as 20 letras dentro da Project URL | `abcdefghijklmnopqrst` |

> ⚠️ **Na mesma tela existe a chave secreta — `service_role`, ou `sb_secret_…`
> nos projetos novos. Não copie.** Ela ignora toda a segurança do banco, e o
> lugar dela não é nenhum arquivo deste projeto — o Supabase entrega ela
> sozinho para as funções que precisam. Se ela for parar no `.env` por engano,
> a conferência da parte 2 acusa.

### 1.2. O token da conta do Supabase

Este é diferente dos outros: é da **sua conta**, não do projeto — dá acesso a
todos os seus projetos, inclusive os que não têm nada a ver com este sistema.

Em [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
→ **Generate new token**.

| # | Valor | Parece com |
|:-:|---|---|
| 4️⃣ | **Personal Access Token** | `sbp_…` |

- **Dê um nome que você reconheça depois**: `instalacao-nucleo`. É por
  esse nome que você vai achá-lo para revogar, mesmo que já tenha apagado o
  arquivo
- Copie o valor agora — ele aparece uma vez só

> **Por que isto existe:** o comando `supabase login` abre o navegador e espera
> alguém colar um código. A IA da IDE não consegue fazer esse passo. Com o
> token num arquivo, ela aplica as migrações, publica as funções e cria o seu
> acesso sozinha — **é a única razão.** Na parte 6 ele é revogado.

### 1.3. A chave da OpenAI

| # | Valor | Onde | Parece com |
|:-:|---|---|---|
| 5️⃣ | **OPENAI_API_KEY** | [platform.openai.com](https://platform.openai.com) → API Keys | `sk-…` |

> ⚠️ **Ela é obrigatória mesmo se você escolher um modelo Claude na tela.** É a
> OpenAI que transcreve os áudios e descreve as fotos — e o cliente brasileiro
> manda áudio na primeira mensagem. Sem ela, a Letícia trava logo no começo.

A da Anthropic (`console.anthropic.com` → API Keys) é **opcional**: ela libera
os dois modelos Claude no seletor. Sem ela, eles aparecem desligados, com o
motivo escrito — e os seis GPT continuam disponíveis.

### 1.4. Uma ponte de WhatsApp — só uma

O WhatsApp não deixa um sistema conversar com ele diretamente. Precisa de um
intermediário, e o sistema aceita dois. **Escolha um:**

| | **Evolution API v2** | **uazapi v2** |
|---|---|---|
| Como é | Você instala num servidor seu | Serviço pronto, você só assina |
| Custo | ~R$ 40/mês do servidor | mensalidade do serviço |
| Dá mais trabalho? | Sim — é você quem sobe | Não |
| Tem teste grátis? | — | Sim: `https://free.uazapi.dev` |

**Se escolher Evolution**, copie três valores:

| # | Valor | O que é |
|:-:|---|---|
| 6️⃣ | `EVOLUTION_API_URL` | O endereço do seu servidor, **sem barra no fim** |
| | `EVOLUTION_API_KEY` | A chave de autenticação da sua instalação |
| | `EVOLUTION_INSTANCIA` | O nome que você deu à instância do número da empresa |

**Se escolher uazapi**, copie dois:

| # | Valor | O que é |
|:-:|---|---|
| 6️⃣ | `UAZAPI_API_URL` | `https://api.uazapi.com` (ou o seu host), **sem barra no fim** |
| | `UAZAPI_TOKEN` | O token **da instância** — o da sua conexão de WhatsApp |

> ⚠️ **Não é o token admin.** A uazapi também dá um token da conta, que cria e
> apaga instâncias. Este sistema **nunca cria instância** — ele conecta a que já
> existe, e o token da instância basta. Chave a mais nos secrets é risco de
> graça.

> **O número: um chip só para isso, nunca o principal da empresa.** As duas
> pontes são WhatsApp não oficial, e o WhatsApp pode bloquear o número. Ele é
> conectado pela tela, na parte 4.

### 1.5. Invente o segredo do webhook

Não é de site nenhum: **você inventa**. Uma frase longa e aleatória serve.

| # | Valor | Exemplo |
|:-:|---|---|
| | `WEBHOOK_SEGREDO` | `girafa-azul-42-parafuso-lento-domingo` |

> **Para que serve:** a função que recebe as mensagens fica num endereço
> público, e quem chama é a ponte de WhatsApp — que não tem login no Supabase.
> Então a tranca é este segredo, conferido dentro da própria função. Sem ele,
> qualquer pessoa que descubra o endereço faz a Letícia responder por sua conta,
> gastando a sua chave da OpenAI.

---

## Parte 2 — 👤🤖 Os três arquivos

**A IA cria os três arquivos e abre cada um na IDE; você cola cada valor
depois do `=` e salva.** Nenhum comando da sua parte, e nenhuma chave no chat.

O que ela roda para criar, a partir dos moldes:

```bash
cp .env.example                   .env
cp .supabase-token.example        .supabase-token.local
cp agente-ia/.env.agente.example  agente-ia/.env.agente.local
```

> **Por que eles não vêm prontos no clone:** os três estão no `.gitignore`, e é
> isso que impede a sua chave de subir junto num `push`. O que é versionado é
> o **molde** de cada um — e cada molde tem, dentro dele, o comentário
> explicando de onde vem cada valor.

### `.env` — a tela

```env
VITE_SUPABASE_URL=          ← 1️⃣ Project URL
VITE_SUPABASE_ANON_KEY=     ← 2️⃣ a chave pública
```

> ⚠️ **Nunca ponha outra chave aqui.** Este arquivo vira JavaScript entregue ao
> navegador: o que estiver nele é visível para qualquer visitante do site. A
> chave pública pode, porque é pública por natureza e o banco a limita. A da
> OpenAI **não** — ela vai no terceiro arquivo.

### `.supabase-token.local` — a instalação

```env
SUPABASE_ACCESS_TOKEN=      ← 4️⃣ o sbp_…
SUPABASE_PROJECT_REF=       ← 3️⃣ as 20 letras
```

⛔ **Este arquivo nasce para morrer.** Ele existe só durante a instalação, e é
apagado na parte 6.

### `agente-ia/.env.agente.local` — a Letícia

São nove linhas, **e você não preenche todas**:

```env
OPENAI_API_KEY=             ← 5️⃣  obrigatória
ANTHROPIC_API_KEY=              opcional (libera os Claude)
WEBHOOK_SEGREDO=            ← o que você inventou

# --- preencha o bloco de UMA ponte, e deixe o outro em branco ---
EVOLUTION_API_URL=          ← 6️⃣ se escolheu Evolution
EVOLUTION_API_KEY=
EVOLUTION_INSTANCIA=

UAZAPI_API_URL=             ← 6️⃣ se escolheu uazapi
UAZAPI_TOKEN=
UAZAPI_ADMIN_TOKEN=             deixe vazio
```

> **Este arquivo fica parado, e é de propósito.** Na parte 3 as chaves **sobem**
> para os secrets do Supabase, e é de lá que a função lê. O arquivo continua
> aqui porque os secrets do Supabase **não podem ser lidos de volta** — ele
> vira o seu único registro do que foi configurado. Guarde.

### A conferência

Com os três salvos, a IA roda:

```bash
npm run instalar:conferir
```

Ele confere cada linha — o formato, e se o dono de cada chave aceita ela: o
Supabase, a OpenAI, a sua ponte de WhatsApp. **Nenhum valor aparece**, só se
ele está certo:

```
  .env
    ✔ VITE_SUPABASE_URL       o projeto abcdefghijklmnopqrst
    ✔ VITE_SUPABASE_ANON_KEY  a chave pública, e o Supabase aceitou

  agente-ia/.env.agente.local
    ✖ OPENAI_API_KEY          a OpenAI recusou esta chave. Copie de novo, inteira
```

| Sinal | Quer dizer |
|:-:|---|
| ✔ | Certo |
| ✖ | Precisa arrumar antes da parte 3 |
| ! | Aviso: não impede, mas leia |
| · | Informação |

> **O erro mais caro que ele pega é a chave secreta no `.env`.** Aquele
> arquivo vira JavaScript no navegador de qualquer visitante do site. A
> conferência chama isso de **PERIGO**, e não deixa passar.

**Siga para a parte 3 só quando não houver nenhum ✖.**

---

## Parte 3 — 🤖 A vez da IDE

Se a IA já está conduzindo, ela segue daqui sozinha, e só volta a você para
perguntar o **e-mail e o nome de quem vai entrar no sistema**. Se você abriu
uma conversa nova com ela, **cole esta frase**, trocando o e-mail e o nome:

```
Instale este sistema seguindo o INSTALACAO.md.

Os três arquivos de chave já estão preenchidos, e o
`npm run instalar:conferir` não acusa nenhum ✖. Faça a parte 3:

1. Leia o CLAUDE.md e o DATABASE.md antes de tocar no banco.
2. Aplique TODAS as migrações de supabase/migrations/, na ordem
   numérica, usando o SUPABASE_ACCESS_TOKEN e o SUPABASE_PROJECT_REF
   que estão em .supabase-token.local.
3. Confira o resultado com as consultas da seção 10 do DATABASE.md
   e me mostre os números.
4. Rode `npm run agente:secrets` para subir as chaves.
5. Publique as duas Edge Functions:
   `npm run agente:deploy` e `npm run agente:deploy-agenda`.
6. Rode `npm run build` para confirmar que a tela compila.
7. Crie o meu acesso:
   `npm run instalar:usuario -- dona@empresa.com.br --nome "Maria Souza"`
8. Deixe o sistema rodando com `npm run dev` e me passe o link.

No fim, me diga o que deu certo e o que ainda falta eu fazer.
```

### O que ela vai fazer, para você conferir

| Passo | O que é | Como saber que deu certo |
|---|---|---|
| **As 38 migrações** | Criam tabelas, índices, regras de segurança e as funções da agenda. O catálogo de serviços nasce **vazio** | 18 tabelas + 5 views, e os números da seção 10 do DATABASE.md (o único lugar onde eles são escritos) — as views voltam **vazias** na consulta de segurança, e a de funções traz **só** as quatro dos valores pagos (qualquer outra linha é dado da empresa ao alcance de quem não devia) |
| **Os secrets** | Sobem as chaves do arquivo para o servidor | `npm run agente:secrets` termina sem erro |
| **As duas funções** | `whatsapp` (a Letícia) e `agenda` (a API) | Publicadas no painel do Supabase |
| **O seu acesso** | Liga a regra de senha forte e cria o seu usuário, já confirmado, com uma **senha provisória** | Ela te mostra o e-mail e a senha provisória |
| **O sistema na sua máquina** | `npm run dev` | Ela te passa o link: **`http://localhost:5173`** |

> **A senha provisória fica escrita na conversa com a IA** — por isso ela é
> provisória. Você troca no primeiro acesso (4.1), e a nova fica só com você.

> **O follow-up automático não entra aqui, e é de propósito.** As migrações
> criam a máquina dele, e ela fica **parada** até alguém rodar
> `npm run followup:ligar`. É o único pedaço do sistema que faz a atendente
> escrever para alguém sem ter sido chamada, e ligar isso é decisão da empresa,
> não passo de instalação — como desligar o modo teste. Quando quiser, o
> caminho está na seção 8.6 do [`agente-ia/README.md`](agente-ia/README.md).

> **Por que a regra de senha:** um projeto novo do Supabase aceita senha de
> **seis** caracteres, sem exigência nenhuma, por mais que a tela de
> Configurações mostre uma lista de requisitos. O `instalar:usuario` liga a
> mesma regra que a tela explica — 10 caracteres, com minúscula, maiúscula,
> número e símbolo — antes de criar o usuário. Sem ela, a pessoa preencheria
> todos os itens verdes e o servidor aceitaria qualquer coisa.

> **O link só funciona enquanto o sistema estiver rodando.** Fechou a IDE ou o
> terminal, ele sai do ar — peça à IA para rodar `npm run dev` de novo. Para
> ficar no ar sempre, e com um endereço de internet, é a Vercel (4.4).

> ⚠️ **As duas funções vão com `--no-verify-jwt`, e isso não é descuido.**
> Quem chama a `whatsapp` é a ponte de WhatsApp, e quem chama a `agenda` é uma
> integração externa — nenhuma das duas tem login do Supabase. A autenticação
> delas é própria (o segredo do webhook e o token da API), conferida dentro do
> código. Publicar no padrão derruba as duas com um erro `401` que **nem chega**
> no nosso código, e o sintoma não aponta para a causa.

> **Se a IA travar nas migrações**, dá para fazer à mão: no painel do Supabase,
> **SQL Editor → New query**, e cole o conteúdo de cada arquivo de
> `supabase/migrations/` na ordem, do `0001` até o último, clicando em **Run**
> a cada um. A ordem importa — cada um depende do anterior.

> **Se o `instalar:usuario` falhar**, dá para fazer pelo painel do Supabase:
>
> - **O usuário:** Authentication → Users → Add user. ⚠️ **Marque
>   `Auto Confirm User`** — sem isso o Supabase exige confirmação por e-mail, e
>   o login responde "e-mail ou senha incorretos", que manda procurar o
>   problema no lugar errado. O perfil na tabela `usuarios` nasce sozinho, por
>   um gatilho do banco: não crie essa linha à mão.
> - **A regra de senha:** Authentication → Sign In / Providers → Password.
>   Minimum password length `10`; Password Requirements "Lowercase, uppercase
>   letters, digits and symbols". E, se o seu plano permitir, **Prevent use of
>   leaked passwords** — é o único item que barra `Senha@2026`, que atende a
>   todos os requisitos e está em qualquer lista de senhas vazadas.

---

## Parte 4 — 👤 Entrar e conectar o WhatsApp

Agora é **pela tela**, no link que a IA te passou — sem comando nenhum. O
único painel de outra empresa é o da Vercel (4.4), e ele é opcional.

### 4.1. Entre, e troque a senha

Entre com o e-mail e a **senha provisória** da parte 3, e troque em
**Configurações → Perfil → Alterar Senha**. A lista ao lado do campo diz o que
a senha nova precisa ter.

> **Mais gente na equipe?** Cada pessoa tem o seu login. Enquanto o token da
> instalação existir, peça à IA: `npm run instalar:usuario -- email-da-pessoa`.
> Depois da parte 6, é pelo painel do Supabase — o caminho do fim da parte 3,
> com o `Auto Confirm User`.

### 4.2. Conecte o número do WhatsApp

**Só se for usar a Letícia.** No rodapé da barra lateral, clique no seu nome
→ **Atendente de IA** → card **Conexão do WhatsApp**:

1. **Confira o Provedor.** Tem que ser a ponte que você escolheu em 1.4 — e o
   sistema nasce na **Evolution**. Usa uazapi? Troque na lista: grava na hora.
2. **Clique em Conectar**, digite o número do chip e clique em **Gerar**. Sai
   um **código de 8 dígitos**.
3. **No celular:** WhatsApp → Aparelhos conectados → Conectar um aparelho →
   Conectar com número de telefone → digite o código. (Sem o número, a tela
   mostra um QR para escanear.)

Em alguns segundos o card fica verde: **Conectado**.

> **Conectar não liga a Letícia.** Ela nasce desligada, e em modo teste com a
> lista vazia. Daqui em diante as mensagens aparecem em Conversas, e ninguém
> recebe resposta automática até você ligá-la, na parte 6.

### 4.3. Aponte para cá — o passo que ninguém adivinha

Conectar resolve metade: agora o sistema fala com o WhatsApp. A outra metade é
a ponte **avisar o sistema** quando chega mensagem — e ela não descobre o
endereço sozinha.

Logo abaixo do card verde vai aparecer um aviso âmbar: *"Conectado, mas nada
chega aqui"*. **Clique em Apontar para cá.** O aviso some quando a ponte
confirma o endereço novo.

> ⚠️ **É o passo mais fácil de esquecer, e o sintoma é o pior de todos:**
> WhatsApp pareado, o card **verde escrito "Conectado"**, e silêncio absoluto.
> Aconteceu de verdade na estreia da uazapi — e é por isso que o aviso existe.

- **Se o aviso diz "outro endereço"**, o botão pergunta antes de apontar:
  aquele endereço pode ser de outro sistema que ainda usa as mensagens desta
  instância (uma automação, um chatbot antigo), e ele para de receber.
- **Um dia trocou de ponte no seletor?** O aviso volta, e o mesmo botão
  resolve.
- **Sem aviso nenhum e card verde** é o normal: já está apontado.

> **O segredo do webhook não passa pela tela.** O botão pede ao servidor, e o
> servidor manda o segredo direto para a ponte — no cabeçalho, na Evolution;
> na URL, na uazapi, que não aceita cabeçalho próprio. Quem precisar fazer à
> mão encontra os dois pedidos na seção 10.5 do
> [`agente-ia/README.md`](agente-ia/README.md).

### 4.4. As variáveis na Vercel

**Só faça este quando for colocar o site no ar.** Para usar na própria máquina,
o `npm run dev` basta.

A Vercel detecta tudo sozinha (Vite → `npm run build` → `dist`). Uma coisa só
precisa ser feita à mão, em **Settings → Environment Variables**, para todos os
ambientes:

```
VITE_SUPABASE_URL=https://SEU_REF.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

> ⚠️ **Sem elas o build NÃO falha.** O Vite embute `undefined`, o site sobe, e a
> tela fica em branco no primeiro acesso ao banco. Nada no terminal aponta para
> a causa.

> ⚠️ **Variável do Vite entra no bundle na hora do build.** Mudou uma variável?
> **Reimplante** — só salvar no painel não muda o site que já está no ar.

O `vercel.json` já está no repositório e não precisa de nada. Ele existe por um
motivo: sem o rewrite que ele traz, entrar direto em `/agenda` ou dar F5 dentro
da ficha de um contato devolve **404 da Vercel**. Navegar pelo menu continuaria
funcionando — então o defeito só apareceria quando alguém compartilhasse um
link, ou seja, na frente de outra pessoa.

---

## Parte 5 — 👤 A cara da sua empresa

Agora, dentro do sistema, você faz dele **o da sua empresa**. Quase tudo aqui
é pela tela: nenhum comando, nenhum SQL, nenhuma linha de código. A exceção é a
adaptação ao seu ramo (5.3), que a IA da sua IDE conduz com perguntas.

> ### ⚠️ Faça esta parte inteira ANTES de ligar a Letícia
>
> Ela não inventa nada — ela **lê** o que está aqui. O endereço que ela informa,
> o horário que ela anuncia, os serviços que ela oferece e o preço que ela
> fala saem todos destas telas.
>
> Com a parte 5 pela metade, ela atende sem o nome e sem o endereço da sua
> empresa, anunciando um horário de exemplo, e o cliente não tem como saber.

A ordem abaixo importa: cada passo aparece nos seguintes.

### 5.1. Configurações → Empresa

**menu lateral → Configurações → aba Empresa.**

| Campo | Vira o quê |
|---|---|
| **Nome da empresa** | O nome na barra lateral, e o que a Letícia diz |
| **Endereço**, **bairro**, **cidade/UF**, **CEP** | A resposta de *"onde vocês ficam?"* |
| **Link do Google Maps** | O que ela manda para quem pede como chegar |
| **Instagram** e **site** | Ela cita quando fazem sentido |

**Abaixo dos campos, o card "O que o Agente de IA lê" mostra a prévia do que a
Letícia vai falar.** Não é ilustração — é uma consulta de verdade ao que ela lê. Se a prévia estiver
estranha, o cliente vai ouvir estranho.

> **Campo vazio não vira frase.** Deixar o Instagram em branco faz a linha
> sumir, o que é o certo. Preenchido pela metade é que dá problema.

No fim dessa aba fica a **cor do sistema**: escolha uma das sete (clicar já
mostra o sistema na cor; **Salvar** grava para a equipe toda). A tela de login
abre na cor padrão na primeira vez em cada computador, e passa a abrir na cor
escolhida depois do primeiro acesso.

A **logo** fica na aba **Perfil**, e aparece na barra lateral.

### 5.2. Configurações → Horários

**A grade de atendimento, e o fuso horário.**

O fuso vem no card **acima** da grade, e não é detalhe: ele decide em que hora
um agendamento cai. A conferência é uma só — **o campo tem que bater com o
relógio do computador da recepção.**

> ⚠️ **Se discordarem, a Letícia e a recepção discordam exatamente naquelas
> horas.** Com jornada das 8h às 18h, um deslocamento para trás joga a manhã
> inteira para fora do expediente, e ela responde *"não tenho horário"* para
> horário livre.

> ⚠️ **Esta grade é o que a empresa ANUNCIA, não o que a agenda oferece.** Quem
> manda na disponibilidade é a jornada de cada profissional (5.4). Anunciar até
> as 18:00 sem nenhum profissional depois das 17:00 faz a Letícia prometer
> horário que a própria agenda recusa em seguida.

### 5.3. Serviços — **o passo que muda tudo**

**menu lateral → Serviços.**

> ### 🔴 A lista começa vazia
>
> A instalação não traz serviço nenhum: cada negócio tem os seus. **A Letícia
> só oferece o que está nesta lista** — e desde a migração `0022` ela é um
> **vocabulário fechado**: é o único conjunto de nomes que o sistema consegue
> gravar e agendar.
>
> Um serviço que não está cadastrado aqui **não pode ser marcado por
> ninguém** — nem pela Letícia, nem pela API.
>
> ### 👉 Antes de cadastrar à mão: adapte ao seu ramo
>
> Peça à IA da sua IDE, conforme o seu negócio:
>
> | É… | Cole |
> |---|---|
> | **Clínica** — odontológica ou de outra especialidade | *"Leia o ADAPTAR-CLINICAS.md e adapte o sistema para a minha clínica. Me faça as perguntas uma de cada vez."* |
> | **Qualquer outro ramo** | *"Leia o ADAPTAR-OUTROS-NICHOS.md e adapte o sistema para o meu negócio. Me faça as perguntas uma de cada vez."* |
>
> Ela pergunta sobre o seu negócio, cadastra os serviços e ajusta a atendente
> às regras do seu ramo. Clínica odontológica tem **kit pronto**: 20
> tratamentos, a avaliação como porta de entrada e a Letícia de clínica, com as
> regras de saúde.
>
> **Faça antes da parte 6:** publicar a atendente precisa do token do
> Supabase, que a parte 6 revoga. Sem a adaptação, ela atende com o prompt
> genérico, que serve a qualquer ramo — e os serviços você cadastra aqui, à
> mão.

O que fazer, em ordem:

1. **Cadastre o que você oferece**, no botão **Novo Serviço** — ou, se a IA já
   cadastrou na adaptação, confira o que ela pôs. Usou o kit? Então **desligue
   o que a sua clínica não faz** — o liga/desliga fica no próprio card, e o
   serviço some da boca da Letícia na mensagem seguinte.
2. **Revise as descrições**, no botão Editar de cada card. A curta é o que ela
   fala no catálogo; a longa é o que ela responde a *"como funciona?"*.
3. **Confira os preços e as durações.** O preço só é falado quando o
   serviço **não** passa pela porta de entrada — a caixa está no mesmo modal.

> ⚠️ **Os textos longos do kit são rascunho.** Foram escritos para outra
> clínica e **precisam da revisão de um dentista** antes de irem para a boca de
> um paciente.

#### A porta de entrada é opcional

No topo da página, fora da grade de cards, fica a **porta de entrada**: o
atendimento que vem antes dos outros serviços — uma avaliação, um orçamento,
uma consulta inicial. Com ela, quem pede um serviço marcado com **"Passa pela
porta de entrada"** sai com a porta agendada, e o que queria fica anotado
junto.

| O seu negócio… | Faça |
|---|---|
| **começa sempre por um primeiro atendimento** | Cadastre esse serviço, escolha-o no bloco do topo e clique em **Usar como porta de entrada**. Depois, em Editar, ligue a caixa nos serviços que passam por ela |
| **agenda cada serviço direto** | Nada. Sem porta, a Letícia marca tudo direto |

#### Usou o kit de clínica? A avaliação vem sem custo

No kit, a porta de entrada é a Avaliação Odontológica, e **ela vem com o valor
`0` — zero faz a Letícia dizer ao seu paciente, na primeira conversa, que a
avaliação não tem custo.** Se na sua clínica ela é paga ou combinada caso a
caso, mude o valor: o [`ADAPTAR-CLINICAS.md`](ADAPTAR-CLINICAS.md) (A.1) diz o
que preencher em cada caso.

#### ⚠️ Desative, não exclua — depois que o sistema estiver em uso

Enquanto o banco está vazio (agora), **excluir é seguro**.

Depois que a Letícia atender alguém, não é mais: o nome do serviço fica
gravado na ficha de quem se interessou por ele, e o banco recusa salvar uma
ficha que aponte para um serviço que saiu do catálogo. O sintoma é cruel —
*"algum serviço escolhido não está mais no catálogo"* **sem nenhuma caixa
marcada na tela para desmarcar**, e a ficha para de aceitar até correção de
nome e de WhatsApp.

> **Se acontecer, dá para sair sem SQL:** recrie o serviço com o **mesmo
> nome**, abra a ficha, desmarque, salve — e só então apague.

**Desativar não tem esse problema**, e é reversível com um clique. É para isso
que o botão existe.

### 5.4. Profissionais

**menu lateral → Profissionais.** Cadastre os profissionais de verdade.

- **Não existe tela de "criar agenda".** Cadastrar o profissional já cria a
  agenda dele — e a cor escolhida aqui é a cor dos blocos no calendário.
- **A jornada de cada um é o que manda na disponibilidade.** É ela, e não a
  grade de 5.2, que decide o horário que a Letícia oferece.
- **"Serviços que faz" é opcional.** Deixe tudo desmarcado para quem faz
  todos os serviços. Marque só para quem é especialista — a Ana que só faz
  coloração, o João que só corta e faz barba —, e a Letícia passa a oferecer
  cada serviço só na agenda de quem o faz.

### 5.5. Configurações → Perfil

Seu nome e sua foto, que aparecem no rodapé da barra lateral.

---

## Parte 6 — 👤 Conferir e encerrar

### O teste de aceite

| # | Faça | Esperado |
|:-:|---|---|
| 1 | Entrar com o seu usuário, já com a senha trocada (4.1) | Cai no Dashboard |
| 2 | Abrir `/agenda` **digitando na barra de endereço** | Abre (é o teste do rewrite) |
| 3 | Dar F5 dentro da ficha de um contato | Continua na ficha |
| 4 | **menu → Token e API**, criar o primeiro token | Os cURLs mostram a **sua** URL, não `undefined` |
| 5 | **menu → Atendente de IA** | Conexão "Conectado", e nenhum aviso âmbar embaixo |

**E o teste da parte 5 — o que diz se o sistema é o da SUA empresa:**

| # | Faça | Esperado |
|:-:|---|---|
| 6 | **Configurações → Empresa**, olhe a prévia abaixo dos campos | As frases falam da sua empresa, não de outra |
| 7 | **Serviços** | Os seus serviços estão lá, e só eles estão ligados |
| 8 | Tem porta de entrada? Abra ela | O valor é o seu (`0` = ela dirá que não tem custo) |
| 9 | **Agenda** | A grade da semana bate com a jornada dos seus profissionais |

**Se você vai usar a Letícia**, faça também o teste de fogo:

1. Na página **Atendente de IA**, confira que o **modo teste** está ligado,
   cadastre o **seu** número e ligue a atendente no interruptor do fim da
   página
2. Mande uma mensagem para o WhatsApp da empresa, do seu celular
3. Ela responde em alguns segundos
4. Abra `/conversas` e leia a conversa do lado da equipe

> ⚠️ **Deixe o modo teste ligado até confiar nela.** Com ele ligado, ela
> responde **só** aos números cadastrados; qualquer outra pessoa que escrever
> fica sem resposta automática, e a equipe atende pela tela Conversas.
> Desligar o modo teste é o ato que a coloca na frente do público — não é um
> passo de instalação, é uma decisão da empresa.

### Encerrar: revogue o que sobrou

Dois tokens desta instalação não servem para mais nada. **Some com os dois:**

**1. O do Supabase — nesta ordem:**

```bash
# 1º  https://supabase.com/dashboard/account/tokens  →  Revoke
# 2º
rm .supabase-token.local
```

> **A ordem importa.** Apagar primeiro não revoga nada: o token continua vivo na
> sua conta, e você acabou de jogar fora a cópia que dizia qual era. (É por isso
> que o passo 1.2 mandou dar um nome reconhecível — é o que te salva se isso
> acontecer.)

**2. O do GitHub**, usado no clone: **github.com → Settings → Developer settings
→ Tokens → Revoke**.

Precisou publicar de novo depois? **Gere outro.** Leva quinze segundos, e é bem
mais barato que manter um token de acesso total vivo por seis meses dentro de um
arquivo esquecido.

> Ao gerar outro token do Supabase, refaça o `.supabase-token.local` com as
> **duas** linhas — o `SUPABASE_PROJECT_REF` não é credencial e não dá acesso a
> nada sozinho, mas o `npm run agente:deploy` precisa dele.

---

## Deu errado?

<details>
<summary><strong>A tela fica em branco ao abrir</strong></summary>

Falta o `.env` ou os valores estão errados — `npm run instalar:conferir` diz
qual dos dois. E **reinicie o `npm run dev`** depois de editar: ele lê o
arquivo só ao subir.
</details>

<details>
<summary><strong>"E-mail ou senha incorretos", mas a senha está certa</strong></summary>

O usuário foi criado pelo painel sem o `Auto Confirm User` (quem nasce pelo
`instalar:usuario` já vem confirmado). No painel, em **Authentication →
Users**, veja se a coluna de confirmação está preenchida.
</details>

<details>
<summary><strong>As telas abrem vazias, mesmo com dados no banco</strong></summary>

Alguma migração não rodou, e as regras de acesso não existem. Confira a
contagem com as consultas da [seção 10 do `DATABASE.md`](DATABASE.md) — é lá
que mora o número esperado.
</details>

<details>
<summary><strong>`npm run agente:deploy` responde 401 Unauthorized</strong></summary>

É o token, não o código. Confira se `.supabase-token.local` existe e se as duas
linhas estão preenchidas — `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF`.
Se o token já foi revogado (parte 6), gere outro.
</details>

<details>
<summary><strong>O WhatsApp diz "Conectado", mas a Letícia não responde ninguém</strong></summary>

**Quase sempre é o webhook (passo 4.3).** Atender depende de três coisas ao
mesmo tempo, e a tela mostra as três:

1. O agente **ligado** — Atendente de IA
2. O WhatsApp **conectado** — o card de conexão
3. O webhook **apontado para a nossa função** — sem o aviso âmbar logo abaixo
   do card. Com o aviso, é o botão **Apontar para cá**

Se as três estiverem certas, o suspeito seguinte é o **modo teste**: com ele
ligado, ela só responde os números cadastrados.

E confira o `WEBHOOK_SEGREDO`. **Vazio**, a função recusa **todo** webhook com
401, e o sintoma é exatamente este — o `instalar:conferir` acusa, e o botão
Apontar para cá também. **Trocado depois de apontar**, a ponte continua
mandando o antigo, e a tela não tem como perceber: ela compara o endereço, e
o segredo não sai do servidor. Peça à IA para apontar de novo com os pedidos
da seção 10.5 do [`agente-ia/README.md`](agente-ia/README.md).
</details>

<details>
<summary><strong>Ela responde texto, mas some quando mando áudio ou foto</strong></summary>

Falta a `OPENAI_API_KEY`, ou ela não tem saldo. É a OpenAI que transcreve o
áudio e descreve a foto — **mesmo com um modelo Claude escolhido na tela.**
</details>

<details>
<summary><strong>"Esse horário acabou de ser ocupado" ao agendar</strong></summary>

Não é erro: o banco recusou dois agendamentos se sobrepondo na mesma agenda.
Escolha outro horário ou outro profissional. Repetir a mesma tentativa dá
sempre o mesmo resultado.
</details>

---

## Depois de instalar

| Para | Leia |
|---|---|
| Entender o que cada tela faz | [`README.md`](README.md) |
| Mexer no código | [`CLAUDE.md`](CLAUDE.md) |
| Mexer no banco | [`DATABASE.md`](DATABASE.md) |
| Entender a Letícia por dentro | [`agente-ia/README.md`](agente-ia/README.md) |
| **Adaptar o sistema ao seu ramo** | [`ADAPTAR-CLINICAS.md`](ADAPTAR-CLINICAS.md) · [`ADAPTAR-OUTROS-NICHOS.md`](ADAPTAR-OUTROS-NICHOS.md) |
| Mexer no prompt da atendente | [`agente-ia/GUIA-DO-PROMPT.md`](agente-ia/GUIA-DO-PROMPT.md) |
| Integrar outro sistema à agenda | [`API_AGENTE.md`](API_AGENTE.md) |

> **Não pulou a [parte 5](#parte-5--a-cara-da-sua-empresa), pulou?** É a que
> transforma "o sistema instalou" em "o sistema é da minha empresa". Um sistema
> no ar sem os seus serviços funciona perfeitamente — e não consegue marcar
> nada para o seu cliente, sem nada na tela indicando isso.
