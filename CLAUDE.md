# CLAUDE.md

Orientações para agentes trabalhando neste repositório — qualquer IA, não só o
Claude. O [`AGENTS.md`](AGENTS.md), que é o arquivo que o Codex e o Cursor
procuram, aponta para cá: as regras moram só aqui.

---

## ⚠️ PRIMEIRO: isto é uma instalação nova?

**Confira antes de qualquer outra coisa.** Se **não existe um arquivo `.env` na
raiz**, ou se ele existe e está vazio, então esta é uma **instalação nova** — e
a pessoa que está falando com você quer **colocar o sistema no ar para a
empresa dela**, não mexer no código.

Nesse caso:

1. **Leia o [`INSTALACAO.md`](INSTALACAO.md) inteiro** antes de propor
   qualquer passo. Ele é o dono da instalação, e nenhum outro documento deste
   repositório descreve o caminho completo.
2. **Conduza a pessoa pelas seis partes, na ordem.** Ela pode não ser
   programadora — explique em português simples, sem jargão, e faça uma coisa
   de cada vez.
3. **Respeite a divisão de quem age.** É dela o que passa pela conta ou pelo
   celular dela: criar as contas e copiar as chaves (parte 1), colar as chaves
   nos arquivos (2), entrar, conectar o número e clicar em **Apontar para cá**
   pela tela (4), a empresa (5) e revogar o token no fim (6). O resto é seu:
   criar e abrir os três arquivos a partir dos moldes e conferir com
   `npm run instalar:conferir` (2); e a parte 3 inteira — **todas** as
   migrações de `supabase/migrations/` (hoje, 37), as duas Edge Functions, o
   acesso dela com `npm run instalar:usuario` e o sistema rodando, com o link.
   Não tente fazer a parte dela, e não deixe a sua para ela.

   > 🔒 **Nunca peça chave pelo chat.** Ela cola no arquivo, e a conferência
   > diz se está certa sem mostrar o valor — chave colada na conversa fica no
   > histórico, e o token do Supabase abre a conta inteira dela. Se ela colar
   > mesmo assim, grave no arquivo e não repita o valor na resposta.
4. **Não pule a parte 5**, mesmo que o sistema já esteja funcionando. O banco
   nasce **sem nenhum serviço cadastrado** (migração `0025`), e desde a `0022`
   o catálogo é **vocabulário fechado**: sem cadastrar os serviços da empresa,
   o agente de IA não tem o que oferecer e não consegue marcar nada. A
   parte 5.3 manda adaptar ao ramo, e cada caminho tem um guia:
   [`ADAPTAR-CLINICAS.md`](ADAPTAR-CLINICAS.md) — com o kit de clínica
   odontológica pronto em [`kits/clinica-odontologica/`](kits/clinica-odontologica/):
   serviços, prompt e descritor de fotos — e
   [`ADAPTAR-OUTROS-NICHOS.md`](ADAPTAR-OUTROS-NICHOS.md), para qualquer
   outro ramo. Os dois são para você conduzir, com perguntas.
5. **O modo teste fica ligado.** Desligá-lo é decisão da empresa, não passo de
   instalação — é o ato que coloca o agente na frente do público.

Se o `.env` existe e está preenchido, o sistema já está instalado: siga com o
resto deste documento, que é sobre **desenvolver**.

---

## O que é este projeto

O **Núcleo** é um sistema de gestão para **negócios que atendem com hora
marcada**, acoplado a um **Agente de IA** que atende os clientes pelo WhatsApp.

O agente conversa, qualifica e agenda; este sistema é onde a equipe da empresa
acompanha tudo — funil de leads, agendamentos, faturamento e métricas de
desempenho do próprio agente.

> **Histórico que importa:** este código nasceu como sistema para uma clínica de
> **cirurgia plástica**, foi adaptado para odontologia e, dali, virou o Núcleo.
> O Git deste repositório começa num commit só, "Versao inicial do Nucleo"
> (11/09/2026): os commits da plástica, da odontologia e da própria adaptação
> ficaram fora daqui, e o que deles importa está contado nestes documentos.
> Os nomes de pessoas e endereços dos casos contados são fictícios. O schema
> já era de clínica em geral (`crm_clinica`,
> `servicos_clinica`), então a adaptação para odontologia foi mais de
> **conteúdo e identidade visual** do que de estrutura. É dessa origem que vêm
> os nomes internos de clínica — `consultas`, `crm_clinica`, a chave
> `paciente_recorrente`, `Procedimentos.tsx` —, e eles ficam: nome interno não
> muda, e na tela o vocabulário é o do Núcleo.

**Idioma:** todo o produto é em **português do Brasil** — interface, nomes de
colunas, identificadores de status e comentários. Mantenha assim.

**Distribuição:** o repositório é **privado**, e o acesso é liberado pelo autor
conta a conta — quem recebe pode instalar, rodar e modificar para a sua
empresa, não redistribuir. O endereço é
`https://github.com/afonsopereiralopes/agente-crm-generico`, e o clone exige
credencial: sem um token do GitHub ou `gh auth login`, o `git clone` falha.

> **A instalação tem um dono: [`INSTALACAO.md`](INSTALACAO.md).** Ela já esteve
> espalhada em três documentos, que discordavam — um dizia 24 migrações, o
> outro "os dois arquivos", e nenhum mencionava as chaves da Letícia. O
> `README.md`, o `DATABASE.md` e o `agente-ia/README.md` agora **apontam** para
> ele. Mexeu em algo que muda a instalação? **É lá que se atualiza**, e só
> lá.

---

## Comandos

```bash
npm install       # instalar dependências
npm run dev       # servidor de desenvolvimento (Vite)
npm run build     # tsc -b && vite build
npm run lint      # ESLint
npm run preview   # pré-visualizar o build
npm run nicho     # onde as palavras de nicho aparecem no texto (ver abaixo)
```

`npm run nicho` conta as palavras do nicho de origem (paciente, dentista,
consulta…) no texto que alguém **lê** — telas, frases do servidor e o prompt —,
fora de comentários e de nomes internos (tabela, rota, chave de status).
`npm run nicho -- cliente serviço --lista` procura outras palavras e mostra
cada linha. As opções estão no cabeçalho de [`scripts/nicho.mjs`](scripts/nicho.mjs).

Os dois da instalação, em [`scripts/instalar.mjs`](scripts/instalar.mjs):

```bash
npm run instalar:conferir                        # os 3 arquivos de chave: formato, e se cada serviço aceita
npm run instalar:usuario -- email --nome "Nome"  # liga a regra de senha e cria um usuário já confirmado
```

> **A conferência nunca mostra valor**, só se ele está certo — é o que deixa a
> instalação ser conduzida sem chave no chat. Cada chave é testada só no
> próprio dono (a da OpenAI na OpenAI, a da ponte no servidor da ponte). O
> `usuario` pede a chave secreta do projeto à Management API, usa uma vez em
> memória e não grava em lugar nenhum; ele depende do token de
> `.supabase-token.local`, então só funciona até a parte 6 da instalação.

E os três do follow-up, em [`scripts/followup.mjs`](scripts/followup.mjs) — a
fiação que a migração `0030` não pode fazer, porque depende do endereço e do
segredo desta instalação:

```bash
npm run followup:ligar      # guarda endereço e segredo no Vault e agenda o cron
npm run followup:desligar   # tira o cron da agenda; a fila e o histórico ficam
npm run followup:estado     # o job, as batidas da última hora e a fila de agora
```

Os **lembretes de agendamento** (`0037`) têm o mesmo par — o relógio é
`npm run lembretes:ligar` (`:desligar`, `:estado`; aceitam `-- --clinica
<nome>`). Ligar o relógio não manda nada: quem liga os lembretes é a chave da
tela Atendente de IA (`lembretes_ativo`, que nasce desligada). O texto é fixo,
em `supabase/functions/_shared/lembretes.ts`, junto com o reconhecimento do
"sim" que vira `consultas.confirmada_em` — ver a seção 4.21 do `DATABASE.md`.

E os do Agente de IA (ver [`agente-ia/README.md`](agente-ia/README.md)):

```bash
npm run prompt          # confere o contrato; agente-ia/prompt.md e descritor-de-fotos.md → _shared/prompt-oficial.ts
npm run agente:secrets       # sobe as chaves de agente-ia/.env.agente.local
npm run agente:deploy        # regera o prompt e publica a função whatsapp
npm run agente:deploy-agenda # publica a função agenda (a API externa)
```

> **Os dois últimos passam por [`agente-ia/publicar.mjs`](agente-ia/publicar.mjs)**,
> que lê o `SUPABASE_PROJECT_REF` e o `SUPABASE_ACCESS_TOKEN` de
> `.supabase-token.local` e chama o CLI. O ref já esteve escrito dentro do
> `package.json` — que é versionado: quem clonasse o repositório mandava
> publicar **no projeto de outra pessoa**, e o erro que voltava era de
> permissão, sem dizer a causa. Nada de projeto de ninguém fica em arquivo
> versionado.

> `agente:deploy` usa `--no-verify-jwt` de propósito: quem chama o webhook é a
> ponte de WhatsApp, que não tem sessão do Supabase. A autenticação é o
> `WEBHOOK_SEGREDO`, conferido dentro da função. Publicar no padrão derruba o
> webhook com um 401 que nem chega no nosso código — mesmo motivo da `agenda/`.

Não existe suíte de testes. Ao mexer em algo, valide com `npm run build`
(que roda o TypeScript) e `npm run lint`.

**O `tsc` do projeto não cobre `supabase/functions/`** (o `tsconfig.app.json`
inclui só `src`). Dá para conferir sem publicar, com o Deno:

```bash
npx --yes deno@2 check supabase/functions/whatsapp/index.ts
```

⚠️ **Ele acusa 5 erros que já existiam** — 4 em `llm.ts` e 1 em `db.ts`.
**Compare com o número, não com "limpo"**: rode antes de mexer, guarde a
contagem, e confira depois. Sem isso, o erro só aparece na hora de publicar.

> Eram **6** até a migração `0030`. O sexto era o `EdgeRuntime` do
> `whatsapp/index.ts`, que só existe no runtime do Supabase e era alcançado por
> um par de casts encadeados; ao extrair aquilo para a função `emSegundoPlano()`
> — que o follow-up também usa —, o cast virou um `optional chaining` tipado e o
> erro saiu junto. Ninguém foi caçá-lo: ele era sintoma da duplicação.

---

## Stack

| Camada | Tecnologia |
|---|---|
| UI | React 19 + TypeScript 6 |
| Build | Vite 8 |
| Rotas | react-router-dom 7 |
| Backend | Supabase (PostgreSQL 17 + Auth + Storage) |
| Gráficos | recharts |
| Kanban | @dnd-kit |
| PDF | jspdf + jspdf-autotable |
| Ícones | lucide-react |
| Força de senha | zxcvbn |

---

## Banco de dados

**📘 A documentação completa está em [`DATABASE.md`](DATABASE.md).** Leia antes
de tocar em qualquer coisa relacionada a dados — schema, RLS, Storage,
integração com o agente e armadilhas conhecidas estão todos lá.

As migrações executáveis ficam em [`supabase/migrations/`](supabase/migrations/),
e a API do Agente de IA em
[`supabase/functions/agenda/`](supabase/functions/agenda/).

A migração é aplicada em **trinta arquivos, nesta ordem**:
`0001_schema_inicial.sql`, `0002_agenda_profissionais.sql` (agenda e
profissionais), `0003_whatsapp_unico.sql` (WhatsApp normalizado e único),
`0004_api_agente.sql` (tokens e funções da API),
`0005_catalogo_procedimentos.sql` (os 20 procedimentos da clínica de origem),
`0006_informacoes_clinica.sql` (endereço da empresa e a view do agente),
`0007_horario_na_view.sql` (o horário de atendimento nessa view),
`0008_procedimentos_view.sql` (a view de serviços),
`0009_profissionais_view.sql` (a view de profissionais e a `jornada_texto()`),
`0010_agente_conversas.sql` (as conversas do WhatsApp e as configurações do
agente), `0011_procedimentos_detalhados.sql` (a coluna `descricao_longa`) e
`0012_procedimentos_texto_enxuto.sql` (os textos longos, reescritos curtos) e
`0013_conversas_lista.sql` (a view que sustenta a tela Conversas) e
`0014_conversas_agendamento.sql` (o `data_agendamento` nessa view, para a
etiqueta "Agendado") e `0015_baixa_da_consulta.sql` (o status `faltou` e o
trigger que promove o lead a Cliente) e `0016_ultima_consulta.sql` (a coluna
calculada `ultima_consulta`, que a tela Clientes mostra) e
`0017_provedor_whatsapp.sql` (qual ponte com o WhatsApp está ativa) e
`0018_avaliacao_e_precos.sql` (a porta de entrada, o preço que pode ser
dito, e o que a pessoa procura gravado no agendamento) e
`0019_nome_do_agente.sql` (o nome do agente vira dado, lido pelas telas e pelo
prompt) e `0020_apagar_foto_e_logo.sql` (as políticas de DELETE que faltavam em
`avatars` e `logos`) e `0021_nome_do_paciente.sql` (o `agenda_marcar` passa a
preencher o `nome_lead` vazio com o nome dado ao marcar) e
`0022_procedimentos_padronizados.sql` (o serviço vira vocabulário fechado,
e o interesse do lead vira lista) e `0023_marcar_so_do_catalogo.sql` (o
`agenda_marcar` recusa o que não está no catálogo) e
`0024_dashboard_no_banco.sql` (as cinco funções que fazem o Dashboard contar no
banco em vez de trazer todo mundo) e `0025_instalacao_neutra.sql` (a
instalação nova nasce sem o catálogo odontológico e sem o nome da clínica de
origem — que agora moram no kit) e `0026_porta_de_entrada_opcional.sql` (a
porta de entrada vira escolha da empresa: sem ela, a lista que a atendente lê
para de mandar "marcar a avaliação", e o "Gratuita." vira "Sem custo.") e
`0027_servicos_por_profissional.sql` (os serviços que cada profissional faz:
a tabela `profissional_servicos`, e a agenda inteira só oferecendo cada
serviço na agenda de quem o faz) e `0028_chave_publica_sem_acesso.sql` (a
chave pública, que vai no navegador, deixa de ler os contatos e de marcar ou
cancelar agendamento sem login — ver o ponto 1 e o 3 logo abaixo) e
`0029_cor_do_sistema.sql` (a cor do sistema vira escolha da empresa: a coluna
`cor_sistema`, com a chave de uma das sete cores de
[`marca.ts`](src/lib/marca.ts) — ver "Paleta" no Design system) e
`0030_follow_up.sql` (o follow-up automático: `pg_cron` e `pg_net`, os prazos em
`configuracoes_agente`, a tabela `agente_followups`, a `followups_pendentes()`
com a política inteira e a `disparar_followups()` que o cron chama — ver a
seção 4.20 do `DATABASE.md`, e `npm run followup:ligar` para agendar).

> **O conteúdo de nicho não mora nas migrações.** Da `0001` à `0024` elas
> cadastram o catálogo e o nome da clínica odontológica onde o sistema nasceu;
> a `0025` desfaz isso no fim da fila, **só num banco que ninguém usou**. Quem
> é clínica odontológica roda o kit
> [`kits/clinica-odontologica/servicos.sql`](kits/clinica-odontologica/servicos.sql)
> depois das migrações, e recebe os 20 serviços exatamente como eram.
>
> **O mesmo vale para a atendente.** O `agente-ia/prompt.md` e o
> `agente-ia/descritor-de-fotos.md` são **genéricos**, com as regras que
> nasceram na clínica e as palavras de qualquer ramo. O prompt que atendeu em
> produção, com as regras de saúde, está em
> [`kits/clinica-odontologica/`](kits/clinica-odontologica/) — no mesmo
> esqueleto e com o mesmo contrato com o código, para trocar é só copiar.

> ⚠️ **A `0021` recria a `agenda_marcar` inteira**, porque `create or replace`
> exige o corpo todo. O arquivo foi **gerado a partir do
> `pg_get_functiondef()` do banco**, e só o bloco do lead mudou — escrever
> as 130 linhas à mão seria copiar e torcer para não mover uma vírgula.

Os pontos que mais causam erro:

1. **`crm_clinica` é uma VIEW**, não uma tabela. A tabela física é
   `crm_clinica_dados`. A view acrescenta duas colunas calculadas na leitura,
   `minutos_ultima_mensagem` e `ultima_consulta`. Escrita funciona normalmente
   (view auto-atualizável), mas **nunca grave nas colunas calculadas** — e
   **nunca acrescente `join` a ela**: dois itens no FROM a tornam
   somente-leitura e derrubam todo o cadastro do sistema. Por isso
   `ultima_consulta` é subconsulta escalar, e não `join lateral` como na
   `conversas_lista`. Confira com `select is_updatable from
   information_schema.views where table_name='crm_clinica'`.

   > ⚠️ **E ela precisa de `with (security_invoker = true)`.** Sem isso a view
   > roda como a dona, passa por cima do RLS, e a `anon key` — que qualquer um
   > copia do navegador — lê e altera todos os contatos. A `0022` recriou a
   > view com `drop` + `create` e **perdeu a opção sem ninguém ver**; só a
   > `0028` devolveu. Recriou uma view? A consulta de segurança da seção 10 do
   > [`DATABASE.md`](DATABASE.md) tem que voltar vazia.
2. **Os valores de `status` vivem em dois lugares:** o `CHECK` no banco e os
   tipos `LeadStatus` / `ConsultaStatus` em [`src/types/index.ts`](src/types/index.ts).
   Alterou um, altere o outro — nada sincroniza isso automaticamente.
3. **As Edge Functions escrevem com a `service_role key`.** As políticas de RLS
   só liberam `authenticated`, e função não tem sessão. O Supabase injeta essa
   chave sozinho; ela **nunca** entra em `src/`. Qualquer integração que use a
   `anon key` falha em silêncio (`200 OK`, zero linhas).

   > ⚠️ **Função `security definer` só a `service_role` executa** (`0028`). Ela
   > passa por cima do RLS, e o Postgres dá `EXECUTE` a `PUBLIC` em toda
   > função nova — ou seja, à `anon key`. Foi assim que `agenda_marcar` e
   > `agenda_cancelar` ficaram abertas a quem não tinha login. Mudou a
   > assinatura de uma delas (`drop` + `create`)? **O `EXECUTE` volta para
   > todo mundo**: repita o `revoke`/`grant` da `0028` na mesma migração.
   > `create or replace` mantém as permissões.
4. **Realtime assina a TABELA, não a view.** Leitura e escrita usam
   `crm_clinica`; as assinaturas de `postgres_changes` usam
   `crm_clinica_dados`. O Postgres só replica tabelas — assinar a view não dá
   erro, apenas nunca dispara. (`consultas` já é tabela, então a Agenda assina
   ela direto.)
5. **Não existe tabela de agenda.** A agenda de um profissional são os
   agendamentos com o `profissional_id` dele. Cadastrar o profissional já cria
   a agenda.
6. **`consultas` tem uma restrição de exclusão** (`consultas_sem_sobreposicao`)
   que impede dois agendamentos ativos se sobrepondo na mesma agenda. Ela devolve
   `23P01`, e a interface precisa traduzir isso — repetir a chamada dá o mesmo
   erro.
7. **Ninguém vira Cliente sem um atendimento realizado.** `pessoas.ts` separa
   `/leads` de `/clientes` por `consulta_realizada` / `paciente_recorrente`, e
   a porta é sempre a mesma: **um agendamento com status `realizada` existir**.
   Pela baixa (a Agenda ou o `AvisoBaixaConsulta`), o trigger promove — e passa
   a `paciente_recorrente` no 2º.

   > **O cadastro manual era a exceção, e deixou de ser.** "Novo Cliente"
   > gravava `consulta_realizada` no clique, e a pessoa ficava com a etiqueta
   > verde **sem um agendamento sequer por trás** — a tela afirmando um
   > atendimento que o sistema não sabia mostrar. Hoje o modal cria o
   > agendamento junto, e **quem decide é a data**: no passado ela vira Cliente,
   > no futuro ou sem data ela entra como Lead. O botão diz qual dos dois antes
   > do clique.
8. **"Agendou?" não se pergunta ao `status`.** O trigger preserva
   `consulta_realizada` e `paciente_recorrente` quando alguém marca de novo —
   então **um cliente que volta e marca NÃO fica em `consulta_agendada`**.
   Quem responde é `data_agendamento`, recalculada para qualquer status. A
   regra mora em `temConsultaMarcada()`, em
   [`src/lib/conversas.ts`](src/lib/conversas.ts). Filtrar por status erra em
   silêncio, e erra justo com quem mais volta.
9. **O modelo não guarda resultado de ferramenta entre uma mensagem e
   outra.** `montarHistorico()` reconstrói a conversa a partir de
   `mensagens_whatsapp`, que só tem os balões de texto — a chamada de
   ferramenta e o que ela devolveu somem no fim da execução. **Ferramenta que
   exige um id vindo de outra ferramenta quebra na mensagem seguinte**, e foi
   assim que a primeira remarcação falhou. Quem precisa de um id que o contato
   nunca digita deve **achá-lo pelo `lead_id` do contexto**, como faz
   `consultaAlvo()` em
   [`ferramentas.ts`](supabase/functions/_shared/ferramentas.ts).
10. **`whatsapp_lead` é único e tem formato canônico**: só dígitos, com o código
   do país (`5511987654321`). Nunca grave formatado — um trigger tira a
   pontuação, mas ninguém adivinha o DDI que faltar. Repetido devolve `23505`.
   É o formato em que a Evolution entrega; a regra dos países vive em
   [`src/lib/telefones.ts`](src/lib/telefones.ts).

---

## Estrutura

```
src/
├── main.tsx                    ponto de entrada
├── App.tsx                     rotas
├── index.css                   ÚNICO css importado: fonte, tailwind, animações
├── App.css                     ⚠️ arquivo morto — não é importado em lugar nenhum
├── lib/
│   ├── supabase.ts             cliente Supabase (lê as env vars)
│   ├── pessoas.ts              regra que separa Lead de Cliente
│   ├── marca.ts                o nome do produto e a COR DO SISTEMA: as 7 cores, os tons, o favicon
│   ├── cores.ts                paleta das agendas (cor do profissional)
│   ├── agenda.ts               lógica pura: datas, conflito, layout dos blocos
│   ├── periodo.ts              o recorte de datas dos filtros (3 telas, 1 regra)
│   ├── procedimentos.ts        o "a partir de" na tela, e o catálogo dos campos
│   ├── telefones.ts            países atendidos, dígitos e formato canônico
│   ├── contatos.ts             busca de pessoa por WhatsApp (duplicidade)
│   ├── conversas.ts            ler, enviar, assumir, devolver; e a etiqueta "Agendado"
│   ├── baixaConsulta.ts        compareceu ou faltou: a baixa que fecha o funil
│   ├── whatsappConexao.ts      a ponte está de pé? quem está conectado? (com polling)
│   ├── apagarPessoa.ts         prever o estrago e apagar tudo de alguém
│   ├── statusLead.ts           cores e rótulos de status (fonte para código novo)
│   ├── servicosDosProfissionais.ts  quem faz o quê; lista vazia = faz todos (0027)
│   ├── agente.ts               como o Agente de IA se chama NA TELA (ver Design system)
│   ├── modelosIA.ts            o catálogo de modelos e quais têm chave no servidor
│   └── apiTokens.ts            geração/hash do token e catálogo dos endpoints
├── types/
│   └── index.ts                tipos espelhando o schema do banco
├── components/
│   ├── Layout.tsx              casca: aviso de queda + Sidebar + <Outlet/> (ver Convenções)
│   ├── Sidebar.tsx             navegação lateral, logo, logout
│   ├── ProtectedRoute.tsx      guarda de sessão
│   ├── PessoasPage.tsx         implementação compartilhada de /leads e /clientes
│   ├── AgendaSemana.tsx        grade semanal (7 colunas × horas)
│   ├── AgendaMes.tsx           grade mensal (semanas inteiras)
│   ├── NovoAgendamentoModal.tsx  criar agendamento; cria o contato se não existir
│   ├── CampoTelefone.tsx       seletor de país + contagem de dígitos
│   ├── TabClinica.tsx          aba "Empresa" de Configurações
│   ├── SeletorDeCor.tsx        "Cor do sistema", dentro da aba Empresa: o clique mostra, o Salvar grava
│   ├── EditorProcedimento.tsx  modal de edição de um serviço
│   ├── PortaDeEntrada.tsx      a porta de entrada (opcional): escolher, deixar de usar, duração e valor
│   ├── ModalPortal.tsx         leva o modal para o <body> (ver Convenções)
│   ├── ListaConversas.tsx      coluna esquerda de /conversas
│   ├── JanelaConversa.tsx      coluna direita: balões, cabeçalho e resposta
│   ├── PainelLead.tsx          coluna extra: ficha da pessoa (sem o resumo — ver abaixo)
│   ├── AvisoBaixaConsulta.tsx  "compareceu ou faltou?" — nas 3 telas
│   ├── AvisoForaDaLista.tsx    "fulano não faz este serviço" — âmbar, nas 3 telas que marcam
│   ├── FiltroPeriodo.tsx       a lista de períodos + o botão "Personalizado"
│   ├── ConexaoWhatsApp.tsx     seção "Conexão do WhatsApp", em Atendente de IA
│   ├── AvisoWhatsAppCaiu.tsx   faixa vermelha no topo do sistema — só depois de 1 min caído
│   ├── ApagarPessoa.tsx        zona de perigo por BUSCA (Atendente de IA)
│   ├── ApagarEstaPessoa.tsx    zona de perigo da FICHA (/leads/:id)
│   └── ConfirmDeleteModal.tsx  modal de confirmação reutilizável
└── pages/
    ├── Login.tsx               tela dividida (marca + formulário)
    ├── Dashboard.tsx           métricas e gráficos — tudo contado no banco (0024)
    ├── CRM.tsx                 Kanban do funil (drag and drop, teto por coluna)
    ├── Conversas.tsx           o WhatsApp da empresa, em duas colunas
    ├── Agenda.tsx              calendário de todas as agendas + filtros
    ├── Profissionais.tsx       quem atende: nome, cor, jornada e os serviços que faz
    ├── Leads.tsx               invólucro: <PessoasPage mode="leads" />
    ├── Clientes.tsx            invólucro: <PessoasPage mode="clientes" />
    ├── LeadDetail.tsx          ficha EDITÁVEL + agendamentos + anotações
    ├── Procedimentos.tsx       o catálogo da empresa (a página Serviços)
    ├── SecretariaIA.tsx        o Agente de IA: modelo, prompt (só leitura), liga/desliga
    ├── TokenApi.tsx            chaves de acesso e o contrato da API
    └── Configuracoes.tsx       perfil, empresa, horários e o fuso
```

### A agenda não é uma entidade

`Agenda.tsx` desenha os agendamentos agrupados por `profissional_id`. Não há tabela
`agendas`, nem tela para criar uma: cadastrar o profissional já basta, e a cor
escolhida no cadastro é a cor dos blocos no calendário.

O calendário é desenhado à mão, sem biblioteca. As prontas (FullCalendar e
afins) trazem CSS e sistema de temas próprios, que brigariam com a estilização
inline daqui, e somariam peso a um bundle que já está grande.

### Telefone: um lugar só

Todo telefone que o sistema escreve passa por
[`CampoTelefone`](src/components/CampoTelefone.tsx) — modal da agenda, novo
lead, novo cliente e a ficha do lead. O componente existe para que a regra
de país e de contagem de dígitos não se repita (nem divirja) em quatro telas.

> `rotulo=""` some com o rótulo, para quem já tem um do lado de fora — é o caso
> da ficha, onde os campos são alinhados numa coluna comum.

Os países atendidos ficam em [`src/lib/telefones.ts`](src/lib/telefones.ts),
numa lista curta e deliberada: cobrir "todos" com regra escrita à mão é promessa
impossível de manter. Acrescentar país é acrescentar um item nessa lista.

O que vai para o banco é sempre o canônico — dígitos com DDI. O formato bonito
existe só na tela, via `formatarParaExibicao()`.

### A lógica da agenda

A lógica de datas, conflito e posicionamento fica em
[`src/lib/agenda.ts`](src/lib/agenda.ts), fora de qualquer componente. Isso é
proposital: a API do Agente de IA vai precisar responder "que horários estão
livres?" com estas mesmas regras, só que em SQL. **Mudou uma regra aqui, a outra
implementação precisa acompanhar** — se divergirem, o agente oferece horário que
a recepção vê como ocupado.

### Leads e Clientes são a mesma implementação

`/leads` e `/clientes` leem a **mesma tabela** e se diferenciam só pelo status.
Por isso existe um único [`PessoasPage.tsx`](src/components/PessoasPage.tsx) com
um `mode`, e duas páginas de 4 linhas que o instanciam. A configuração de cada
modo (título, textos, ícone, rótulo do botão, nome do arquivo exportado) fica no
objeto `CONFIG`, no topo do arquivo.

A regra da separação mora em [`src/lib/pessoas.ts`](src/lib/pessoas.ts) —
**só ali**. É usada pelas duas páginas e pela tela de detalhe. Ela precisou sair
do `PessoasPage.tsx` porque exportar função de um arquivo que também exporta
componente quebra o Fast Refresh (o ESLint acusa isso).

---

## Rotas e autenticação

```
/login              público
/                   Dashboard              ┐
/crm                CRM (Kanban)           │
/conversas          Conversas (WhatsApp)   │
/agenda             Agenda (calendário)    │
/leads              Leads                  │ dentro de ProtectedRoute
/clientes           Clientes               │ e de Layout (Sidebar)
/leads/:id          Detalhe da pessoa      │
/profissionais      Profissionais          │
/servicos           Serviços               │  (arquivo: Procedimentos.tsx)
/atendente-ia       Atendente de IA        │  (arquivo: SecretariaIA.tsx)
/token-api          Token e API            │
/configuracoes      Configurações          ┘
*                   redireciona para /
```

### O que é barra lateral e o que é menu do usuário

A navegação está dividida por **quem usa e com que frequência**:

| Lugar | O que fica lá |
|---|---|
| **Barra lateral** | O dia a dia da recepção: Dashboard, CRM, Conversas, Agenda, Leads, Clientes, Profissionais, Serviços, Configurações |
| **Menu do nome** (rodapé) | O sistema: **Atendente de IA**, **Token e API**, Sair |

As três primeiras eram abas de Configurações. Saíram de lá por motivos
diferentes:

- **Serviços** virou página porque não é configuração — é conteúdo da
  empresa, mexido na mesma frequência que Profissionais, e é o texto que a
  atendente fala com o contato. Fica logo depois de Profissionais.
- **Atendente de IA** e **Token e API** foram para o menu do nome porque são
  ajustes do sistema, não da empresa: quem liga o agente ou cria uma chave de
  API não é quem atende o telefone. Enterrar as duas numa aba de Configurações
  escondia demais; deixar na barra lateral atrapalharia quem passa o dia na
  Agenda.

> `/leads` e `/clientes` aceitam **`?etapa=` e `?periodo=`** na URL — e é por
> onde o "+ N outros" de uma coluna do CRM chega, com a etapa e o recorte
> juntos. O `?de=` e `?ate=` acompanham quando o período é personalizado.

> `/leads/:id` atende **tanto leads quanto clientes** — é a mesma entidade. O
> botão "voltar" da tela de detalhe decide o destino pelo status, para não jogar
> um cliente de volta na lista de leads.

[`ProtectedRoute.tsx`](src/components/ProtectedRoute.tsx) verifica a sessão com
`supabase.auth.getSession()` e escuta `onAuthStateChange`. Sem sessão, redireciona
para `/login`.

O login tem proteção contra força bruta no cliente: 5 tentativas, depois 30
segundos de bloqueio com contagem regressiva.

### A regra da senha mora no servidor; a tela só a explica

Trocar a senha exige **10 caracteres, com minúscula, maiúscula, número e
símbolo** — e uma pontuação `zxcvbn` de 3 ou mais.

| Onde | O quê | Vale? |
|---|---|---|
| **Supabase Auth** (Authentication → Password settings) | `password_min_length = 10` e o preset das quatro classes | **Sim.** É quem recusa |
| `REGRAS_SENHA`, em [`Configuracoes.tsx`](src/pages/Configuracoes.tsx) | A mesma lista, para a interface | Não. Tranca o botão e diz o que falta |

**São duas cópias da mesma regra, e é assim mesmo.** Validação no navegador é
conselho: quem chamar `supabase.auth.updateUser()` por fora não passa por ela.
Mas sem a cópia na tela, a única forma de descobrir a regra seria clicar e ser
recusado. **Mudou uma, mude a outra** — mais frouxa aqui, a pessoa preenche
tudo e leva um erro sem explicação; mais dura, ela é impedida de usar uma senha
que o sistema aceitaria.

Três decisões dentro disso:

1. **A força entra como um item da lista, não como recusa no clique.** As quatro
   classes passam com `Senha@1234`, que qualquer dicionário quebra — então a
   regra do `zxcvbn` continua valendo. Mas botão trancado por motivo invisível é
   o pior dos dois mundos.
2. **A lista fica sempre na tela**, e não só depois de digitar: a regra precisa
   ser conhecida na hora de escolher a senha, não descoberta na hora da recusa.
3. **O conjunto de símbolos é copiado do Supabase, à risca.** `/[^A-Za-z0-9]/`
   seria mais curto e estaria errado — acento não é alfanumérico para essa
   expressão, então `Josué12345` passaria aqui e seria recusado lá.

> ⚠️ A política do Auth **não** é um arquivo deste repositório: ela vive na
> configuração do projeto no Supabase. Instalação nova recebe ela do
> `npm run instalar:usuario`, que liga a regra antes de criar o primeiro
> usuário (parte 3 do [`INSTALACAO.md`](INSTALACAO.md), que traz também o
> caminho pelo painel). Mudou a regra aqui? A constante `QUATRO_CLASSES` de
> [`scripts/instalar.mjs`](scripts/instalar.mjs) é a terceira cópia.

---

## Convenções de código

### Estilização: inline, não Tailwind

O Tailwind **está instalado e importado** (`@tailwindcss/vite`, `@import
"tailwindcss"` no `index.css`), mas **nenhuma classe utilitária é usada** no
projeto. Toda a estilização é feita com objetos `style={{ }}` inline.

Os únicos `className` existentes são animações próprias definidas no
[`index.css`](src/index.css) — `fade-in` e `fade-in-1` … `fade-in-6`, que
escalonam a entrada dos blocos da página — mais classes de media query
declaradas localmente no próprio componente.

**Siga o padrão inline.** Misturar Tailwind agora deixaria a base inconsistente.

### A casca tem altura fixa, e quem rola é o conteúdo

[`Layout.tsx`](src/components/Layout.tsx) usa `height: 100dvh` com
`overflow: hidden`, e o `<main>` é que rola. **Não troque por `minHeight`.**

Com `minHeight`, o container cresce junto com a página e a barra lateral estica
junto — ela é um item flex, e `stretch` é o padrão. O rodapé dela (o nome do
usuário e o menu do sistema) vai parar no fim do **documento**: em telas altas
como Dashboard, Agenda e Configurações, some abaixo da dobra e só reaparece
rolando até o fim. Foi exatamente o que aconteceu.

Consequência para páginas novas: use `height: '100%'`, não `100vh` — o `main`
já é do tamanho da janela, e `100vh` dentro dele ignora qualquer margem futura.

É `dvh`, e não `vh`, por causa do celular: lá `100vh` é a altura com a barra
de endereço escondida, e com ela à vista o pé da casca fica atrás da barra do
navegador.

### Celular: layout no componente, medida no CSS

Até **767px** é celular (`LARGURA_CELULAR`, em
[`useTelaPequena.ts`](src/lib/useTelaPequena.ts)). Estilo inline não enxerga
media query, então a regra se divide em duas:

| O que muda | Onde | Como |
|---|---|---|
| **Layout** — a barra vira gaveta, uma tela troca de versão | No componente | `useTelaPequena()` |
| **Medida** — margem, fonte, modal em tela cheia | No [`index.css`](src/index.css), no bloco `@media (max-width: 767px)` | Uma classe marcada à mão no elemento, com `!important` para vencer o inline |

As classes que existem hoje:

| Classe | Onde vai | O que faz no celular |
|---|---|---|
| `pagina` | O contêiner de cada página (o `padding: '32px 36px'`) | Margem de 16px nos lados |
| `cartao` | O cartão branco de ficha e configuração (o `padding: '22px 26px'`) | Margem interna de 16px |
| `modal-fundo` | O fundo escuro de **todo** modal | Respiro de 12px em volta da caixa |
| `modal-cheio` | Junto de `modal-fundo`, em modal de **formulário** | A caixa (o primeiro filho) ocupa a tela inteira |

E, sem classe, todo `input`, `select` e `textarea` sobe para 16px: abaixo
disso o iPhone dá zoom na tela ao tocar no campo.

**Página ou modal novo nasce com a classe.** Sem ela, ele funciona no
computador e sai apertado no celular — e ninguém percebe até abrir num.

O computador **não muda**: nenhuma regra vale acima de 767px. No tablet
(até 1023px) a barra lateral só nasce recolhida.

**Conversas, no celular, é uma coluna por vez** — lista, conversa, ficha —, e
qual aparece sai do endereço: `?lead=X` abre a conversa, `&ficha=1` a ficha.
Por isso a conversa aberta é lida da URL, e não guardada em estado: cada passo
entra no histórico, e o botão voltar do aparelho desfaz um passo em vez de
sair da tela. Dentro de uma conversa a faixa do topo some (o `Layout` confere
o `?lead=`). Os três componentes recebem `celular` e se ajustam sozinhos.

**Agenda, no celular, é um dia em lista**
([`AgendaDiaCelular`](src/components/AgendaDiaCelular.tsx)), e não a grade:
sete colunas em 390px não mostram nome de ninguém. Por baixo a página carrega
a semana do dia escolhido, então trocar de dia na faixa não espera o banco. A
profissional escolhida no seletor fica no `localStorage`
(`agenda.celular.profissional`): o celular da Danielle abre na agenda da
Danielle.

**Dashboard, no celular, é para ler** — quem abre é a dona. Os números vão
numa grade de duas colunas (a taxa de conversão ocupa as duas), os gráficos
empilham, o de **serviços vira lista** (nome inteiro em cima e as duas barras
embaixo, na mesma escala — os nomes do catálogo não cabem ao lado de uma barra
em 390px) e os próximos agendamentos viram linhas em vez de tabela.

**CRM, no celular, é o funil para ler** (`FunilCelular`, dentro do
[`CRM.tsx`](src/pages/CRM.tsx)): cada etapa numa linha, com a quantidade e uma
barra na escala da maior, nos mesmos dois trechos do quadro. Tocar abre quem
está ali, e o "ver todos" leva à lista com o mesmo `?etapa=`. **Não há
arrastar no celular, de propósito**: mover de etapa continua no computador e
na ficha. **Leads e Clientes** viram cartões (o cartão inteiro abre a ficha).

### Várias clínicas: um site, um banco por clínica

O Núcleo é comercializado como **uma instalação por clínica** — um projeto
Supabase para cada uma (banco, login, funções, WhatsApp) — com **uma tela só**
para todas. Cada clínica tem um endereço (`clinica.seudominio.com.br`), e é o
endereço que diz qual banco abrir.

| Peça | Onde |
|---|---|
| A ficha de cada clínica: nome, URL e chave **pública** do Supabase, situação, cor | `public/clinicas/<endereço>.json` |
| Quem lê a ficha e decide | [`clinica.ts`](src/lib/clinica.ts) |
| O cliente do Supabase, criado com a ficha | [`supabase.ts`](src/lib/supabase.ts) — e o `SUPABASE_URL` que as funções usam |
| A ordem: descobrir a clínica, **depois** carregar o sistema | [`main.tsx`](src/main.tsx) |
| A tela de "acesso suspenso" e de "endereço não encontrado" | [`TelaAviso.tsx`](src/components/TelaAviso.tsx) |

Regras que quebram em silêncio se esquecidas:

- **Nada importado no topo do `main.tsx` pode importar o Supabase**, nem
  indiretamente. O `App` entra com `import()` depois de `descobrirClinica()`;
  um `import` estático criaria o cliente antes de saber qual banco.
- **Ninguém lê `import.meta.env.VITE_SUPABASE_URL` direto.** Use
  `SUPABASE_URL`, de `supabase.ts`. O `.env` só vale em `localhost` e
  `*.vercel.app` (desenvolvimento e links de teste), e só quando não há ficha.
- **Endereço sem ficha, fora desses dois, NÃO cai no `.env`**: com o domínio
  coringa, um endereço inventado abriria o banco de outra clínica. A tela diz
  que o endereço não existe.
- **Um arquivo por clínica, nunca uma lista.** A lista inteira no site seria a
  carteira de clientes para quem abrisse o JavaScript.
- **Suspender** é trocar `"situacao": "ativa"` por `"suspensa"` na ficha e
  publicar: o próximo F5 mostra o aviso. As fichas saem com `no-store`
  ([`vercel.json`](vercel.json)), e o rewrite do `vercel.json` não alcança
  `/clinicas/` — ficha que não existe responde 404, e não a página do sistema.

### Níveis de acesso (migração 0031)

Cada usuário tem um **papel** — `dona`, `recepcao`, `profissional` (na tela: **Admin**,
Recepção, Profissional — o valor interno continua `dona`; o nome de tela mora
em `NOME_DO_PAPEL`, [`equipe.ts`](src/lib/equipe.ts)) — e, por
cima dele, permissões que a dona liga e desliga (`usuarios.permissoes`). As
permissões são `dashboard`, `valores`, `conversas`, `agenda_todas`,
`agenda_editar`, `pessoas`, `crm`, `exportar`, `configurar` e `equipe`; a
profissional ligada a um cadastro (`usuarios.profissional_id`) vê sempre a
própria agenda e quem ela atende.

**A trava está em três lugares, e os três precisam andar juntos:**

| Onde | Como |
|---|---|
| **Banco** | Toda política pergunta `(select public.pode('x'))`. É a trava de verdade |
| **Função `whatsapp`** | Roda com a chave de serviço, que ignora o RLS — cada rota chamada pela tela usa `exigir(req, 'permissão')`, que pergunta ao `pode()` com o token do usuário |
| **Tela** | Só acompanha: esconde o que a pessoa não pode usar. `useAcesso()` ([`acesso.ts`](src/lib/acesso.ts)) traz as permissões calculadas pelo banco (`minhas_permissoes()`, 0032) — nunca recalcule a regra no JavaScript. Rotas usam `<ExigeAcesso>` no [`App.tsx`](src/App.tsx), e o menu, o mesmo `permite` |

Regras que quebram em silêncio:

- **Tabela nova → política com `pode()`.** Uma tabela com `using (true)`
  devolve tudo para a recepcionista e a profissional.
- **Rota nova na função `whatsapp` chamada pela tela → `exigir()`**, nunca só
  `usuarioDaSessao()`.
- **Coluna nova em `crm_clinica_dados` → `grant select, update (coluna) ...
  to authenticated`.** As permissões dela são por coluna, para esconder o
  valor pago; coluna sem grant quebra a tela com "permission denied".
- **Nunca `select('*')` em `consultas`** (0033): o valor de cada consulta
  também é fechado, e o `*` o pede. Use `COLUNAS_CONSULTA`, de
  [`consultas.ts`](src/lib/consultas.ts), e o valor por `valoresDasConsultas()`.
- **O valor pago** só se lê pela visão `crm_clinica` (vem nulo sem `valores`)
  e só se grava por `definir_valor_pago()`. O tempo real (`crm_clinica_dados`)
  não manda a coluna — foi conferido.
- **Gatilho que atualiza outra tabela roda como o sistema** (`security
  definer`). Rodando como quem editou, o RLS filtra o UPDATE para zero linhas,
  sem erro — foi o que ia acontecer com a baixa da profissional.
- **Só uma dona mexe em donas** (0035): quem tem `equipe` sem ser dona não
  promove ninguém a dona nem altera, desliga ou troca a senha de uma dona. A
  regra está no gatilho e repetida nas rotas `/equipe/*` (`sou_dona()`).
- **A aba Equipe** ([`TabEquipe.tsx`](src/components/TabEquipe.tsx)) cria login
  com **senha provisória** (rota `/equipe/criar`) — sem e-mail, de propósito:
  o SMTP embutido do Supabase só manda para membros da conta. Papel,
  permissões e desligar vão direto ao banco. As permissões efetivas de cada um
  vêm de `equipe()` (0034), pela mesma `permissao_efetiva()` da `pode()`.
- **Teste por papel** em [`supabase/testes/`](supabase/testes/), pelo
  `scripts/testar-sql.mjs`, que desfaz tudo no fim. Mexeu em política, rode.

### A atendente de cada clínica: `clinicas/<nome>/`

O prompt vai **embutido** na função `whatsapp`, então cada clínica precisa da
sua publicação. O kit de cada uma mora em [`clinicas/`](clinicas/LEIA-ME.md)
(`clinica.json` com o projeto, `prompt.md`, `descritor-de-fotos.md` e o
`.env.agente.local` fora do Git), e os scripts escolhem por ele:

```bash
npm run agente:deploy  -- --clinica <nome>   # prompt dela, projeto dela
npm run agente:secrets -- --clinica <nome>   # chaves dela
```

- **O `agente-ia/` é o genérico** — ponto de partida de uma clínica nova e o
  da instalação avulsa. O `prompt-oficial.ts` versionado é sempre gerado dele:
  o `publicar.mjs` gera o da clínica, publica e volta o arquivo ao genérico.
- **Sem `--clinica`, o projeto do `.supabase-token.local` que for de uma
  clínica cadastrada usa o kit dela** ([`clinicas.mjs`](agente-ia/clinicas.mjs),
  `clinicaPorRef`). Não remova essa trava: é ela que impede publicar o
  genérico por cima da atendente de uma clínica em produção.
- **Regra nova que vale para todas** vai no `prompt.md` de cada pasta, e cada
  clínica é publicada. Não existe herança entre o genérico e os kits.
- `--simular` gera e confere o prompt e mostra o comando, sem publicar.

### Instalar como aplicativo

O sistema é instalável ("Adicionar à tela inicial"), e abre sem a barra do
navegador. São três peças:

| Peça | Onde |
|---|---|
| Um manifesto e um jogo de ícones **por cor do sistema** (7 × 3 PNG) | [`public/app/`](public/app/) |
| Os links que apontam para eles, nascendo no petróleo | [`index.html`](index.html) |
| A troca para a cor da empresa, junto com o resto da cor | `trocarAplicativo`, em [`marca.ts`](src/lib/marca.ts) |

O celular lê **arquivo**, não variável CSS — por isso um arquivo por cor, e
não um só pintado em tempo de execução. Cor nova no seletor pede o manifesto e
os três PNG dela em `public/app/`, com o mesmo `id` da cor no nome. O ícone de
um aplicativo **já instalado** não muda sozinho: a empresa trocou a cor, quem
quiser o ícone novo reinstala.

**Não há service worker, de propósito.** O Chrome instala sem ele, e um
service worker que guarda arquivos em cache é o caminho mais curto para uma
clínica ficar presa numa versão velha depois de um deploy. Sem ele, o
aplicativo precisa de internet — como o sistema inteiro já precisa.

### Modal vive dentro de `ModalPortal`

`position: fixed` promete "em relação à janela" — e quebra a promessa se
**qualquer** ancestral tiver `transform`. As classes `fade-in-*` do
[`index.css`](src/index.css) animam com `translateY` e `forwards`, o que deixa
`transform: translateY(0)` gravado no elemento para sempre. Não é `none`, então
vira o novo referencial.

Em Configurações isso aparecia: o conteúdo da aba mora dentro de um `fade-in-3`
alto, e o modal se centralizava no meio **daquele bloco** — surgindo lá embaixo,
metade fora da tela.

[`ModalPortal.tsx`](src/components/ModalPortal.tsx) resolve na raiz, jogando o
modal direto no `<body>`. **Todo modal novo nasce dentro dele.** Os modais
antigos das outras páginas escapam por acidente — são irmãos dos blocos
animados, não filhos —, mas basta alguém aninhar um para o sintoma voltar.

### A barra lateral não recarrega sozinha

[`Sidebar.tsx`](src/components/Sidebar.tsx) carrega o usuário e a empresa
**uma vez**, quando a sessão abre. Ela não é filha de nenhuma página, então
trocar a foto, o nome ou a logo em Configurações não chegava nela — a mudança
só aparecia no próximo F5, justamente na tela em que a pessoa acabou de mexer.

Dois eventos de janela resolvem, e são o contrato entre as duas telas:

| Evento | Quem dispara | O que a barra refaz |
|---|---|---|
| `clinica-atualizada` | Troca ou remoção da logo, e a aba Empresa | Relê `configuracoes_clinica` |
| `usuario-atualizado` | Troca ou remoção da foto, e o salvar do nome | Relê a linha do usuário |

São `window.dispatchEvent(new Event(...))` — sem estado global, sem provider.
A barra é o único assinante, e uma tela só; um `Context` para dois avisos que
atravessam a aplicação inteira seria mais encanamento do que ganho.

> **Quem grava, avisa.** Esquecer o `dispatchEvent` não quebra nada e não
> aparece em teste nenhum: a tela onde você mexeu mostra o valor novo (o estado
> local foi atualizado junto), e só a barra fica para trás.

### Outras convenções

- Componentes: `export default function NomeDoComponente()`
- Sem ponto e vírgula no fim das linhas
- Aspas simples
- Media queries: bloco `<style>` dentro do componente (ver `Login.tsx`)
- Estados de erro: mensagem inline em caixa vermelha, sem `alert()`
- Feedback de sucesso: estado `saved` temporário, limpo com `setTimeout` de ~2s

---

## Design system

### Paleta — a cor é da empresa, os cinzas são do sistema

A cor da marca é **escolhida pela empresa** em Configurações → Empresa, entre
sete cores prontas (migração `0029`). Os quatro tons dela vivem em
[`src/lib/marca.ts`](src/lib/marca.ts) e chegam às telas como **variáveis
CSS**:

| Papel | No código | Uso |
|---|---|---|
| Principal | `MARCA` | botões, links, ícones, destaques, o balão da IA |
| Principal escuro | `MARCA_ESCURO` | hover |
| Principal claro | `MARCA_CLARO` | estado de carregamento |
| Fundo suave | `MARCA_SUAVE` | blocos de ícone, realces, item ativo do menu |

As sete: **Petróleo** (`#1E6E8C`, a padrão — a cor de antes), Azul, Verde,
Roxo, Rosa, Laranja e Marrom, com os tons de cada uma na lista `CORES_DO_SISTEMA`.

| Decisão | Por quê |
|---|---|
| **Lista fechada, e não cor livre** | O mesmo motivo de [`cores.ts`](src/lib/cores.ts): com cor livre, alguém escolhe amarelo e a letra branca dos botões some. Cada uma das sete passa de 4,5 : 1 com branco, e tem os tons ajustados à mão |
| **Sem cinza, vermelho nem amarelo** | Cinza: o sistema já é cinza por baixo — o item ativo do menu ficaria igual ao item sob o mouse, e o balão da IA quase igual ao da equipe. Vermelho é erro e botão Excluir. Amarelo é aviso, e apaga a letra branca |
| **Variável CSS, e não hook** | Trocar a cor repinta o sistema na hora sem re-renderizar nada — inclusive os estilos declarados fora de componente, que um hook não alcança |
| **O clique mostra; só o Salvar grava** | [`SeletorDeCor`](src/components/SeletorDeCor.tsx) pinta o sistema a cada clique, para a pessoa ver antes de decidir. Quem sai da tela sem salvar leva o sistema de volta à cor salva |
| **O login abre na cor lembrada pelo navegador** | Ele é lido sem sessão, e o RLS não deixa ler a cor. Na primeira vez num computador, abre na padrão; do primeiro acesso em diante, na cor da empresa (`localStorage`, gravado pelo `Layout` e pelo Salvar). Decisão de produto: abrir uma leitura pública no banco só para isso foi descartado |
| **O ícone da aba acompanha** | `aplicarCorDoSistema()` troca o favicon por um SVG na cor. O `public/favicon.svg` é o mesmo desenho, na padrão — é o que aparece antes do código rodar |

> ⚠️ **Três lugares NÃO aceitam a variável, e pedem o hex de
> `useCorDoSistema()`:**
>
> | Onde | Como fica |
> |---|---|
> | Ícone do lucide | `style={{ color: MARCA }}`, **nunca** `color={MARCA}`: a prop `color` vira o atributo SVG `stroke`, e atributo não resolve `var()`. O ícone desenha com `currentColor`, e a propriedade CSS aceita a variável |
> | `stroke` / `fill` do recharts | `cor.principal`, `cor.suave`… do hook (o Dashboard faz assim) |
> | O PDF (jsPDF) | Números: `corDoSistemaAtual().principal`, convertido em RGB |
>
> **E transparência não se concatena**: `${MARCA}1A` vira texto inválido e o
> navegador ignora a regra em silêncio. Use `marcaComAlfa(10)`, que é
> `color-mix()`.

> **Cor nova na lista** é um item em `CORES_DO_SISTEMA` — a coluna não tem
> `CHECK`. Confira o contraste da `principal` com branco antes (4,5 : 1 ou
> mais), e **nunca** mude o `id` de uma cor que já existe: é o que está gravado
> no banco de quem a escolheu.

Os cinzas são fixos, e continuam escritos à mão nas telas:

| Papel | Cor | Uso |
|---|---|---|
| Fundo da página | `#F2F6F7` | corpo |
| Texto | `#16232B` | títulos e texto principal |
| Texto secundário | `#6B818C` | legendas, rótulos |
| Borda | `#DCE6EA` | bordas de card e input |
| Divisória | `#EDF2F4` | linhas de tabela |
| Fundo alternado | `#F7FAFB` | zebra de tabela, hover |

Fonte: **Plus Jakarta Sans**, carregada do Google Fonts por `@import` na
primeira linha do [`index.css`](src/index.css). Como a estilização é inline,
cada componente repete `fontFamily: "'Plus Jakarta Sans', sans-serif"` — é
verboso, mas é o padrão da base.

### Cores de status — não são cores de marca

Comunicam significado e **não devem ser trocadas** junto com a identidade
visual. A fonte é [`src/lib/statusLead.ts`](src/lib/statusLead.ts), de onde
`PessoasPage.tsx` (que atende `/leads` e `/clientes`), `LeadDetail.tsx` e
`PainelLead.tsx` importam — só o `CRM.tsx` ainda guarda uma cópia das cores,
no array das colunas.

> As cópias do `PessoasPage.tsx` e do `LeadDetail.tsx` saíram na troca de
> vocabulário. A do `Dashboard.tsx` saiu com a reescrita da `0024`: a coluna
> que ela vestia virou "Profissional".

| Status | Cor | Fundo |
|---|---|---|
| `iniciou_conversa` | `#1E6E8C` | `#EAF3F6` |
| `conversando` | `#4F46E5` | `#EEF2FF` |
| `consulta_agendada` | `#1A7A48` | `#E8F8EF` |
| `consulta_cancelada` | `#DC2626` | `#FEF2F2` |
| `follow_up_1/2/3_feito` | `#D97706` | `#FFFBEB` |
| `consulta_realizada` | `#FFFFFF` | `#14532D` |
| `paciente_recorrente` | `#7C3AED` | `#F3E8FF` |

> ⚠️ **`iniciou_conversa` é petróleo FIXO**, e não `MARCA`. Ela nasceu com a
> cor da marca (lead novo = destaque), mas desde o seletor de cor ela ficaria
> igual a "Cliente Recorrente" numa empresa roxa. Ela continua destacando o
> lead novo — só não troca de cor com a empresa.
>
> Por isso `conversando` foi movido para índigo: os dois eram azuis e ficavam
> indistinguíveis no Kanban.

### O Dashboard não carrega pessoas — ele faz perguntas

Ele pedia `select * from crm_clinica`, sem limite, e contava **tudo no
navegador**. Três defeitos moravam nisso, e só um era o teto de 1000:

| Defeito | Quando doía |
|---|---|
| O corte de `max_rows` | A partir do lead **1001**. As contas não ficariam incompletas — ficariam **erradas**, e nada avisaria |
| **Dois gráficos ignoravam o filtro** | **Hoje.** "Dias com mais movimento" e a rosca de horário contavam a empresa inteira. Trocar de "Este mês" para "Hoje" não mexia uma barra |
| "Próximos Agendamentos" lia o lugar errado | **Hoje.** Lia `crm_clinica.data_agendamento` — reflexo mantido por trigger, uma data por pessoa. Sem ordem, sem limite, dentro de um `select` cortado em 1000 |

Agora são cinco funções SQL (migração
[`0024`](supabase/migrations/0024_dashboard_no_banco.sql)) devolvendo números
**já contados**: dezenas de linhas, tenha a empresa cem ou cem mil leads.
Contagem não tem teto — `max_rows` é para linhas.

#### O fuso é o detalhe que decide tudo

Agrupar "por dia" exige saber onde o dia começa. O navegador usava o relógio
dele; **a sessão do PostgREST roda em UTC**. Um contato das 23h de São Paulo é
02h do dia seguinte em UTC — e cairia no dia errado do gráfico, sempre, para
todo mundo que escreve à noite.

Por isso o agrupamento usa `at time zone` com o
`configuracoes_clinica.fuso_horario` — o mesmo campo da `agenda_marcar`, e é
para isso que ele existe. Conferido no banco em 02/09/2026:

```sql
select (timestamptz '2026-09-01 23:30-03' at time zone 'America/Sao_Paulo')::date;  -- 2026-09-01
select (timestamptz '2026-09-01 23:30-03')::date;                                    -- 2026-09-02
```

> **As BORDAS do período não precisam de fuso.** Elas chegam como instante
> absoluto, e comparar instantes independe de fuso. Só o **balde** — de que dia
> é esta linha — precisa.

> ⚠️ E na tela, `rotuloDia()` corta a string em vez de usar `new Date()`:
> `new Date('2026-09-02')` é meia-noite **em UTC**, que em qualquer fuso
> negativo — o Brasil inteiro — volta como 1º de setembro. O gráfico sairia um
> dia atrasado depois de todo o cuidado no SQL.

#### A rosca de horário comercial saiu, e dois gráficos entraram

| | |
|---|---|
| **Saiu** | "Horário dos Contatos" (dentro/fora do expediente). Era o argumento da própria Letícia existir — *"X pessoas escreveram fora do horário, e só ela respondeu"* —, mas a clínica de origem não usava. Saiu junto uma consulta a `horario_comercial` e uma regra de horário que dependia do relógio do computador |
| **Entrou** | **Agendamentos por profissional**, cada barra na **cor do próprio profissional** — a mesma da Agenda, para o gráfico e o calendário falarem a mesma língua |
| **Entrou** | **Serviços: procurado x realizado**, duas barras por serviço |

**No gráfico de serviços, a distância entre as duas barras é a informação.**
"120 procuraram coloração, 14 fizeram" é uma conversa sobre preço, agenda ou
argumento de venda que nenhum dos dois números sozinho começa. É
também a pergunta que **não tinha resposta** antes da `0022` fechar o
vocabulário: com texto livre, na clínica de origem, `lentes` e
`Lentes de Contato` eram dois serviços.

> ⚠️ **O mesmo filtro significa duas coisas nesta página, e tem que
> significar.** Os KPIs e o "procurado" contam por **quando a pessoa chegou**;
> "Agendamentos por Profissional" e o "realizado" contam por **quando o
> atendimento acontece**. Quem chegou em agosto pode ter feito em setembro —
> forçar a mesma data faria metade dos blocos responder a pergunta errada. Cada
> subtítulo diz qual está usando.

#### Dois tetos, e nenhum silencioso

| Teto | Onde | Como aparece |
|---|---|---|
| **370 dias** na série do gráfico de linha | `dashboard_por_dia` | "Todo o período" começa na origem do tempo: sem teto seriam vinte mil pontos. A tela compara o primeiro dia devolvido com o pedido e mostra uma faixa âmbar |
| **10 serviços** no ranking | A tela | Rodapé: *"Mostrando os 10 mais procurados, de 17 com movimento"* |

#### E painel que não sabe diz que não sabe

`supabase.rpc()` **não lança** em erro do banco: devolve `{ data: null, error }`.
Com `?? 0` no caminho de leitura, uma função que falhasse pintaria **zero** em
todos os cartões — e zero é um número, indistinguível de uma empresa parada.
Seria trocar o corte silencioso de mil linhas por um silêncio pior. Hoje o erro
vira faixa vermelha, e o `.catch()` existe para a queda de rede não deixar o
carregador girando para sempre.

### A ordem das colunas do Kanban: o caminho inteiro, e depois o desvio

O array `COLUMNS`, em [`CRM.tsx`](src/pages/CRM.tsx), **é a ordem que aparece
na tela**. Ela tem dois trechos:

```
Iniciou Conversa → Conversando → Agendou → Compareceu → Cliente Recorrente
Cancelou → Follow-up 1 → Follow-up 2 → Follow-up 3
```

O quadro se lê da esquerda para a direita, e a leitura que importa é a do lead
que **dá certo**: chegou, conversou, marcou, veio, voltou. Antes, "Cancelou" e
os três follow-ups ficavam **no meio** dessa sequência, e "Compareceu" — o
desfecho — vinha depois deles: para ver quantos chegaram ao fim era preciso
rolar por cima do que deu errado.

Cancelou abre o segundo trecho porque é o que **produz** os follow-ups —
eles são a tentativa de trazer de volta quem cancelou.

> As outras leituras do array (`STATUS_MAP`, os `some()` do arrastar-e-soltar)
> são por chave e não dependem da ordem. **Reordenar mexe só na tela.**

### Cores das agendas — também são dado

A cor de cada profissional segue a mesma lógica: distingue uma agenda da outra
no calendário, não comunica a marca. A paleta fica em
[`src/lib/cores.ts`](src/lib/cores.ts) — dez cores separáveis entre si e
legíveis com texto branco.

É uma lista fixa de propósito. Um seletor de cor livre garante que, mais cedo ou
mais tarde, alguém escolha amarelo-limão e o bloco suma no fundo branco. O banco
aceita qualquer hex válido, então ampliar a paleta não exige migração — e
`fundoSuave()` tem fallback para cores fora da lista.

### A barra lateral: a marca em cima, o mouse com resposta

Três decisões, e nenhuma é só tamanho de fonte:

**A logo fica acima do nome, não ao lado.** Em linha ela cabia em 32px,
disputando largura com o nome numa barra de 220 — do tamanho de um ícone de
menu. Empilhada, ela vai a 48px e vira a identidade da empresa, que é o que
ela é. O bloco é **um só** para aberto e recolhido: eram duas cópias da mesma
marcação, e mudar o tamanho em uma delas era o erro esperando acontecer.

**O ícone cresce quando a barra encolhe** (20 → 22). É o contrário do
instinto, e é o certo: sem o rótulo ao lado, o ícone deixa de ser enfeite e
passa a ser a única coisa que separa Agenda de Conversas.

**O hover é estado do React, não `style.background` mexido na mão.** Os botões
do menu do rodapé fazem no DOM direto, e ali funciona porque aquele elemento
não re-renderiza. Um item de navegação re-renderiza a cada troca de rota — e o
item que você acabou de clicar ficaria com o realce preso.

A regra de cor mora em `fundoDoItem()`, e existe para os dois não se
confundirem:

| Estado | Fundo | Diz |
|---|---|---|
| Normal | transparente | — |
| Sob o mouse | `#EDF2F4` (divisória) + texto `#16232B` | "dá para clicar" |
| Ativo | `MARCA_SUAVE` (fundo suave) + `MARCA` | "você está aqui" |
| Ativo, sob o mouse | `#DCE6EA` (borda) | idem, e o mouse responde |

> **O hover neutro e o ativo na cor, de propósito.** Pintar o hover com a cor da
> marca faria todo item parecer o item ativo por meio segundo. E o ativo também
> escurece: sem isso, a página em que você está seria a única da barra que não
> reage ao mouse.

### Cores dos balões da conversa

Três vozes na tela **Conversas**, e elas precisam ser distinguíveis sem
esforço — principalmente onde uma pessoa entra no lugar da IA.

| Quem | Fundo | Texto | Lado |
|---|---|---|---|
| Cliente | `#FFFFFF` + borda `#DCE6EA` | `#16232B` | esquerda |
| Atendente IA | `MARCA` (a cor do sistema) | `#FFFFFF` | direita |
| Equipe | `#16232B` (Texto) | `#FFFFFF` | direita |

**As duas cores cheias são as duas cores mais fortes da identidade** — nada de
cor nova, e o resultado combina com o resto do sistema. A primeira versão usava
branco contra o fundo suave da marca: dois quase-brancos que, de relance,
viravam a mesma coisa. É também por isso que o seletor de cor não oferece
cinza: o balão da IA ficaria quase igual ao da equipe.

Cor não é o único sinal: o rótulo acima do balão traz um ícone (`Bot` para a
IA, `UserCheck` para a pessoa) e aparece sempre que o autor muda.

### O Agente de IA tem dois nomes, e isso é proposital

| Onde | Como aparece |
|---|---|
| Nas telas da equipe | **Atendente IA · Letícia** — o crachá antes do nome |
| Na conversa com o contato | **Letícia**, e só |

A equipe precisa saber de relance que quem respondeu foi a IA, e não uma colega.
O contato, não: o prompt proíbe — em regra inegociável — que ela diga ser
assistente virtual, inteligência artificial, bot, robô ou sistema.

**São dois públicos e dois contratos.** Mas são o mesmo **nome**.

### O nome é dado; o cargo é código

Até a migração `0019` os dois lados guardavam o nome separado —
`src/lib/agente.ts` e `agente-ia/prompt.md` —, e renomear exigia editar dois
sistemas que não se falavam, torcendo para nenhum ficar para trás.

Agora:

| O quê | Onde mora | Por quê |
|---|---|---|
| **O nome** (`Letícia`) | `configuracoes_agente.nome_agente` | Cada empresa escolhe o seu. Em código, seria um deploy por empresa |
| **O cargo** (`Atendente IA`) | [`src/lib/agente.ts`](src/lib/agente.ts) | É o que ela faz, não como se chama. "Atendente", e não "Secretária": serve de oficina a escritório, e não tem gênero — um ramo que prefira "Secretária" troca lá, e só lá |
| **O nome da página** (`Atendente de IA`) | idem | Trocar "Letícia" por "Sofia" não deve renomear a tela |

As telas leem pelo `useAgente()` — um `useSyncExternalStore` alimentado uma vez
por sessão pelo [`Layout.tsx`](src/components/Layout.tsx), que é o único
componente por onde toda tela autenticada passa. O prompt lê pelo marcador
`{{NOME_AGENTE}}`.

> ⚠️ **Frase nova que fale dela usa `useAgente()`, nunca a palavra.** Treze
> frases da interface tinham "Letícia" digitado à mão, e elas continuariam
> falando de uma pessoa que não existe mais no dia em que a empresa renomeasse.
> Meia renomeação é pior que nenhuma.

**O campo na tela é só leitura, e isso é decisão de produto, não limitação.** A
coluna é gravável e a tela poderia editá-la em três linhas. O campo é inerte
para que trocar o nome seja um ato deliberado, feito no projeto por uma IA com
o repositório aberto — e não um clique de passagem numa página que a equipe
abre todo dia. Trocar o nome no meio da operação confunde quem fala com ela há
meses, e vale para toda conversa em andamento.

> Se um dia isso mudar, o que falta é o `update` e uma chamada a
> `definirNomeDoAgente()` — que existe e é o que faz as treze telas
> acompanharem sem recarregar.

### Lista ou card, e o que decide

As duas listagens da empresa não têm a mesma forma, e a diferença não é gosto:

| Tela | Forma | Por quê |
|---|---|---|
| **Profissionais** | linhas empilhadas | Um profissional é **nome, cor, jornada e os serviços que faz** — dados curtos que cabem numa linha. São poucos, e a cor à esquerda já separa um do outro. |
| **Serviços** | grade de cards | Um serviço é **um parágrafo**. Na clínica de origem, eram vinte. Vinte linhas com a descrição espremida numa faixa fina viram uma parede que o olho não separa. |

A regra: **quando o item tem texto corrido, ele quer um card**; quando é um
punhado de campos curtos, a linha é mais densa e melhor.

No card, os botões que agem sobre o item ficam **dentro dele** — não numa coluna
à direita, longe do nome, onde é fácil clicar no serviço vizinho.

Mas **só o que é ciclo de vida**: ativar, editar, excluir. O que é conteúdo ou
regra — as descrições, o fluxo de agendamento, o valor — mora no modal de
Editar. A diferença é o custo do erro: religar um serviço desligado por
engano é um clique; mudar o fluxo de agendamento sem perceber muda o que a
Letícia marca para quem escreve.

> **O rodapé do card não esmaece junto.** Desligar um serviço apaga o corpo
> (`opacity: 0.5`), mas não o rodapé: apagar o botão que religa é apagar a saída.

### O filtro de período: uma lista, e um botão ao lado

Dashboard, CRM, Leads e Clientes recortam o mesmo período — com o mesmo
componente ([`FiltroPeriodo.tsx`](src/components/FiltroPeriodo.tsx)) sobre a
mesma regra ([`src/lib/periodo.ts`](src/lib/periodo.ts)). Duas páginas tinham
`getPeriodRange` copiada palavra por palavra, e já com formatação diferente uma
da outra — que é como duas cópias começam a divergir.

Todas recortam por **`created_at`**: *quando a pessoa chegou*. É a leitura de
funil — "dos que entraram em agosto, onde eles estão agora?" —, e não "quem se
mexeu em agosto".

Eram **nove pílulas** numa faixa que quebrava em duas linhas em tela estreita e
empurrava a página para baixo. Nove opções lado a lado também não têm
hierarquia: "Hoje" e "Ano passado" pediam o mesmo esforço de leitura, sendo que
uma é escolhida todo dia e a outra quase nunca.

**Mas "Personalizado" não entrou na lista — ele não é um período, é um modo.**
Como nona opção, escolhê-lo fechava a lista e deixava lá a palavra
"Personalizado", que não diz de quando até quando: para saber o recorte era
preciso abrir a lista de novo. Fora dela, ele acende junto com os dois campos
de data — e as datas são a resposta.

> Enquanto o modo está ligado, a lista mostra um item apagado
> ("Período personalizado") em vez de afirmar "Este mês" com outro recorte
> valendo. **Escolher qualquer período nela desliga o modo** — é o caminho de
> volta, sem precisar de um segundo botão para isso.

#### Três meses fechados no meio, e "Todo o período" no fim

A lista deixou de ser constante e virou `periodosFixos()`, **porque três dos
itens dependem de que dia é hoje**: *Julho*, *Junho*, *Maio* — os três meses
anteriores ao "Mês passado". Como constante, seriam montados uma vez quando o
módulo carrega e ficariam **presos no mês em que a aba foi aberta**.

| Detalhe | Por quê |
|---|---|
| A chave é `month:AAAA-MM`, e não "dois meses atrás" | Guardada numa URL ou num estado, uma chave relativa apontaria para outro mês no dia seguinte |
| O ano só aparece quando não é o corrente | Em janeiro, "Novembro" pelado ao lado de "Este ano" faz pensar que é novembro deste ano |
| `'all'` devolve uma faixa começando na origem do tempo | E não um "sem filtro": assim toda tela continua tendo **sempre** uma faixa, e nenhuma precisa de um caminho especial para "não filtrar" |

> ⚠️ **`periodosFixos()` lê o relógio, então não pode ser chamada durante a
> renderização** — o `react-hooks/purity` reprova, com razão. Use
> `useState(() => periodosFixos())`.

#### O padrão do CRM é outro, de propósito

Dashboard, Leads e Clientes abrem em **"Este mês"**. O CRM abre em **"Todo
o período"**.

Os três primeiros são relatório: recortar um mês é a pergunta normal. O CRM é
**quadro de trabalho** — e um lead que chegou em junho e ainda está em
"Follow-up 2" é exatamente quem precisa ser lembrado. Abrir escondendo essa
pessoa seria esconder o trabalho.

Isso só é seguro por causa do teto por coluna, logo abaixo.

### O CRM tem teto por coluna, e o resto é um caminho

Uma coluna do Kanban desenha no máximo **50 cards** (`TETO_POR_COLUNA`, em
[`CRM.tsx`](src/pages/CRM.tsx)). O que sobra vira um rodapé clicável:
`+ 312 outros`.

**O motivo principal não é desempenho — é que uma coluna com 300 cards já é
inútil.** Ninguém rola 300 cards procurando alguém. A coluna serve para ver
quantos estão em cada etapa (o número do cabeçalho continua sendo o **total**,
não o desenhado) e mexer nos mais recentes. Procurar é trabalho da lista, que
tem busca.

O desempenho vem junto, e é real: cada card é um alvo de arrastar, e o
`closestCorners` compara a posição do card na mão com a de **todos** os alvos
registrados a cada movimento do mouse. Quem sente é quem arrasta, não quem
abre.

> ⚠️ **O filtro de período NÃO substitui o teto.** Filtro é escolha de quem
> usa, e o padrão desta tela é "Todo o período": sem o teto, o padrão seria o
> pior caso.

**O "+ N outros" leva para a lista, e não abre um exportador aqui.** Leads e
Clientes já são essa lista — com busca por nome e telefone e os botões de
exportar CSV e PDF, que já respeitam os filtros ligados. O que faltava era
poder perguntar *"quem está em Follow-up 2?"*, e isso passou a existir lá:

```
/leads?etapa=follow_up_2_feito&periodo=all
```

| Detalhe | Por quê |
|---|---|
| **O período viaja na URL junto com a etapa** | Sem isso o CRM prometeria "+312 outros" e a lista abriria no padrão dela ("Este mês") mostrando 40 — o número da tela anterior viraria mentira no clique |
| **O destino muda com a etapa** | "Compareceu" e "Cliente Recorrente" moram em **Clientes**. Quem sabe disso é `isPaciente()`, a mesma regra do "voltar" da ficha |
| **A etapa vira etiqueta com "✕", não uma lista suspensa** | Ela não é escolhida ali: é um recorte que veio de outra tela. A etiqueta diz o que está valendo e como sair, de uma vez — e não cobra espaço permanente por algo quase nunca escolhido dali |
| **Etapa que não é daquela página tem aviso** | Acontece com URL digitada à mão. Sem a linha, o resultado seria uma lista vazia sem motivo aparente |

**O card arrastado vai para o TOPO da lista.** A ordem da lista é a ordem
dentro da coluna, e ela vem por `created_at` decrescente — só trocar o status
colocaria um lead antigo na posição 150 da coluna de destino, ou seja, **atrás
do teto**: ele sumiria da tela logo depois de você soltá-lo.

### O teto de 1000 do servidor, dito em voz alta

`max_rows` do projeto é **1000**. Pedir "todos os leads" devolve no máximo isso
— **sem erro, sem marcação, sem nada**. No lead 1001 a tela mostra menos gente
e ninguém fica sabendo.

O CRM pede `count: 'exact'` junto com as linhas: o `Content-Range` traz o total
de verdade mesmo quando as linhas são cortadas. Se o total for maior que o que
chegou, uma faixa âmbar diz *"mostrando os 1000 mais recentes de 1240"*. Não
sobe o teto; troca um erro invisível por um aviso.

> **E o `order` explícito deixou de ser enfeite.** Quando o servidor corta, é
> ele que decide **quais** sobram. Sem ordem, sobram linhas arbitrárias; com
> `created_at` decrescente, sobram as mais recentes — que é a única resposta
> defensável.

> ⚠️ **O Dashboard tinha o mesmo teto, e foi tratado à parte.** Lá era pior:
> as contas ficavam **erradas**, não incompletas. E o conserto foi de outro
> tipo — contar no banco em vez de trazer as linhas e contar na tela: é a
> `0024`, contada em "O Dashboard não carrega pessoas", acima. Foi tarefa
> própria, porque mexer nisso de raspão é a melhor forma de não perceber um
> número errado.

### Serviço é vocabulário fechado, em toda porta

"Qual o serviço mais procurado?" não tinha resposta. A mesma coisa entrava com
várias grafias — na clínica de origem, `Lentes de Contato`, `lente de contato`,
`lentes` e `lente pro dente` —, quatro linhas do mesmo serviço num relatório,
sem nada avisar que era uma só.

Eram quatro portas de texto livre, e todas foram fechadas:

| Porta | Agora |
|---|---|
| Modal **Novo Lead** / **Novo Cliente** | Caixas de seleção com os serviços ativos |
| Modal **Novo Agendamento**, na Agenda | Lista suspensa, **sem campo livre** |
| `atualizar_ficha` (a Letícia) | `enum` no JSON Schema, montado a cada mensagem |
| `agenda_marcar` (Letícia e API) | Recusa com `procedimento_desconhecido` |

E o banco confere por baixo, nas duas tabelas (migração `0022`).

A ficha do lead ([`LeadDetail.tsx`](src/pages/LeadDetail.tsx)) tem mais duas,
e as duas contam uma lição diferente:

| Porta | História |
|---|---|
| **Serviços de Interesse**, na ficha | Era só leitura, e **já nasceu fechada** quando virou editável. Porta nova de vocabulário nasce com a lista, nunca com um campo de texto |
| Modal **Novo Agendamento**, na ficha | **Ficou para trás na padronização.** Continuou texto livre depois da `0022` — e desde então digitar "Limpeza" ali batia na trigger e voltava como *"Erro ao salvar consulta"*, sem motivo. Hoje é a lista do catálogo, como as outras |

> ⚠️ **Campo livre contra uma trava do banco não é liberdade: é um erro
> escondido.** A `0022` fechou o banco e quatro telas; a quinta só apareceu
> semanas depois, quando alguém foi usá-la. **Ao fechar um vocabulário,
> procure TODAS as telas que escrevem naquela coluna** — `grep` pelo nome da
> coluna, não pela memória de onde ela é usada.

**`enum` não é um pedido, é uma trava.** "Use o nome exato" no prompt é
instrução, e instrução às vezes é atendida. `enum` no schema faz os dois
fornecedores restringirem a saída à lista — o modelo **não consegue** escrever
outra coisa. Medido em 01/09/2026 com o `gpt-4.1-mini`, sobre o catálogo da
clínica de origem:

| O paciente disse | Ela gravou |
|---|---|
| "colocar aquela lente no dente" | `Lentes de Contato` |
| "aparelho invisível" | `Alinhadores Transparentes` |
| "arrancar o siso" | `Extração de Siso` |
| "lente E clarear os dentes" | `Lentes de Contato`, `Clareamento Dental` |
| "botox e preenchimento labial" | *(nada)* — e não o mais parecido |
| "implante de cabelo" | *(nada)* — não virou `Implante Unitário` |

Os dois últimos são o teste que importa: **traduzir é bom, forçar é pior que
não gravar.**

> ⚠️ **A lista entra no schema a cada mensagem**, lida de `servicos_clinica`.
> Fixa no código, ela envelheceria no dia em que a empresa cadastrasse mais um
> serviço — e o sintoma seria a Letícia não conseguir marcar algo que está
> na tela dela. Se a leitura falhar, o campo volta a ser texto livre: `enum`
> vazio é recusado pelos fornecedores, e o resultado seria ela parar de
> responder. Grafia solta é ruim; atendente muda é pior.

**A pessoa quer mais de uma coisa, e agora cabe.** `procedimentos_interesse` é
`text[]`. `procedimento_interesse` continua existindo **calculada na view**
(os itens juntados por vírgula), e é por isso que CRM, Dashboard, exportação,
ficha e prompt não mudaram uma linha. **Nunca grave nela** — é o mesmo aviso de
`minutos_ultima_mensagem`.

**No agendamento não há escape de "Outro".** O catálogo é editável em
Serviços e cadastrar o que falta leva dez segundos; um campo livre de
emergência vira o caminho normal em duas semanas. O modal diz onde cadastrar.

> **A trava do banco exige EXISTIR, não estar ativo.** Desativar um
> serviço não pode quebrar o reagendamento de quem já marcou. Já o
> `agenda_marcar` exige ativo — ele cria agendamento novo, e isso é outra
> pergunta.

### A porta de entrada é opcional, e por isso não é um card

Numa clínica, quase todo tratamento passa antes por uma avaliação: o
profissional examina, conversa e monta o plano. Numa barbearia, ninguém avalia
antes do corte. A **porta de entrada** é o serviço que vem antes dos outros —
"Avaliação", "Orçamento", "Consulta inicial" — e **cada empresa decide se tem
uma** (migração `0026`). O kit odontológico traz a Avaliação Odontológica como
porta, com duas exceções que agendam direto: Limpeza e Clareamento.

| Decisão | Por quê |
|---|---|
| **"Nenhuma porta" é um estado normal** | O bloco no topo de Serviços diz em tom neutro que a atendente agenda tudo direto, e oferece escolher uma. Era uma faixa **vermelha** de erro — para uma barbearia, o sistema acusando defeito no jeito certo de ela trabalhar |
| **Escolher e deixar de usar moram no bloco, não no modal** | São regras da empresa inteira, não de um serviço. Escolher pede a lista e um botão; deixar de usar pede confirmação, que diz o que acontece com os outros |
| **Deixar de usar não apaga a marcação dos outros** | "Passa pela porta" fica guardado e **sem valer**, e volta a valer se uma porta for escolhida de novo. Desligar por engano não custa refazer vinte cards. Por isso o card e o modal olham o que **vale** (`exige_avaliacao` **e** porta existindo), nunca só a coluna |
| **A porta existe como registro** | Seria mais fácil ter o nome dela no código. Mas aí a duração do bloco, a gratuidade e o próprio nome ficariam presos num deploy. Aqui a empresa muda os três, e a mudança chega na conversa seguinte |
| **Mas fora da grade de cards** | Ela não é um serviço comum, é por onde os outros começam. No meio dos vinte ela vira o vigésimo card igual — sendo o agendamento que mais vai acontecer |
| **Uma caixa, não três categorias** | "Passa pela porta de entrada", ligado ou desligado. A versão de três níveis foi descartada: duas delas mandavam o agente fazer exatamente a mesma coisa, e categoria que não muda comportamento só serve para ser preenchida errado |
| **A caixa mora no modal de Editar — e só existe com porta** | É decisão que se toma pensando, uma vez. O card **mostra** o resultado (com serviços do kit, "Antes: Avaliação Odontológica" / "Agenda direto · a partir de R$ 250"). Sem porta, a caixa some: ela não mudaria nada |
| **Serviço novo grava a regra, não herda do banco** | Com porta, nasce passando por ela (o lado seguro); sem porta, nasce direto. O padrão da coluna virou `false` na `0026` e só vale para quem insere por fora da tela |
| **Uma porta no máximo, garantida por índice** | `servicos_clinica_avaliacao_unica` é parcial (`where e_avaliacao`). Duas portas seriam duas respostas para a mesma pergunta |
| **A trava mora na função SQL** | `agenda_marcar` recusa, e devolve o nome da porta. Prompt é pedido, não trava — a Letícia já ignorou regra escrita com o dado na frente dela. E como as duas portas dos agentes descem para a mesma função, a API externa herda a regra de graça. **Sem porta, ela marca direto** |
| **A recepção passa por fora** | `NovoAgendamentoModal` grava direto em `consultas`. A regra existe para impedir um **agente** de decidir pela empresa, não para impedir a empresa de marcar o que quiser |

**O preço tem três estados, e o do meio é o que vale.** Vazio, ela não fala
valor; `0`, a lista diz **"Sem custo"**; acima de zero, "a partir de R$ X".
Zero não é campo em branco: é a frase que derruba a objeção de quem não quer
pagar só para saber o preço — e sem ela a resposta vira "o valor a gente vê
depois", que soa como desconversa.

> **"Sem custo", e não "Gratuita".** O adjetivo concordava com "avaliação", mas
> o nome da porta é dado ("Orçamento") e qualquer serviço com zero recebe a
> frase. É contrato com o `prompt.md`: mudou lá, muda na view.

> **O campo de valor some do modal quando o serviço passa pela porta — e o
> salvamento grava `null`.** Preço ali nunca seria falado, e campo que existe
> sem ser usado é campo preenchido errado. É a mesma ideia da caixa única: um
> estado contraditório não deve ser representável, nem na tela nem no banco.

**A porta de entrada também só mostra.** Nome, textos, duração e valor dela se
mudam no mesmo modal dos outros. Campo editável no bloco *e* no modal seria a
mesma coisa em dois lugares, e um dia os dois discordariam.

**E o card não mostra a frase que ela vai falar.** A frase é montada pela view
`procedimentos_clinica_agente`, em SQL. Reimplementá-la no TypeScript daria duas
versões da mesma regra, e um dia a tela mostraria uma coisa e o contato ouviria
outra. O card mostra o **dado**. (A prévia da aba Empresa escapa disso porque
consulta a view de verdade; uma consulta por card seria absurda.)

### Os serviços que cada profissional faz: lista vazia = todos

Numa barbearia, o João corta e faz barba; a Ana só faz coloração. Até a
migração `0027` a agenda não sabia disso: a escolha automática pegava o
primeiro livre em ordem alfabética, e a atendente marcava coloração com o João
porque ele estava livre às 14h.

| Decisão | Por quê |
|---|---|
| **Lista vazia = faz todos** | O campo é opcional e a resposta mais comum é "tudo". Quem nunca preencheu nada continua como sempre foi — a mudança não pegou ninguém de surpresa, e nenhum agendamento mudou de dono |
| **A tela diz isso com todas as letras** | "Nenhum marcado: faz todos os serviços, inclusive os que forem cadastrados depois." Sem a frase, vazio pareceria "não faz nada" — e alguém marcaria tudo à mão, deixando cada serviço novo fora da agenda dessa pessoa |
| **A regra mora em `profissional_faz()`, no banco** | Escolha automática, disponibilidade, marcar e remarcar descem para ela. A cópia em [`servicosDosProfissionais.ts`](src/lib/servicosDosProfissionais.ts) existe só para a tela **avisar** — mudou uma, mude a outra |
| **Pedir quem não faz é recusa com saída** | `profissional_nao_faz` vem com `quem_faz`. "A Ana não faz corte" sozinho obrigaria a atendente a chutar outro nome |
| **A atendente lê "Só faz: ..."** | Na view de profissionais, só em quem tem lista. Sem isso ela ofereceria a Ana para um corte e a agenda recusaria na hora de marcar, na frente do cliente |
| **Com porta de entrada, vale a lista da porta** | No kit de clínica, quem pede lentes sai com a avaliação marcada: os horários oferecidos são os de quem faz a avaliação, na duração dela (`servico_a_agendar()`) |
| **A recepção passa por fora, e é avisada** | [`AvisoForaDaLista`](src/components/AvisoForaDaLista.tsx), âmbar, nas **três** telas que marcam com profissional e serviço — Agenda, ficha e cadastro. Um componente só, para as três falarem igual. Encaixe consciente é da empresa |

> ⚠️ **Apagar o único serviço da lista de alguém devolve a pessoa para "faz
> todos"** — o `cascade` tira a linha, e lista vazia é lista vazia.
> **Desativar** não tem esse efeito. Detalhes na seção 4.7.1 do
> [`DATABASE.md`](DATABASE.md).

### O que a pessoa quer aparece ao lado do que está marcado

Com uma porta só — no kit de clínica, a Avaliação Odontológica —, o
profissional abriria a quinta-feira e veria oito "Avaliação Odontológica"
idênticas. Por isso o bloco da Agenda mostra
`Avaliação Odontológica · Lentes de Contato`, montado por
`procedimentoComInteresse()` em [`src/lib/agenda.ts`](src/lib/agenda.ts).

O dado é `consultas.interesse`, **congelado no ato de marcar** — e não o
`procedimento_interesse` do CRM, que é da pessoa e guarda um valor só. Quem veio
por lentes em março e por canal em agosto tem o último; olhar o agendamento de
março mostraria "canal", que é falso.

### O cadastro pergunta quando, e a ficha aceita conserto

Duas telas mudaram pelo mesmo motivo: **o dado existia na cabeça de quem
digitava e não tinha onde entrar.**

#### O cadastro cria o agendamento

"Novo Cliente" gravava `consulta_realizada` sem dizer **quando**. A coluna
"Último Atendimento" ficava em *"Cadastrado à mão"* para sempre, o histórico da
pessoa nascia vazio, e a data da última visita — que é o dado inteiro de uma
ficha migrada — não tinha campo.

Agora o cadastro cria o agendamento junto — e **quem decide tudo é a data**:

| A data | O agendamento nasce | A pessoa entra como |
|---|---|---|
| **vazia** | nenhum | **Lead** |
| **no passado** | `realizada` | **Cliente** |
| **no futuro** | `agendada` | **Lead**, com a etiqueta "Agendou" |

**O seletor "Lead / Cliente" foi removido, e essa é a decisão que carrega as
outras.** Ele perguntava *"já foi atendido?"* ao lado de um campo de data
que responde a mesma coisa — e melhor, porque a data traz o **quando** junto.

Enquanto os dois existiram, cada combinação precisou de uma regra, e uma delas
virou um erro na cara de quem estava certo: marcar "Cliente" com data no
futuro era **recusado** (*"uma consulta já realizada não pode estar no
futuro"*), quando a leitura óbvia era um cliente com agendamento marcado. O
seletor não conseguia decidir o que prometia decidir.

> **Controle que não decide mais nada não é inofensivo.** Ele promete uma
> escolha e o sistema faz outra coisa. Foi por isso que ele saiu inteiro, em
> vez de ganhar mais uma regra.

Duas decisões menores que sobreviveram:

| Decisão | Por quê |
|---|---|
| **Só a data e a hora ficam à vista**; serviço, agenda e duração nascem quando ela é preenchida | Um formulário de agendamento inteiro sempre aberto num campo **opcional** é peso cobrado de quem não vai usá-lo |
| **A frase embaixo do campo muda no instante em que a data cruza o presente** | "Passado vira Cliente e futuro não" seria, sem ela, uma regra que só se descobre depois de salvar |

> **E o botão diz o que vai SAIR, não como a página se chama:** *"Cadastrar
> como Cliente"* ou *"Cadastrar como Lead"*. Quem abriu "Novo Cliente" e
> não deu data leva um Lead — e precisa saber disso antes de clicar. Depois
> de salvar, a página já leva você até a lista certa; isso `handleNewLeadSaved`
> sempre fez.

> ⚠️ **A data no passado assume que a pessoa COMPARECEU** (`realizada`), e não
> há como dizer o contrário por aqui. É o caso raro de cadastrar alguém novo
> por um agendamento que já passou e ainda não teve baixa — a saída é cadastrar
> sem data e usar "Novo Agendamento" na ficha, que tem o seletor de status.

> ⚠️ **O agendamento é inserido DEPOIS da pessoa, e os dois não estão na mesma
> transação.** Quando o segundo falha (tipicamente `23P01`, o horário ocupado),
> a pessoa **já está no banco** — então o erro diz isso com o nome dela, e o
> modal guarda o que criou. Sem isso, tentar de novo bateria no WhatsApp
> duplicado, mandando procurar defeito no número de quem acabou de entrar.

> **E o lead é relido depois do agendamento marcado.** Quem move o funil é o
> trigger `consultas_sincroniza_lead`, no banco — a linha que o `insert`
> devolveu é anterior a ele. Sem reler, a lista mostraria `iniciou_conversa`
> para alguém que acabou de ficar com agendamento marcado — que é **o caminho
> normal** de quem marca para o futuro.
>
> (Conferido no banco: agendamento inserido direto com `realizada` **não** mexe
> no funil — aquele ramo do trigger só roda em `UPDATE`. É por isso que o
> `insert` da pessoa já grava `consulta_realizada` quando a data está no
> passado, em vez de esperar um trigger que não vai disparar.)

#### A ficha do lead virou editável

Nome, WhatsApp e serviços de interesse eram **só leitura** ali. Um nome que a
Letícia entendeu errado, ou um número digitado torto, só tinham conserto pela
IDE.

| Decisão | Por quê |
|---|---|
| **Um "Salvar" para a ficha inteira** | Seis campos, seis botões seria um cartão de botões. O assunto é um só — "os dados desta pessoa". Status e Anotações continuam com o seu, porque são outras perguntas |
| **O botão só acende quando há o que salvar**, e diz "Nada mudou por aqui" quando não há | Botão apagado sem motivo escrito parece botão quebrado |
| **A pendência é comparada com o que está GRAVADO** | Não com um sinalizador de "mexeu". Mexer e voltar ao valor original deixa de contar, e o salvar zera tudo sozinho — não há um `setSujo(false)` para alguém esquecer num `onChange` novo |
| **O WhatsApp usa o mesmo `CampoTelefone` do cadastro** | A regra de país e de contagem de dígitos mora num lugar só |
| **O resumo continua só leitura** | Quem escreve é a Letícia, por `atualizar_ficha`. Editá-lo aqui seria apagar à mão o que ela reescreve na mensagem seguinte |

> ⚠️ **Campo não tocado não entra no `update`.** O `CampoTelefone` manda `''`
> tanto para "apagou" quanto para "está no meio de digitar" — os dois são
> inválidos para ele. Sem um `whatsappTocado`, sair da ficha com o número pela
> metade **zeraria o WhatsApp da pessoa**, que é a chave por onde a Letícia a
> encontra.

> **O que a tela mostra depois de salvar é a linha que o banco devolveu**
> (`.select().single()`), e não o que foi enviado. A trigger
> `crm_procedimentos_validos` **normaliza a grafia e reordena o array**, e
> `procedimento_interesse` é calculada na leitura — espelhar isso à mão daria
> uma tela que discorda do banco até o F5.

**As duas recusas do banco têm frase própria:** `23505` (o WhatsApp já é de
outra pessoa, e o aviso leva até ela) e `23514` (serviço que saiu do
catálogo). Conferidas no banco, em 01/09/2026.

### A página da Atendente de IA: a ordem é a de quem chega

Os cards seguem quatro perguntas, nesta ordem:

| # | Card | Responde |
|---|---|---|
| 1 | **Estado** | Está funcionando agora? |
| 2 | **A atendente** — nome, modelo **e** prompt | Quem é ela, quem pensa por ela, e o que ela diz |
| 3 | **Conexão do WhatsApp** | Por onde ela fala |
| 4 | **Modo de teste** | Para quem ela responde |
| 5 | **Ligar e desligar** | O interruptor |
| 6 | **Apagar uma pessoa** | A zona de perigo |
| 7 | **Salvar** — a barra | Falta alguma coisa? |

**Nome, modelo e prompt moram no mesmo card.** Estavam espalhados em três
cards, com a conexão e o modo teste no meio — e respondem à mesma pergunta:
*com quem estou lidando?* O nome é a identidade, o modelo é a cabeça, o prompt
é o que ela sabe dizer.

> **O prompt nasce fechado, atrás de um "Ver o prompt".** São umas duzentas
> linhas: aberto, empurrava a página inteira para fora da tela — e quase nunca
> é o que a pessoa veio ver. Só ao abrir ele é buscado na função publicada;
> fechado, não custa uma requisição sequer.

**E ele é só leitura, como o nome — pelo mesmo motivo, com um agravante.** A
tela editava o prompt e gravava em `configuracoes_agente.prompt`, criando uma
versão **que não ia para o Git**. No dia em que alguém precisasse entender por
que a Letícia mudou de comportamento, não haveria histórico nenhum — e o
`prompt.md` continuaria descrevendo uma agente que não existe mais. Hoje o card
mostra qual dos dois está no ar, e manda editar pelo
[`prompt.md`](agente-ia/prompt.md).

> A coluna continua gravável, e um valor antigo continua valendo — a tela só
> não escreve mais nela. Para voltar ao oficial, é `prompt = null`, pela IDE.

### O seletor de modelo: por empresa, e o que não dá para usar aparece desligado

Oito modelos numa coluna só, com "GPT" e "Claude" se intercalando, não responde
a pergunta que vem primeiro: **de qual empresa dá para usar?** Por isso a lista
virou um bloco por fornecedor, com uma etiqueta de estado no cabeçalho, e uma
grade de dois cards por linha dentro dele.

| Decisão | Por quê |
|---|---|
| **Bloco por empresa** | A chave é por fornecedor, não por modelo. Sem chave da Anthropic, os dois Claude caem juntos — e um cabeçalho diz isso uma vez, em vez de dois cards repetirem o mesmo aviso |
| **Card, e não lista suspensa** | O que decide a escolha é a nota ("o mais barato", "raciocina antes", "a mais cara"). Num `select` ela não cabe. Mesma regra dos Serviços: item com texto quer card |
| **O indisponível aparece desligado, não some** | Sumir não responde "cadê o GPT-5?". Desligado com o motivo escrito responde, e ainda diz o que fazer para liberar |
| **O motivo não esmaece junto com o card** | O corpo do card apaga; a linha do impedimento fica em âmbar cheio. Apagar a explicação de um item desligado é apagar a saída — o mesmo do rodapé dos Serviços |
| **Enquanto não sabemos, nada é desligado** | `useChavesIA()` devolve `null` até a função responder, e `null` é **não sei**, não "não tem". Trancar a tela numa falha de rede de meio segundo é o erro do `webhook: 'desconhecido'`, ao contrário |

> ⚠️ **O aviso mais importante é sobre o modelo que está VALENDO**, e não sobre
> os desligados. Se a configuração gravada apontar para um modelo sem chave, o
> card dele está no meio da grade como qualquer outro — mas a atendente **não
> responde ninguém**, e nada na tela diria isso. Por isso existe uma faixa
> separada, embaixo da grade: *"Claude Opus 5 está em uso, e não pode
> responder."*

**A lista é curta, e foi conferida contra a conta de verdade.** A conta da
clínica de origem enxerga 47 modelos da OpenAI; o seletor oferece seis. Cada um foi
chamado com ferramenta, em 01/09/2026, antes de entrar — e três candidatos
foram recusados ali:

| Modelo | O que aconteceu |
|---|---|
| `gpt-5`, `gpt-5-mini` | *"Your organization must be verified"* — a OpenAI exige verificar a organização |
| `gpt-5.6-luna` / `-sol` / `-terra` | Não aceitam ferramenta em `/v1/chat/completions`; exigiriam a Responses API, que é outra integração |

O `gpt-5` ficou na lista, **desligado e com o motivo** — é o que a empresa
procura pelo nome. Os outros dois não: `gpt-5-mini` repetiria o mesmo recado, e
os `5.6` não são "bloqueados", são de outra API.

> **Modelo que existe na documentação e não responde nesta conta é um card que
> promete e falha.** A lista de `src/lib/modelosIA.ts` carrega essa data — quem
> for acrescentar um modelo, chame antes.

### O Salvar não é um card, é uma barra — e ela gruda no rodapé

Ele morava no meio da página, entre "Modo de teste" e "Ligar e desligar", e do
tamanho do "Adicionar" de um número de teste. **Quem trocasse o modelo lá em
cima e não rolasse até ele saía da página achando que tinha trocado** — e nada
dizia o contrário, porque a tela já mostrava o valor novo: o estado local muda
no clique, só o banco é que não.

Quatro decisões, e nenhuma é tamanho de botão:

| Decisão | Por quê |
|---|---|
| **Por último, depois até da zona de perigo** | É a última coisa da página, e a sequência da leitura termina nela |
| **Mas com forma de barra, não de card** | Colado embaixo de "Apagar uma pessoa", um card pareceria salvar *aquilo*. Sombra e altura diferentes dizem "isto é da página inteira" |
| **`position: sticky`, não `fixed`** | `fixed` precisaria saber onde a barra lateral termina — e ela encolhe. E viveria dentro do `ModalPortal`, pelo problema do `transform`. `sticky` fica na coluna do conteúdo sozinho |
| **E é o ÚLTIMO elemento do DOM** | Sticky no meio da página desgrudaria com um salto ao chegar no fim do elemento-pai. Como último, ele desce suave e assenta |

**Ele gruda só quando há o que salvar.** Sem pendência, `position: static` e a
barra fica quieta no fim: uma linha branca dizendo "Tudo salvo", com o botão
apagado. Barra pinçada no rodapé o tempo todo é um pedaço de tela cobrado para
sempre por um aviso que quase nunca vale.

**E ela diz o que mudou, não que "algo" mudou.** *"Você mudou o modelo e o modo
de teste, e ainda não salvou"* — porque quem chega na barra depois de mexer em
três cards não lembra em quais. A frase é montada por `listar()`, com vírgula
até o penúltimo e "e" no último.

> **A pendência é calculada contra o que está gravado, e não com um sinalizador
> de "sujo".** `alteracoes` compara `modelo`, `modo_teste` e `numeros_teste`
> com o `cfg` que veio do banco. Duas consequências boas de graça: mexer e
> voltar ao valor original **deixa de contar** como alteração, e o
> `setCfg(data)` do salvar zera tudo sozinho — não há um `setSujo(false)` para
> alguém esquecer num `onChange` novo.

> ⚠️ **O que NÃO passa pelo Salvar continua não passando.** Ligar/desligar e
> apagar uma pessoa gravam no clique, e a barra diz isso na frase de repouso.
> Sem essa linha, a barra vermelha do desligar pareceria depender dela.

### O interruptor fica no fim da página, e não no painel de estado

O botão de desligar estava dentro do card verde de "está atendendo". Saiu de lá
por dois motivos:

1. **Aquele card é painel, e painel se lê de relance.** A chave que cala a
   atendente para a empresa inteira não deve estar no caminho do olho de quem
   só queria conferir se está tudo certo.
2. **É a ação mais destrutiva que a página oferece** — tirando apagar uma
   pessoa, que fica logo abaixo. Ação destrutiva não fica no topo.

O card de estado passou a apontar para ele em uma linha ("Para desligar a
Letícia, vá até o fim desta página"), porque esconder sem dizer onde está é
esconder de verdade.

> ⚠️ **O card explica o que NÃO acontece, e é a parte que mais importa.** Três
> linhas: as mensagens continuam chegando, tudo fica guardado em Conversas, e
> ela não responde ninguém. Sem elas, quem não conhece o sistema hesita em
> desligar quando deveria — ou desliga achando que está fechando o WhatsApp da
> empresa.

> ⚠️ **E ele aponta para "Assumir a conversa".** Ali mora o erro caro: um
> contato irritado, e alguém desliga o atendimento de **todos** para resolver o
> caso de **um**. Desligar é para o problema que é de todo mundo — prompt
> alterado, preço errado, chave da IA acabando, ou a decisão de ficar um período
> sem IA. Para uma conversa só, quem resolve é o `agente_pausado`, em Conversas.

### O fuso fica na aba Horários, e ele conserta o futuro — não o passado

A grade diz "08:00 às 18:00". **De onde?** Sem a resposta ao lado dela, alguém
preenche a semana inteira sem se fazer a pergunta — e ela só aparece quando a
atendente marca um horário três horas fora. Por isso o `fuso_horario` ficou
num card **acima** da grade, e não na aba Empresa junto do endereço.

**Ele existe para o servidor, e para um pedaço de uma tela.** Agenda, Leads e
Clientes rodam no fuso do navegador, que no uso real é o da empresa — a
recepção está dentro dela. O campo alimenta quem não tem navegador para
consultar:

| Usa o campo | Usa o relógio do navegador |
|---|---|
| `{{DATA_HOJE}}` do prompt | Agenda, Leads, Clientes, CRM |
| `paraInstante()` — "quinta às 14h" vira instante | `NovoAgendamentoModal`: o agendamento marcado pela recepção |
| `agenda_disponibilidade` e `agenda_marcar` | As bordas dos filtros de período, em todas as telas |
| As frases que a API devolve | |
| **Os baldes do Dashboard** (`dashboard_por_dia` e `dashboard_dia_semana`, migração `0024`) | |

> ⚠️ **O Dashboard usa os dois, e é o único que usa.** As **bordas** do período
> saem do navegador; os **baldes** ("de que dia é esta linha") saem do campo,
> porque a sessão do PostgREST roda em UTC e um contato das 23h cairia no dia
> seguinte. Se o campo discordar do relógio da recepção, o gráfico fica
> deslocado em relação ao período escolhido — mais um motivo para a conferência
> abaixo.

> ⚠️ **Trocar o fuso não move agendamento nenhum que já existe.**
> `consultas.data_consulta` é `timestamptz`: guarda um **instante**, não
> "14:00". Corrigir o campo acerta o que for marcado dali para frente; o que foi
> marcado com o fuso errado continua na hora errada e precisa ser remarcado à
> mão. São poucos, porque o erro aparece rápido — mas não some sozinho.

**A conferência é uma só: o campo tem que bater com o relógio do computador da
recepção.** Se discordarem, a atendente e a recepção discordam exatamente
naquelas horas — e o sintoma é pior do que parece. Com jornada das 8h às 18h,
um deslocamento para trás joga a manhã inteira para fora do expediente, e ela
responde "não tenho horário" para horário livre. O caso está em
[`_shared/tempo.ts`](supabase/functions/_shared/tempo.ts), que caiu nele por
outra causa em agosto de 2026.

**Quatro opções, e não os catorze nomes IANA do Brasil.** Sem horário de verão
desde 2019, os catorze desabam em quatro deslocamentos — oferecer
`America/Bahia` e `America/Fortaleza` separados seria pedir uma escolha que não
muda nada, e escolha que não muda nada é só mais uma chance de errar. A lista
mora no TypeScript e a coluna **não** tem `CHECK`: ampliar não deve exigir
migração, pela mesma razão de [`cores.ts`](src/lib/cores.ts).

### A conexão do WhatsApp: seção, não aba; e o fornecedor é dado

A ponte com o WhatsApp vive em **Atendente de IA**, como seção da pilha de
cards — não como aba, e não em Configurações.

| Decisão | Por quê |
|---|---|
| **Seção, não aba** | A página inteira é um assunto só: a atendente. Aba separa **temas diferentes** (é o caso de Configurações: Perfil, Empresa, Horários). Aba aqui esconderia o estado da conexão, que é justamente o que precisa ser visto sem clicar |
| **Nome: "Conexão do WhatsApp"** | É o que a coisa é para quem usa. "Evolution API" é nome de fornecedor, e o rótulo teria que mudar junto com ele |
| **Mas o provedor aparece dentro** | Quando cai, é ele que diz **em qual painel ir olhar**. "WhatsApp desconectado", sozinho, não responde isso |
| **Servidor, instância e 4 dígitos da chave, dentro dela** | São as perguntas de quando quebra: em qual painel entrar, qual instância é a nossa, e se a chave é a que se pensa que é. Quatro caracteres de trinta e cinco **identificam** sem servir para usar — padrão de cartão e de Stripe |
| **E o número do WhatsApp, inteiro** | A pergunta mais direta de todas: *é este o número que está atendendo?* Vai completo — a chave manda mensagem por aquele WhatsApp, o número está impresso no cartão da empresa. Cobrir o que já é público não protege nada e custa a conferência. É a única linha do bloco que vem da sessão, e não das secrets; por isso aparece também quando a sessão cai, que é quando o cartão verde some com ela |
| **Nesta página, não em Configurações** | A conexão é o telefone da atendente. Separar as duas coisas seria esconder de quem cuida dela |

**`desconectado` e `indisponivel` são estados diferentes, e a diferença é a
saída:** o primeiro é a ponte de pé com a sessão caída (religa na própria
tela); o segundo é o servidor fora do ar (nenhum botão daqui resolve — quem
sobe é a máquina, no painel da hospedagem). Confundir os dois faz a pessoa
clicar em "Reconectar" enquanto o problema está em outro lugar.

**E `nao_configurado` é um terceiro**, que só passou a existir com a segunda
ponte: a escolhida não tem chave nas secrets. Sem ele, escolher a uazapi com o
token em branco diria "o servidor não respondeu" — mandando procurar defeito
numa máquina quando o que faltou foi preencher um campo.

### Duas pontes, e o seletor só manda em metade

A empresa escolhe entre **Evolution** e **uazapi** no seletor da Atendente de
IA, e a coluna `provedor_whatsapp` é lida a cada requisição — trocar vale na
mensagem seguinte, sem republicar. As credenciais das duas convivem nas
secrets; o que decide é a coluna, não a presença da chave.

A porta é [`_shared/whatsapp.ts`](supabase/functions/_shared/whatsapp.ts), e
foi escrita **só quando a segunda API chegou**: com um provedor só, a interface
seria palpite. O `whatsapp/index.ts` não conhece nenhuma das duas.

> ⚠️ **O seletor manda em quem a gente chama, não em quem chama a gente.** O
> webhook chega sem pedir licença. Quem lê é a ponte **ativa**; o que ela não
> reconhece é descartado com motivo no log, nunca em silêncio — responder
> mandaria a resposta pelo número da outra ponte, para quem nunca escreveu para
> ele. **Só o webhook do provedor ativo deve apontar para a nossa função**, e
> quem aponta é o botão **Apontar para cá**, no aviso do card — ele aponta a
> ativa, e só ela.

**O conserto mora do lado do aviso.** Apontar o webhook era um POST com um
JSON, feito à mão no painel da ponte: o único passo da instalação que exigia
saber programar, e que voltava a ser preciso a cada troca no seletor. Hoje é
`POST /whatsapp/conexao/apontar-webhook`, e três decisões moram nele:

| Decisão | Por quê |
|---|---|
| **O segredo vai do servidor direto para a ponte** | A tela nunca o vê — a mesma razão de `/conexao` devolver o veredito e não a URL |
| **Quem diz se deu certo é a leitura de volta**, e não o 200 da escrita | É a mesma pergunta que o card faz a cada minuto; as duas respostas não podem discordar |
| **Sem `WEBHOOK_SEGREDO`, recusa** (`sem_segredo`) | A função recusaria toda mensagem com 401. Apontar assim trocaria "nada chega" por "tudo chega e é recusado" — conserto na tela, silêncio no WhatsApp |

> ⚠️ **Na Evolution, o 404 do `webhook/find` virou `ausente`.** Era
> `desconhecido`, para a tela não acusar um problema sem saída. Com o botão do
> lado, calar passou a esconder o conserto justamente da instalação nova, que
> nasce sem webhook. E com `outro`, o botão pergunta antes: aquele endereço
> pode ser de outro sistema que ainda vive das mensagens.

> ⚠️ **Nenhuma das duas manda o arquivo no webhook — nem a que parece mandar.**
> A Evolution quer a mensagem de volta num POST; a uazapi tem um campo
> `fileURL` no evento que chega **vazio**, e quem entrega é
> `POST /message/download`. A `content.URL` ao lado dele é a CDN do WhatsApp,
> criptografada. Ler aquele campo como promessa custou um áudio e uma foto na
> estreia — o caso está na seção 8 do
> [`agente-ia/README.md`](agente-ia/README.md).
>
> **E mídia que não baixa precisa virar texto**, nunca silêncio. Diante de um
> `[foto enviada]` sem conteúdo, ela acolhe a dor de uma foto que nunca
> chegou. Hoje a falha grava `não consegui abrir esta foto`, e o prompt manda
> pedir de novo.

> **Atender depende de TRÊS condições, e o card demorou a aprender as duas
> últimas.** O agente ligado, o WhatsApp conectado **e o webhook apontado para
> a nossa função**. Até 01/09 o card só conhecia a primeira, e afirmou "está
> atendendo" por horas com a ponte fora do ar.
>
> A terceira era o mesmo buraco, e apareceu na estreia da uazapi: sessão
> pareada, card **verde escrito "Conectado"**, e silêncio absoluto — porque o
> webhook dela nunca tinha sido ligado. Hoje `/conexao` pergunta à ponte
> (`webhook/find/{instancia}` na Evolution, `GET /webhook` na uazapi) e o card
> avisa quando não aponta para cá.
>
> Painel que afirma o que não sabe é pior que painel vazio.

> ⚠️ **O veredito sai; a URL nunca.** Ela carrega o `WEBHOOK_SEGREDO` dentro —
> na uazapi obrigatoriamente, porque ela não aceita cabeçalho customizado e o
> segredo viaja na query. Escrever a URL na tela entregaria o segredo a
> qualquer pessoa com login, que é o erro que os 4 dígitos da chave evitam. Por
> isso `avaliarWebhook()` compara **origem e caminho** e devolve só
> `apontado` / `outro` / `ausente` / `desconhecido` — e `desconhecido` não
> mostra nada, porque acusar o que não se sabe é o mesmo erro ao contrário.

**A cadência da verificação é uma constante, e a frase sai dela.** As duas
telas que olham a conexão perguntam a cada minuto (`INTERVALO_PADRAO`, em
[`src/lib/whatsappConexao.ts`](src/lib/whatsappConexao.ts)). Foram 30s aqui e
60s em Conversas, sem razão; e o "a cada 30 segundos" do rodapé estava digitado
à mão, livre para discordar do valor de verdade — hoje é `cadenciaEmPalavras()`.

**Botão que não muda a tela parece botão quebrado.** O "Verificar" sempre
funcionou, mas o estado quase nunca muda entre uma consulta e a seguinte, e a
tela ficava igual. Agora o ícone gira, o botão tranca enquanto consulta, e o
rodapé dá o "Verificado agora" de dois segundos e meio — o mesmo `saved`
temporário do resto da base. E ele aparece em **todos** os estados: quem clica
três vezes seguidas é quem está com o servidor fora do ar esperando ele voltar,
e era justamente ali que a linha não existia.

> E a trava de "uma consulta por vez" **devolve a que está em voo** em vez de
> descartar o pedido. Descartando, o clique sumia sem rastro sempre que caía no
> meio segundo da verificação automática — o sintoma exato de botão morto, uma
> vez a cada tantas.

### O resumo da conversa não aparece em Conversas

`resumo_conversa` existe para quem precisa entender o caso **sem abrir a
conversa**. Na tela Conversas ela está aberta, inteira, dois centímetros à
esquerda — ali o resumo era um parágrafo dizendo pior o que já estava do lado,
e empurrava a linha do tempo e os agendamentos para fora da tela.

O lugar dele é a ficha ([`LeadDetail.tsx`](src/pages/LeadDetail.tsx)), que é
onde a recepção chega sem ter lido nada.

> A regra vale para o painel inteiro: **ele mostra o que a conversa não mostra**
> — telefone, serviço de interesse, quando a pessoa chegou, os agendamentos.
> O que dá para ler rolando a conversa não precisa ser repetido ao lado dela.

### O aviso de queda é do sistema, e demora um minuto

A faixa vermelha vive no [`Layout.tsx`](src/components/Layout.tsx), acima da
barra lateral — não dentro de uma página. Ela morava em **Conversas**, apostando
que a recepção passa o dia ali; a aposta não é ruim, mas quem estivesse na
Agenda, no CRM ou no Dashboard não via nada. Como casca, ela alcança quem quer
que esteja logado, na tela em que estiver.

**Ela só nasce depois de um minuto de queda contínua**
(`ESPERA_ANTES_DE_AVISAR`, em
[`whatsappConexao.ts`](src/lib/whatsappConexao.ts)) — o mesmo valor de
`INTERVALO_PADRAO`, ou seja, **duas leituras ruins seguidas**. A ponte pisca —
servidor que reinicia, rede que oscila, sessão que cai e volta —, e uma faixa
que aparece a cada piscada é uma faixa que a equipe aprende a ignorar.

> **Eram quatro minutos, e o número desceu.** O medo de alarme falso é o certo,
> mas o custo do outro lado é maior e chega antes: enquanto a faixa espera,
> ninguém na empresa sabe que o WhatsApp parou — e cada minuto ali é uma pessoa
> escrevendo para o vazio. Piscada que dura um minuto inteiro é rara; queda de
> verdade que dura quatro, não.
>
> ⚠️ **O prazo não pode ficar abaixo de `INTERVALO_PADRAO`.** Menor que a
> cadência, ele não espera nada: a primeira leitura ruim já o estoura, e a faixa
> volta a nascer de qualquer oscilação.

| Detalhe | Por quê |
|---|---|
| A contagem mora no `useConexao`, e não em quem exibe | É onde a leitura chega. `caidaDesde` marca a **primeira** leitura ruim da sequência — remarcar a cada leitura adiaria o aviso para sempre |
| O prazo tem `setTimeout` próprio | Sem ele, a faixa nasceria na consulta seguinte ao vencimento: até um minuto atrasada, por uma diferença de milissegundos |
| O componente guarda o **instante** em que o prazo tocou, não um "já venceu" | A queda seguinte tem um `caidaDesde` mais novo, e a conta volta a ser falsa sozinha. Com um booleano, a segunda queda apareceria na hora |
| `conectando` não conta como queda | Alguém está pareando naquele instante; zerar o relógio ali é o certo |
| `caidaDesde` fica no `localStorage` | **Sem isso o aviso quase nunca aparece.** Quem vê que caiu dá F5 para conferir — e o relógio voltava ao zero, junto com a espera inteira |
| Dois relógios, e vale o mais adiantado | O `setTimeout` é pontual mas dispara uma vez só; o `verificadoEm` muda a cada consulta e sozinho já garante a faixa, no máximo um minuto depois da hora. Um cobre a falha do outro |

> ⚠️ **`minHeight: 0` na linha que contém a barra lateral.** A faixa entrou como
> irmã dela dentro de um flex em coluna; sem isso, ela empurraria a barra e o
> conteúdo para fora da janela — o mesmo defeito que o `height: 100dvh` do
> Layout existe para evitar.

### Apagar uma pessoa: dois cartões, uma regra

O gesto existe em dois lugares, e não é repetição:

| Onde | O gesto | Para quem |
|---|---|---|
| **Atendente de IA** ([`ApagarPessoa`](src/components/ApagarPessoa.tsx)) | Uma **busca**: digite o número, descubra quem é, apague | O número errado que ninguém abriu, e o lixo de teste |
| **Ficha do lead** ([`ApagarEstaPessoa`](src/components/ApagarEstaPessoa.tsx)) | A pessoa **já está aberta** na tela | Quem chegou até a ficha é quem sabe que ela precisa sair |

Sem o segundo, a saída era copiar o telefone, abrir outra página e colar — um
desvio que só existia porque o botão não estava ali.

**A regra é uma só**, e mora em
[`apagarPessoa.ts`](src/lib/apagarPessoa.ts): a contagem antes, o
`ConfirmDeleteModal` no meio, e a Edge Function apagando. A ficha usa
`preverExclusaoDe()` em vez de `preverExclusao()` — ela **já tem a pessoa na
mão**, e procurar pelo telefone ali seria uma ida ao banco para descobrir o que
o componente já sabe (e quebraria em quem não tem número gravado).

> **O `navigate` depois de apagar leva `replace: true`.** Sem isso, o botão
> "voltar" do navegador traz a pessoa de volta para a ficha de alguém que não
> existe mais — e a tela fica em "Lead não encontrado" sem explicar por quê.

> **O botão fica trancado enquanto a contagem não chega.** O número é a parte
> que faz alguém parar a tempo; liberar o clique antes dele é oferecer
> exatamente o botão irreversível sem número que a contagem existe para evitar.

### Apagar uma pessoa apaga a mídia por fora

`crm_clinica_dados` cascateia para `mensagens_whatsapp` e `consultas`, mas
**não para o Storage** — e o Postgres recusa apagar de `storage.objects` por
SQL, de propósito, para não deixar arquivo órfão.

Por isso a exclusão é a rota `POST /whatsapp/apagar-pessoa`, e não um `delete`
da tela: só a Edge Function tem a `service_role key` que a Storage API exige.
Ela apaga **mídia primeiro, ficha depois** — o caminho do arquivo é
`{lead_id}/...`, então a ordem inversa perderia o rastro. Detalhes na seção 7
do [`DATABASE.md`](DATABASE.md).

**A confirmação conta o que vai destruir** (`68 mensagens · 3 agendamentos (1 já
realizado)`), e destaca o agendamento realizado quando existe. Botão irreversível
sem número vira clique automático.

### Ícones

`lucide-react`. A marca do Núcleo é o `CircleDot` — um núcleo: círculo com
ponto no meio —, no login e na barra lateral enquanto a empresa não sobe a logo
dela. O dente da clínica de origem saiu na troca de vocabulário.

> Ícone na cor do sistema é `style={{ color: MARCA }}`, **nunca**
> `color={MARCA}` — a razão está na Paleta, acima.

O **favicon** é o mesmo núcleo, em versão preenchida (branco sobre quadrado
arredondado) — traço fino some em 16×16. Ele existe em dois lugares:
`public/favicon.svg`, na cor padrão, que é o que aparece antes do código rodar;
e `trocarIconeDaAba()`, em [`marca.ts`](src/lib/marca.ts), que o redesenha na
cor escolhida. **Mudou o desenho, mude nos dois.**

A aba do navegador é `Núcleo` e o documento é `lang="pt-BR"`, definidos em
[`index.html`](index.html).

---

## Deploy

Vercel, SPA estática. A detecção automática acerta tudo (Vite → `npm run build`
→ `dist`), e o [`vercel.json`](vercel.json) tem uma coisa só: o rewrite de
`/(.*)` para `/index.html`.

**Esse rewrite não é enfeite.** As rotas são client-side (`BrowserRouter`); sem
ele, entrar direto em `/agenda` ou dar F5 em `/leads/:id` devolve 404 da Vercel.
Navegar pela Sidebar continuaria funcionando, então o problema só aparece quando
alguém compartilha um link.

As duas variáveis do Supabase precisam estar cadastradas no painel da Vercel — o
`.env` não vai para o Git. **Variável ausente não quebra o build:** o Vite embute
`undefined` e a tela fica em branco no primeiro acesso ao banco. E como variável
de Vite entra no bundle em tempo de build, **mudou a variável, reimplante.**

Passo a passo na parte 4.4 do [`INSTALACAO.md`](INSTALACAO.md), e a
conferência depois do deploy na parte 6.

---

## Variáveis de ambiente

```env
VITE_SUPABASE_URL=https://SEU_REF.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

Lidas em [`src/lib/supabase.ts`](src/lib/supabase.ts). O `.env` está no
`.gitignore` — **nunca comite credenciais**.

**Nenhum dos três arquivos de chave vem no clone** — é o `.gitignore` que impede
a chave de subir num `push`. O que é versionado é o molde de cada um; na parte 2
da instalação a IA copia, a pessoa preenche, e `npm run instalar:conferir`
confere os três:

| Molde (versionado) | Vira | Vida útil |
|---|---|---|
| [`.env.example`](.env.example) | `.env` | Permanente — o `npm run dev` lê toda vez |
| [`agente-ia/.env.agente.example`](agente-ia/.env.agente.example) | `agente-ia/.env.agente.local` | Permanente, mas parado: sobe para os secrets e fica de registro |
| [`.supabase-token.example`](.supabase-token.example) | `.supabase-token.local` | ⛔ **Descartável** — revogado e apagado quando o sistema sobe |

O terceiro guarda um Personal Access Token da **conta** do Supabase, não do
projeto: acesso total, todos os projetos. Ele existe porque o `supabase login` é
interativo e a IA da IDE não consegue fazer esse passo — migrar, publicar e
criar o primeiro usuário são as únicas razões. Cada molde carrega dentro dele
de onde vem cada valor e quando ele morre.

A `anon key` é pública por natureza (vai no bundle, protegida por RLS — e por
isso nada que passe por cima do RLS pode aceitá-la, ver a `0028`). A
`service_role key` **jamais** entra em arquivo deste projeto: quem precisa
dela recebe do Supabase na hora — as Edge Functions pelo ambiente, e o
`instalar:usuario` pela Management API, em memória, uma vez.

---

## Regras do projeto

### 1. A documentação faz parte da entrega — sempre

**Nenhuma mudança está concluída enquanto a documentação não refletir ela.**
Isto não é opcional nem "quando der tempo": é parte da mesma tarefa, no mesmo
commit.

| Se você mexeu em… | Atualize |
|---|---|
| Tabela, coluna, índice, política de RLS, trigger, view | [`DATABASE.md`](DATABASE.md) **e** o SQL em `supabase/migrations/` |
| Valores de `status` | `DATABASE.md` (seção 5) + [`src/types/index.ts`](src/types/index.ts) + [`src/lib/statusLead.ts`](src/lib/statusLead.ts) (cores e rótulos) + a cópia das cores no `CRM.tsx` |
| Bucket ou política de Storage | `DATABASE.md` (seção 7) |
| Paleta, fonte, convenção de estilo | `CLAUDE.md` (Design system) |
| Rota, página, componente novo | `CLAUDE.md` (Estrutura / Rotas) |
| Dependência, script do `package.json` | `CLAUDE.md` (Stack / Comandos) |
| Correção de algo listado em Débito técnico | Remova o item de `CLAUDE.md` |
| Variável de ambiente | `CLAUDE.md` + [`INSTALACAO.md`](INSTALACAO.md) (parte 2) + o molde `.example` correspondente |
| Qualquer passo da instalação (conta, chave, migração, deploy, painel) | [`INSTALACAO.md`](INSTALACAO.md) — **e só ele**. Os outros três documentos apontam para lá |
| Prompt do Agente de IA | [`agente-ia/prompt.md`](agente-ia/prompt.md) — e confira se a seção 8 do README da pasta ainda descreve ele, e se o [`GUIA-DO-PROMPT.md`](agente-ia/GUIA-DO-PROMPT.md) ainda classifica certo a seção mexida |
| Ferramentas, modelo ou etapas do Agente de IA | [`agente-ia/README.md`](agente-ia/README.md) (a seção correspondente **e** a tabela de estado) |
| Um kit (`kits/`), ou o jeito de adaptar o sistema a um ramo | [`ADAPTAR-CLINICAS.md`](ADAPTAR-CLINICAS.md) ou [`ADAPTAR-OUTROS-NICHOS.md`](ADAPTAR-OUTROS-NICHOS.md) — os passos que eles mandam seguir precisam continuar valendo |

Ao mudar o banco, **prefira verificar contra o banco real** (consultas da seção
10 do `DATABASE.md`) em vez de assumir que o SQL escrito foi o que rodou.

### 2. Demais regras

1. **Nada de marcas registradas** em nomes de serviço. Nem no banco, nem na
   interface, nem nos prompts do Agente de IA. Use a descrição genérica — no
   kit de clínica, "Alinhadores Transparentes", não "ClearCorrect" ou "Invisalign".
2. **Tipos e banco andam juntos.** Mudou o `CHECK` de `status`? Mude
   `src/types/index.ts` no mesmo commit.
3. **A tela de login é pré-autenticação.** O RLS bloqueia qualquer leitura sem
   sessão — não tente carregar `servicos_clinica` ali. O que o login mostra
   sobre o sistema é fixo no código, de propósito.
4. **Não comite `.env`, chaves ou tokens.**

---

## Débito técnico conhecido

Problemas reais que já existiam e ainda não foram tratados. Não são regressões.

### ESLint acusa 7 erros

- **4x — `ErrorMsg` declarado dentro do render** em
  [`Configuracoes.tsx`](src/pages/Configuracoes.tsx), linhas **388, 427, 464 e
  540**. Não é só estilo:
  componentes criados durante o render são recriados a cada renderização e
  **perdem o estado**. É um bug esperando acontecer. A correção é mover a
  declaração para fora do componente.
- **2x — uso de `any`** em `CRM.tsx` e `Configuracoes.tsx`, além de uma
  variável não utilizada (`_e` em `CRM.tsx`).

> **Eram 9.** Os dois `any` do `Dashboard.tsx` eram o tooltip da recharts, e
> saíram junto com a reescrita da `0024` — viraram a interface `DadosTooltip`,
> com só os campos que aquela tela lê. **Compare com o número, não com
> "limpo".**

### Bundle de 2.3 MB (836 KB gzip)

Acima do recomendado. `jspdf`, `html2canvas` e `recharts` são carregados sempre,
mas só usados em telas específicas. Resolve-se com `import()` dinâmico e code
splitting.

> **Medido em 02/09/2026**, no `dist/assets/index-*.js`. O número sobe sozinho
> a cada tela nova — confira antes de citar:
>
> ```bash
> npm run build && gzip -c dist/assets/index-*.js | wc -c
> ```

### Duplicação das cores de status

[`src/lib/statusLead.ts`](src/lib/statusLead.ts) é a fonte, e **código novo
importa de lá**. Sobrou uma cópia antiga — só das cores, porque os rótulos o
`CRM.tsx` já lê de `ROTULO_LEAD`:

| Arquivo | Formato | Por que ainda não migrou |
|---|---|---|
| `CRM.tsx` | array | Também define a **ordem das colunas** do Kanban |

Migrar exige decidir o que fazer com a ordem do Kanban — e isso é tarefa
própria, não efeito colateral de outra.

> **As cópias do `LeadDetail.tsx` e do `PessoasPage.tsx` saíram na troca de
> vocabulário**, que era migração mecânica: as duas eram idênticas ao módulo.
> **A do `Dashboard.tsx` sumiu antes.** Ela vestia a coluna "Status" de
> "Próximas Consultas" (hoje "Próximos Agendamentos"), com rótulos curtos
> ("Agendada"). A coluna virou **"Profissional"** na reescrita da `0024`: numa
> lista em que toda linha é um agendamento marcado, o status do funil era
> ruído — quem atende, não.

### Arquivos mortos

- **`src/App.css`** — o único CSS importado é o `index.css` (em `main.tsx`).
- **`public/icons.svg`** — não é referenciado em lugar nenhum.
- **`src/assets/react.svg` e `src/assets/vite.svg`** — sobras do template.

Nenhum deles quebra nada — mas confundem quem procura onde algo está definido.

---

## Integração com o Agente de IA

**📘 Tudo sobre o agente do WhatsApp vive em [`agente-ia/`](agente-ia/)** —
comece pelo [`agente-ia/README.md`](agente-ia/README.md): quem ele é, como
funciona, as decisões tomadas, o estado de cada etapa e **o mapa de onde fica
cada arquivo**. Leia antes de mexer em qualquer coisa ligada a ele.

A pasta guarda o **conteúdo** (o prompt em `prompt.md` e as chaves). O
**código** fica onde as ferramentas obrigam — `supabase/functions/` e `src/` —
e está todo listado no mapa daquele README.

> **Levar o sistema para outra empresa?** O passo a passo — as perguntas, os
> serviços, publicar e testar — está no [`ADAPTAR-CLINICAS.md`](ADAPTAR-CLINICAS.md)
> e no [`ADAPTAR-OUTROS-NICHOS.md`](ADAPTAR-OUTROS-NICHOS.md). Dentro dele, o
> [`agente-ia/GUIA-DO-PROMPT.md`](agente-ia/GUIA-DO-PROMPT.md) diz o que no
> `prompt.md` é conteúdo da empresa e o que é **contrato com o código** — os
> marcadores, a ordem das duas seções finais e os nomes das ferramentas quebram
> em silêncio. E a primeira instrução dele é que o prompt se edita **pela IA da
> IDE**, que lê este repositório antes de escrever.

> ⚠️ **A tabela de estado daquele README diz o que já foi construído.** O que
> estiver em etapa não concluída não existe — não procure o arquivo.

**Ela não usa n8n nem Chatwoot.** Esse era o desenho antigo, abandonado antes de
rodar. Hoje a Letícia é a Edge Function
[`supabase/functions/whatsapp/`](supabase/functions/whatsapp/), chamada por
webhook pela ponte de WhatsApp ativa — **Evolution API v2** ou **uazapi v2**,
à escolha da empresa no seletor da Atendente de IA. Duas heranças ficaram no
schema, ambas
mortas: as colunas `*_chatwoot` de `crm_clinica_dados` e a tabela
`n8n_chat_histories`, que **nunca chegou a existir** neste banco.

**O que ela toca no banco — lista fechada:**

| Objeto | Acesso |
|---|:---:|
| `crm_clinica` | **lê e grava** — cria o lead, avança o status e preenche a ficha |
| `mensagens_whatsapp` | **lê e grava** — a memória da conversa, e a fonte da futura tela Conversas |
| `consultas` | **grava só pelas funções SQL** `agenda_marcar` / `agenda_remarcar` / `agenda_cancelar`. **Lê** direto — o agendamento futuro e o histórico, sempre só os do próprio lead |
| bucket `midias-whatsapp` | **grava** — o áudio e a foto que o contato mandou. Privado |
| `informacoes_clinica_agente` | **só lê** — dados da empresa em frases prontas |
| `procedimentos_clinica_agente` | **só lê** — serviços ativos |
| `profissionais_clinica_agente` | **só lê** — profissionais ativos, a jornada de cada um e o "Só faz: ..." de quem tem lista |
| `servicos_clinica` | **só lê** — a `descricao_longa` de **um** serviço, pela ferramenta `detalhes_do_servico`. E `agenda_marcar` lê `exige_avaliacao` e `duracao_minutos` para decidir o agendamento |
| `configuracoes_agente` | **só lê** — modelo, prompt, o nome dela e a regra do modo teste |
| `configuracoes_clinica` | **só lê** — só o `fuso_horario` |

Nada mais. Detalhes na **seção 8 do [`DATABASE.md`](DATABASE.md)**.

> ⚠️ **O lead nasce sem nome, e o `pushName` não entra.** A Evolution manda o
> nome do perfil do WhatsApp em todo webhook; ele é **ignorado de propósito**. O
> perfil é o apelido que a pessoa escolheu, não quem vai sentar na cadeira — o
> telefone do marido, "Casa da Sogra", o número dividido entre duas pessoas. E o
> estrago não era só o nome errado no CRM: com a ficha já preenchida, a Letícia
> lia "já sei o nome" e **nunca perguntava**, então ninguém corrigia. O nome vem
> da conversa, por `atualizar_ficha`, e de mais lugar nenhum. Até ela perguntar,
> as telas mostram o número formatado.

O Dashboard exibe métricas de impacto do agente: distribuição dos contatos por
dia da semana, agendamentos por profissional, o ranking de serviços
(procurado x realizado) e a taxa de conversão do funil.

> **A rosca "dentro e fora do horário comercial" existiu e foi removida** a
> pedido da clínica de origem, em 02/09/2026. Ela era o argumento mais direto
> da Letícia existir — *"X pessoas escreveram fora do expediente, e só ela
> respondeu"*.
> Quem quiser de volta: o dado é `inicio_atendimento` cruzado com
> `horario_comercial`, e agora seria uma sexta função na `0024`, no fuso da
> empresa em vez do relógio do navegador.

### A foto não vai para o modelo — a descrição dela vai

Áudio e foto terminam no mesmo lugar: uma linha de texto no `conteudo` da
mensagem. O áudio pelo Whisper; a foto por `descreverImagem()`, em
[`llm.ts`](supabase/functions/_shared/llm.ts), que a olha e escreve uma linha.
**Nenhuma imagem segue para o modelo da conversa.**

| Decisão | Por quê |
|---|---|
| **A descrição, e não a imagem** | Anexada, a foto só acompanhava a mensagem atual — duas mensagens depois o histórico dizia `[foto enviada]` e ela tinha esquecido o que viu. Texto fica |
| **Modelo fixo (`gpt-4.1-mini`)** | Pré-processamento, como o Whisper: precisa funcionar com a empresa no Claude, e dar a mesma descrição sempre |
| **Descreve o visível, nunca o que significa** | Ela **repete o que estiver ali**. "Está normal" é avaliar o caso, e avaliar o caso é proibição inegociável dela |
| **O texto do descritor mora em [`agente-ia/descritor-de-fotos.md`](agente-ia/descritor-de-fotos.md)** | É conteúdo de ramo, como o prompt: o que é "foto do assunto" numa clínica não é numa oficina. O `npm run prompt` embute os dois na função |
| **Foto fora do assunto: quem decide depende do ramo** | O descritor **genérico** não sabe o que a empresa faz, então só descreve (e diz "figurinha", "meme", "captura de tela") — quem compara com os serviços é a atendente. O do **kit de clínica** sabe, e marca `Sem relação com odontologia:`, que o prompt do kit reconhece. Sem uma das duas saídas, uma captura de tela vira "imagino que isso esteja te incomodando" |

> ⚠️ **As frases são contrato com o prompt.** `não consegui abrir esta foto`
> (do `index.ts`) tem resposta própria em todo prompt; o marcador do descritor,
> quando existe, tem resposta no prompt do mesmo kit. Mudar o texto de um lado
> sem mudar o outro devolve o sintoma — ela volta a improvisar sobre o que não
> recebeu, e nada na tela diz isso. **Descritor e prompt andam em par**, e
> trocam juntos.

### A memória dela tem duas camadas

**Ela não tem "conversas".** Não há sessão nem começo: é uma linha do tempo só
por número de WhatsApp, para sempre.

| Camada | O que é | Alcance |
|---|---|---|
| **Janela** | As últimas **50 mensagens** de `mensagens_whatsapp` | Curto. Cada balão conta uma linha, e ela responde em 2 ou 3 — 50 mensagens são umas **16 trocas** |
| **Ficha** | `nome_lead`, `procedimento_interesse`, `resumo_conversa` e os agendamentos, montados por `montarFicha()` no fim do prompt | **Permanente.** É o que ela lembra de um contato que sumiu por um ano |

> **A ficha só existe se ela escrever.** Quem preenche é a ferramenta
> `atualizar_ficha`, chamada por ela mesma durante a conversa. Prompt fraco nesse
> ponto = ficha vazia = nenhuma memória longa. Por isso a regra virou
> inegociável: *"nunca termine uma resposta em que descobriu algo novo sem usar
> `atualizar_ficha`"*.

**A ficha é o único lugar do prompt que carrega ordem, e não só dado.** Quando
existe agendamento marcado, `montarFicha()` acrescenta uma segunda linha mandando
não oferecer agendamento. Parece repetir as `REGRAS INEGOCIÁVEIS`, e não é: num
teste real, na clínica de origem, a Letícia ofereceu agendar a quem tinha hora
no dia seguinte — com o dado na frente dela, e recitando esse mesmo dado
trinta segundos depois.
Regra colada no dado, na **última** coisa que o modelo lê, pesa mais que a mesma
regra dez seções acima. E não custa cache: esta seção já é volátil. O caso
inteiro está na seção 8 do [`agente-ia/README.md`](agente-ia/README.md).

**O histórico de agendamentos não entra no prompt.** Um cliente de cinco anos tem
dezenas de linhas, cobradas em toda mensagem para serem usadas quase nunca. Da
ficha sai só uma linha de placar — quantos fez e quando foi o último —, e o
detalhe vem pela ferramenta `historico_do_cliente`. **É a mesma divisão dos
serviços:** catálogo no prompt, detalhe sob demanda.

### A ordem do prompt não é estética

O prompt tem nove seções fixas, as mesmas em qualquer ramo — a lista e o
porquê estão na seção 3 do
[`agente-ia/GUIA-DO-PROMPT.md`](agente-ia/GUIA-DO-PROMPT.md). O que é igual
para todo mundo (identidade, regras, empresa) vem **primeiro**; o que muda a
cada conversa e a cada minuto (`{{DATA_HOJE}}` e `{{FICHA_DO_CONTATO}}`) vem
**por último**.

É assim que o cache de prompt funciona: ele reaproveita o **prefixo comum** entre
chamadas. Um dado volátil no começo joga fora o desconto do texto inteiro — de
todas as conversas de uma vez. **Não mova as duas seções finais para cima.**

### O follow-up é a única vez em que ela fala sem ser chamada

Todo o resto desta função é reativo: a Edge Function acorda com um webhook, ou
seja, **só quando alguém escreve**. A rota `POST /whatsapp/follow-up` é a
exceção — quem a acorda é o `pg_cron`, de minuto em minuto (migração `0030`).

**A política não mora no código.** Quem recebe, de qual etapa e sob quais
travas é a `followups_pendentes()`, no banco; a rota executa a lista que vier.
É o que permite mudar prazo, janela ou trava sem republicar função nenhuma — e
é onde procurar quando alguém receber, ou deixar de receber, um follow-up.
A referência completa é a [seção 4.20 do `DATABASE.md`](DATABASE.md).

Três coisas do lado do código que não são óbvias:

- **A reserva em `agente_followups` é gravada antes de responder 200 ao cron.**
  Gerar o texto leva segundos e o cron bate a cada minuto: sem isso, a batida
  seguinte pegaria a mesma pessoa. Falhou o envio? A reserva é apagada, e ela
  volta para a fila.
- **A chamada ao modelo vai sem ferramenta nenhuma.** Um follow-up não marca,
  não cancela e não grava ficha — ele só chama de volta. Com as ferramentas na
  mesa, o modelo tenta "adiantar" o agendamento de quem nunca confirmou nada.
- **A instrução de follow-up é concatenada ao prompt, e não mora no
  `prompt.md`.** Aquele arquivo tem contrato conferido (`npm run prompt` valida
  seções e marcadores), e este texto só vale numa das duas situações em que ela
  fala. Prompt que descreve uma situação que não está acontecendo é ruído
  cobrado em toda mensagem.
- **A nona ferramenta existe por causa do follow-up.** `nao_perturbe` é a única
  trava que lê o que a pessoa **disse**; todas as outras são estruturais. Ela
  liga e nunca desliga, e **não cala a agente**: o que acaba é a procura, não o
  atendimento. Quem cala é o `agente_pausado`, que é outra coisa.
- **Quem cancelou tem tratamento próprio, nos dois lados.** No banco, pula a
  etapa 1 e cai na de 24 horas, que chega no dia seguinte; no código, a
  `oQueAconteceuComOAgendamento()` conta ao modelo o que a pessoa tinha marcado
  e manda convidar para um horário novo. **Cancelar não é desinteresse** — é o
  lead mais perto de voltar, e o follow-up genérico ("posso ajudar em algo?")
  joga isso fora.

### Ao agendar, o agente chama função SQL — nunca `INSERT`

Antes da Agenda existir, o agente gravava `data_agendamento` direto na ficha do
lead. **Isso não vale mais.** O agendamento vira linha em `consultas`, com
`profissional_id`, `duracao_minutos`, `origem = 'agente_ia'` e `chave_externa` —
e quem grava é `agenda_marcar`, chamada pela ferramenta.

`INSERT` direto pula a conferência de jornada, a escolha de profissional livre e
a idempotência da `chave_externa`; ao bater na restrição de sobreposição, devolve
um `23P01` cru, sem frase para dizer a quem está esperando no WhatsApp.

> **Duas portas, uma regra.** A Letícia chama as funções SQL **direto**, por RPC,
> porque roda dentro do mesmo projeto. Quem está de fora usa os sete endpoints da
> função `agenda/`, com token. As duas descem para as mesmas funções da migração
> `0004` — é isso que impede as duas de divergirem.
>
> ⚠️ **Mas a mesma função SQL não garante o mesmo resultado.** As duas portas já
> divergiram: `agenda_marcar` recebe `timestamptz`, e o que chega antes disso é
> texto. A API pública convertia o texto no fuso da empresa; a Letícia mandava
> cru. Sem fuso, quem resolve é o Postgres, e a sessão do PostgREST roda em UTC
> — 14:00 da empresa virava 14:00 de Londres, gravado às **11:00**. A conversão
> agora é `paraInstante()`, e existe **duas vezes**: em
> `supabase/functions/_shared/tempo.ts` (Letícia) e dentro de
> `supabase/functions/agenda/index.ts` (API), que não pode ter import. **Mudou
> uma, mude a outra.** O caso está contado na seção 7 do
> [`agente-ia/README.md`](agente-ia/README.md).

`data_agendamento` continua existindo, mas virou reflexo — quem o mantém é o
trigger `consultas_sincroniza_lead`.

### A API da agenda — implantada

**Contrato e cURLs em [`API_AGENTE.md`](API_AGENTE.md)** — sete endpoints
(profissionais, procedimentos, disponibilidade, marcar, consultas, cancelar,
remarcar), para **integração externa**, autenticados por token próprio e não
pela `service_role key`.

> **A Letícia não usa esses endpoints.** Ela mora no mesmo projeto e chama as
> funções SQL direto. A API existe para quem está de fora.

Quatro coisas para não descobrir do jeito difícil:

1. **A Edge Function não pode ter `import` de nada.** O runtime sobe com
   `--no-remote` e um import externo derruba a função inteira com `BOOT_ERROR`,
   antes de rodar uma linha. A conversa com o banco é `fetch` no PostgREST.
2. **Ela está publicada com `verify_jwt = false`**, de propósito: a autenticação
   é o nosso token, não a `anon key`. Reimplantar no padrão derruba os sete
   endpoints de uma vez, com um 401 que nem chega no nosso código.
3. **Recusa de negócio volta com HTTP 200** (`ok: false` + `motivo` +
   `mensagem`). "Horário ocupado" é resposta, não erro — com 4xx, quem consome
   quebraria o fluxo justamente na hora de dar a notícia.
4. **Toda resposta traz frase pronta**, inclusive 401 e 500, onde ela é neutra.
   Quem consome vai falar com uma pessoa; sem frase, o agente improvisa.

   > ⚠️ **E o mapa `FRASES` precisa acompanhar toda regra nova.** Ele ficou
   > para trás duas vezes: `exige_avaliacao` (`0018`) e
   > `procedimento_desconhecido` (`0023`) entraram no SQL e não aqui, então o
   > `?? MENSAGEM_GENERICA` respondia *"não consegui acessar a agenda agora"* —
   > a frase de **servidor fora do ar** — para uma recusa de **negócio**. Quem
   > integrava ia reiniciar máquina por causa do nome de um serviço.
   >
   > **A Letícia nunca caiu nisso**, porque tem frase própria em
   > `ferramentas.ts`. É sempre a porta de fora que fica para trás: mexeu numa
   > função `agenda_*`, confira o mapa.

A lógica pesada mora em funções SQL (`0004`), não no TypeScript: remarcar precisa
ser atômico e o cruzamento entre jornada e agendamento só é confiável com o
`AT TIME ZONE` do Postgres. A Edge Function confere o token, chama a função e
monta a frase.

**A regra de disponibilidade em SQL espelha [`src/lib/agenda.ts`](src/lib/agenda.ts).**
Mudou uma, mude a outra — se divergirem, o agente oferece horário que a recepção
vê como ocupado.

### Os tokens saem do menu do usuário → Token e API

A página é [`TokenApi.tsx`](src/pages/TokenApi.tsx), com a geração e o
catálogo de endpoints em [`src/lib/apiTokens.ts`](src/lib/apiTokens.ts). Ela
cria, revoga, mostra status e último acesso, e traz a documentação dos sete
endpoints com os cURLs prontos para colar em qualquer cliente HTTP.

**O `hashToken()` da tela e o `sha256()` da Edge Function precisam ser o mesmo
cálculo** — SHA-256 em hexadecimal minúsculo. É o único ponto de encontro entre
quem cria o token e quem o confere; se divergirem, todo token nasce inválido e o
sintoma é um 401 sem explicação.

O valor em claro nunca é gravado: o banco guarda só o hash, e a tela mantém o
valor em memória apenas enquanto a página está aberta, para os cURLs saírem
preenchidos logo depois da criação.

### O que o agente lê direto do banco, sem API

`informacoes_clinica_agente` é uma view de **coluna única**, com uma informação
por linha, já escrita como frase — endereço, bairro, cidade/UF, CEP, horário de
atendimento, Maps, Instagram e site. A Edge Function lê com a mesma
`service_role key` que já usa para gravar os leads em `crm_clinica`; não há
endpoint para isso, de propósito.

A linha `Atendimento:` **não é campo digitado**: sai de `horario_comercial` pela
função `jornada_texto(null)`, que agrupa dias seguidos com o mesmo horário
("segunda a sexta das 08:00 às 18:00, sábado das 08:00 às 12:00"). A grade é a
mesma da aba Horários — mudou lá, mudou a frase.

**`jornada_texto()` é uma função só, para os dois usos.** Com `null` lê
`horario_comercial`; com um uuid lê a jornada daquele profissional. As duas tabelas
têm as mesmas colunas relevantes, e duas cópias da regra de agrupamento seria
uma a mais do que o necessário — a segunda envelheceria calada.

> ⚠️ **A grade da empresa não é a da agenda.** `horario_comercial` é o que a
> empresa anuncia; quem manda na disponibilidade é `profissional_horarios`.
> Anunciar até as 18:00 sem profissional depois das 17:00 faz o agente prometer
> horário que a própria API recusa em seguida.

Três coisas que a definem (detalhes na seção 4.12 do
[`DATABASE.md`](DATABASE.md)):

1. **É view, não tabela.** Calculada na leitura a partir de
   `configuracoes_clinica` — o estado "desatualizada" não existe. Mesmo motivo
   de `crm_clinica`.
2. **Uma coluna só, com rótulo dentro da frase.** Valor sem rótulo obriga o
   agente a adivinhar qual linha é o CEP e qual é o bairro.
3. **Campo vazio não vira linha.** `Site: ` pelado faria o agente dizer que o
   site da empresa é nada.

Quem preenche é a aba **Empresa** ([`TabClinica.tsx`](src/components/TabClinica.tsx)),
que mostra no rodapé a prévia do que o agente lê — e essa prévia é **uma consulta
real à view**, não uma reimplementação. Se ela fosse montada no TypeScript,
haveria duas versões da mesma regra e um dia a tela mostraria uma coisa e o
contato ouviria outra.

`procedimentos_clinica_agente` segue a mesma receita, com os serviços
ativos — um por linha, na ordem da tela de Serviços. Sem prefixo
`Serviço:`, porque aqui todas as linhas são da mesma natureza e a palavra
repetida vinte vezes viraria ruído lido em voz alta.

A linha é `Nome: descrição`, e ganha uma frase final quando há o que dizer (com
serviços do kit de clínica):

```
Avaliação Odontológica: primeira consulta, o dentista examina... Sem custo.
Lentes de Contato: lâminas finíssimas de porcelana... Antes deste, marque Avaliação Odontológica.
Limpeza e Profilaxia: remoção de placa e tártaro... A partir de R$ 250,00.
Clareamento Dental: gel clareador que remove manchas...
```

**A ordem do `case` é a regra de negócio:** passar pela porta de entrada vence
o preço, e é o que garante que um valor preenchido por engano num serviço que
passa pela porta nunca seja falado. Sem descrição, a linha é só o nome; sem
nada a dizer sobre fluxo ou valor, termina na descrição.

`profissionais_clinica_agente` faz o mesmo com os profissionais ativos, trazendo a
jornada de cada um: `João Pereira: atende segunda a sexta das 08:00 às 18:00`.

> **As três views são para conversar, não para operar — nenhuma traz `id`.** Para
> marcar com um profissional específico, o `profissional_id` vem de
> `GET /profissionais` da API. Os endpoints `GET /procedimentos` e
> `GET /profissionais` continuam existindo e respondem às mesmas perguntas por
> outro caminho: ordenam por nome e devolvem menos. Mexeu numa superfície,
> confira a outra.
