# Guia do prompt — como escrever o do seu negócio

Este guia é para quem vai **adaptar a atendente a um negócio** — o seu ou o de
um cliente.

> **O passo a passo inteiro da adaptação** — as perguntas, os serviços,
> publicar e testar — está no [`ADAPTAR-CLINICAS.md`](../ADAPTAR-CLINICAS.md) e
> no [`ADAPTAR-OUTROS-NICHOS.md`](../ADAPTAR-OUTROS-NICHOS.md). Este guia é a
> parte do prompt: como escrever, e o que não se pode mexer.

Existem dois prompts prontos, no mesmo esqueleto, e nenhum é um modelo em
branco:

| Onde | O que é |
|---|---|
| [`prompt.md`](prompt.md), nesta pasta | O **genérico**, que vem instalado. Toda regra dele nasceu de um erro real numa clínica odontológica em produção; as palavras servem a qualquer ramo — empresa, serviço, profissional, agendamento |
| [`kits/clinica-odontologica/prompt.md`](../kits/clinica-odontologica/prompt.md) | O **de clínica**, que atendeu em produção. As mesmas regras, mais as de saúde: nunca diagnosticar, o que é urgência, foto de boca |

Leia os dois lado a lado: a diferença entre eles é exatamente o que um ramo
acrescenta. O que está aqui é como escrever o seu; o que está lá é o exemplo
funcionando.

> **Cada prompt anda com um descritor de fotos** — `descritor-de-fotos.md`, na
> mesma pasta. É a instrução do modelo que olha a foto antes dela (ver a seção
> 3). Trocar de ramo é trocar os dois.

> **Este arquivo é para gente.** O `prompt.md` é o contrário: tudo o que estiver
> dentro dele, o modelo lê como ordem. Nunca escreva explicação, comentário ou
> anotação lá.

---

## 1. A primeira instrução: peça para a IA escrever

**Não edite o prompt à mão, e não escreva ele num chat solto.** Abra o projeto
no Claude Code, no Codex, ou na IDE com IA que você usar, e peça a mudança em
português.

O motivo não é preguiça — é que **o prompt está acoplado ao código**. Quem
escreve precisa saber:

- quais ferramentas existem de verdade (são oito, e estão em
  [`_shared/ferramentas.ts`](../supabase/functions/_shared/ferramentas.ts));
- o que cada `{{marcador}}` vai virar quando o sistema preencher;
- por que a data e a ficha ficam **no fim** do arquivo, e não no começo;
- o que a função SQL já recusa sozinha, e portanto não precisa virar regra.

Nada disso é adivinhável. Mas está tudo escrito no repositório —
[`CLAUDE.md`](../CLAUDE.md), [`DATABASE.md`](../DATABASE.md) e o
[`README.md`](README.md) desta pasta —, e a IA lê antes de escrever.

**Um prompt vindo de um chat que não conhece este sistema chega bonito e
quebrado:** inventa ferramenta que não existe, descreve um fluxo que o código
não suporta, apaga um marcador, ou sobe a data para o topo e joga fora o
desconto de cache de todas as conversas de uma vez.

### Como pedir

Peça o **efeito**, não o texto. A IA cuida de onde a mudança encaixa.

| Ruim | Bom |
|---|---|
| "Reescreve o prompt" | "A empresa agora aceita convênio. Ela precisa saber disso e perguntar qual é, na Etapa 2" |
| "Coloca uma regra de preço" | "Nunca fale o valor da reforma completa, mesmo se estiver no catálogo — é o único que o dono fecha pessoalmente" |
| "Muda o tom" | "Está formal demais. Quero mais próximo, mas sem gíria" |
| "Adiciona uma ferramenta" | "Ela precisa conseguir X" — e deixe a IA dizer se dá, e o que muda no código |

E peça também o que vem junto: **regenerar, publicar e atualizar a
documentação**. É a regra 1 do [`CLAUDE.md`](../CLAUDE.md) — mudança sem
documentação não está pronta.

### A tela mostra o prompt; ela não edita

A página **Atendente de IA** (menu do usuário) tem um bloco "Ver o prompt". Ele **só lê** — busca
o texto que está publicado na Edge Function e diz qual dos dois está no ar.

Editar por ali existiu e foi removido em 01/09/2026, de propósito: o que se
escrevia na tela gravava no banco e **não ia para o Git**. No dia em que alguém
precisasse entender por que a Letícia mudou de comportamento, não haveria
histórico nenhum — e o `prompt.md` continuaria descrevendo uma agente que não
existe mais.

O caminho é sempre o mesmo: mude o arquivo pela IA da IDE, `npm run
agente:deploy`, e teste no WhatsApp com o modo teste ligado.

---

## 2. As três camadas do arquivo

Nem toda seção do `prompt.md` tem o mesmo peso. Algumas são o seu negócio —
troque à vontade. Outras são **contrato com o código**: mudar quebra, e não
aparece erro nenhum.

### 🟢 Reescreva — é o seu negócio

| Seção | O que muda |
|---|---|
| `# IDENTIDADE` | O nome dela, o ramo da empresa, como ela se apresenta |
| `# SUA FUNÇÃO` | O que ela faz e, principalmente, o que **não** é trabalho dela |
| `# TOM DE VOZ` | Tom, tamanho da resposta, palavras que evita e prefere |
| `# FLUXO DE ATENDIMENTO` | As etapas, na ordem em que a empresa atende |
| `## Quando passar para uma pessoa` | O que é urgência **neste** ramo |
| `## Quando pedem sua opinião sobre qual serviço fazer` | Onde fica a linha entre **explicar** e **indicar**, neste ramo |
| `## Fora do horário de atendimento` | Se ela agenda de madrugada ou só responde |

As três últimas moram dentro de `# REGRAS DE ATENDIMENTO`.

### 🟡 Adapte com cuidado — a regra é sua, o mecanismo não

| Seção | O que é seu | O que não é |
|---|---|---|
| `# A EMPRESA` | Nada — os dados vêm do banco | Os três marcadores e o texto que explica o formato do catálogo |
| `## Preço` | Se a empresa fala valor, e quais | O `preco_a_partir_de` é quem decide o que aparece no catálogo |
| `## O serviço de entrada` | O nome e o papel do serviço de entrada | A recusa é da função SQL. O prompt só explica o que fazer com ela |
| `## Áudio`, `## Foto` e `## Vídeo` | O que ela faz com uma foto | Que ela **recebe** os três — isso é código. E `não consegui abrir esta foto` é **literal**, escrita pelo `index.ts` |
| [`descritor-de-fotos.md`](descritor-de-fotos.md) | O que é "foto do assunto" no seu ramo | Que ele descreve o visível e **nunca avalia** — a atendente repete o que ele escrever. E se ele usar um marcador (o do kit de clínica é `Sem relação com odontologia`), o prompt precisa reconhecê-lo pelas mesmas palavras |
| `## Regras inegociáveis` | As regras do seu negócio | Ver o aviso abaixo |

> ⚠️ **As regras inegociáveis não são enfeite.** Quase toda linha de lá é a
> cicatriz de um teste real, na clínica onde o sistema nasceu: ela ofereceu
> horário a quem já tinha consulta, ela prometeu o tratamento quando marcou a
> avaliação, ela parou de gravar a ficha e esqueceu o paciente. Acrescente as
> suas — mas antes de **apagar** uma, procure no [`README.md`](README.md) por
> que ela nasceu.

### 🔴 Não encoste — quebra em silêncio

| O que | Se mexer |
|---|---|
| Os seis `{{MARCADORES}}` | Apagou? O sistema não substitui, e o modelo lê `{{SERVICOS}}` como se fosse o catálogo. Ela inventa serviço. São `{{NOME_AGENTE}}`, `{{INFORMACOES_EMPRESA}}`, `{{SERVICOS}}`, `{{PROFISSIONAIS}}`, `{{DATA_HOJE}}` e `{{FICHA_DO_CONTATO}}` |
| **`# DATA E HORA ATUAL` e `# QUEM ESTÁ FALANDO COM VOCÊ` no fim do arquivo** | Subiu? O cache de prompt reaproveita o começo igual entre as chamadas. Dado volátil no topo joga fora o desconto do texto inteiro — de todas as conversas |
| `# FERRAMENTAS` | As oito existem no código de qualquer jeito. Apagar do prompt não desliga: faz ela usar errado, ou não usar |
| Os nomes das ferramentas e dos campos | `marcar_agendamento`, `servico`, `interesse`, `nome_completo` — são a chamada de verdade. Nome trocado é ferramenta que não roda |
| As frases que o código escreve na ficha | `JÁ TEM AGENDAMENTO MARCADO`, `já é cliente` e `Do que já falaram` saem de `montarFicha()`, e `# QUEM ESTÁ FALANDO COM VOCÊ` as reconhece pelas palavras exatas |

---

## 3. O esqueleto: nove seções, nesta ordem

Todo prompt deste sistema tem as mesmas nove seções, com os mesmos títulos — o
de qualquer ramo. Cinco são escritas por você; quatro (🔒) são preenchidas pelo
sistema ou são o manual das ferramentas — nelas, o que é seu é pouco, e o
resto só se lê.

```
# IDENTIDADE                       quem ela é
# SUA FUNÇÃO                       o que ela faz, e o que NÃO é trabalho dela
# TOM DE VOZ                       como ela fala
# A EMPRESA                   🔒   os dados que o sistema preenche, e como ler
# FLUXO DE ATENDIMENTO             o passo a passo da conversa
# REGRAS DE ATENDIMENTO            preço, fotos, urgência, os "Nunca..."
# FERRAMENTAS                 🔒   quando usar cada uma das oito
# DATA E HORA ATUAL           🔒   preenchida a cada mensagem
# QUEM ESTÁ FALANDO COM VOCÊ  🔒   a ficha da pessoa, preenchida a cada mensagem
```

**Só as duas últimas têm lugar obrigatório** — no fim, pelo cache (ver a seção
2). Entre as outras sete, a ordem é a de quem aprende o trabalho: quem é, o que
faz, como fala, o que sabe, como conduz, o que não pode, e o manual. `# A
EMPRESA` vem antes do fluxo porque o fluxo fala dos serviços dela.

**Os títulos ficam em maiúsculas, e com estas palavras.** O próprio prompt se
refere às seções pelo nome — *"olhe a ficha em QUEM ESTÁ FALANDO COM VOCÊ"* —, e
o modelo acha a seção por ele. Dentro de cada uma, os subtítulos (`##`) são
livres.

Faltando uma seção, o buraco aparece em produção — e sempre no pior dia.

**1. `# IDENTIDADE` — rápida.** Quem ela é, de que empresa, por qual canal, e que
fala como pessoa. Nada do que ela faz: isso é a seção seguinte.

**2. `# SUA FUNÇÃO` — direta.** O que ela faz e, sobretudo, **o que não é
trabalho dela**. A metade negativa é a que muda comportamento: não avalia o caso,
não decide o serviço pela pessoa, não fala valor que não esteja no catálogo. A
metade positiva o modelo já chuta sozinho.

> ⚠️ **Identidade e Função são dois lugares, então não diga a mesma coisa nos
> dois.** Um dia eles discordam, e você não descobre lendo — descobre pela
> resposta estranha. A divisão é simples: **quem ela é** fica na Identidade;
> **o que ela faz e não faz** fica na Função. E a Função só aponta as
> proibições; a regra inteira, com o que fazer no lugar, mora em `# REGRAS DE
> ATENDIMENTO`.

**3. `# TOM DE VOZ`.** Tom, tamanho, ritmo. Seja concreto: *"máximo de 50
palavras, em 2 ou 3 mensagens curtas"* funciona; *"seja objetiva"* não quer dizer
nada. Liste as palavras que ela **evita** e as que **prefere** — é o que mais
rápido tira o cheiro de robô.

**4. `# A EMPRESA` 🔒.** Não escreva os dados aqui. Eles vêm do banco pelos
marcadores e mudam quando a equipe edita a tela — sem deploy, sem tocar no
prompt. O que você escreve nesta seção é só **como ler** o que vai chegar.

**5. `# FLUXO DE ATENDIMENTO` — o mais importante.** O passo a passo que dá o
norte da conversa, e o que menos se escreve do zero: copie o que está no
`prompt.md` e troque as etapas. Duas coisas que todo fluxo precisa dizer, e
quase nenhum diz:

- **"se a pessoa já respondeu uma etapa, pule ela"** — sem isso ela pergunta o
  nome três vezes;
- o que fazer quando a pessoa **não** segue o roteiro. O caso mais importante já
  vem pronto no fim da seção: quem **já tem horário marcado** sai do funil.

**6. `# REGRAS DE ATENDIMENTO`.** Tudo o que vale em qualquer ponto da conversa,
cada assunto num subtítulo `##`: preço, a porta de entrada, pedido de opinião,
áudio, foto e vídeo, fora do horário, quando passar para uma pessoa — e, por
último, **as regras inegociáveis**. Três cuidados:

- **Inegociáveis são curtas**, uma por linha, começando por "Nunca". E toda
  proibição precisa dizer **o que fazer no lugar** — "nunca avalie o caso"
  sozinho deixa a IA muda na frente de uma foto.
- **Quando passar para uma pessoa** diz o que é urgência no seu ramo. Sem isso
  ela tenta agendar um horário para quem se machucou às onze da noite.
- **Áudio, foto e vídeo** precisam de instrução. O brasileiro manda áudio na
  primeira mensagem e foto na terceira. O sistema entrega os dois; se o prompt
  não disser o que fazer, ela improvisa — e improvisar na frente de uma foto é
  como se avalia o caso sem querer.

> ⚠️ **Ela NÃO vê a foto — ela lê uma descrição.** Um modelo de visão olha a
> imagem antes e escreve uma linha; é essa linha que chega até ela, do mesmo
> jeito que o áudio chega transcrito. Um prompt que promete "você consegue ver
> a imagem" faz ela falar como quem viu, e transforma qualquer falha em
> encenação: ela acolhe a dor, imagina o incômodo e recusa o diagnóstico de uma
> foto que nunca chegou. Aconteceu na clínica de origem, e não foi alucinação —
> foi o roteiro sendo seguido à risca sobre um dado ausente.
>
> Duas situações precisam de saída própria no prompt:
>
> | Situação | Como ela sabe | O que ela faz |
> |---|---|---|
> | A foto não abriu | O código escreve `não consegui abrir esta foto` — literal, em todo ramo | Não recebeu nada. Pede para mandar de novo |
> | A foto não é do assunto | **Genérico:** o descritor só descreve, e ela compara com os serviços. **Kit de clínica:** o descritor sabe o que é odontologia e marca `Sem relação com odontologia` | Não acolhe queixa nenhuma — não há queixa ali. Diz com leveza que a foto não parece ser do assunto |
>
> O marcador só existe quando o descritor sabe qual é o assunto. Escrevendo o
> descritor do seu ramo, você pode dar esse assunto a ele e criar o seu — e
> então o prompt precisa da linha que o reconhece.

**7. `# FERRAMENTAS` 🔒.** Uma subseção por ferramenta, dizendo **quando** usar.
Os nomes são a chamada de verdade (ver a seção 2).

**8. `# DATA E HORA ATUAL` 🔒.** O marcador vira *"Hoje é terça-feira,
11/09/2026, e agora são 14:32."* — a data **e** a hora. Embaixo, só como usar.

**9. `# QUEM ESTÁ FALANDO COM VOCÊ` 🔒.** A ficha da pessoa, e como ler cada
linha dela. É a última coisa que o modelo lê antes da conversa.

---

## 4. Como escrever cada linha

O formato não é estilo. É o que o modelo obedece.

**Uma ordem por linha, com `-` na frente, no imperativo.** Parágrafo o modelo
resume, e o resumo dele de seis frases é "seja gentil". Linha curta ele executa.

```
❌  É importante que a Letícia sempre confira a disponibilidade antes de
    confirmar qualquer horário com o paciente, pois ela não tem acesso direto
    à agenda e pode acabar confirmando algo que já está ocupado.

✅  -   Nunca confirme um horário sem ter usado `ver_horarios_livres`.
```

**Negrito no que não pode passar.** Poucas palavras por seção — negrito em tudo é
negrito em nada.

**Exemplo literal onde o tom importa.** Uma frase pronta entre aspas ensina mais
rápido que três linhas descrevendo o tom. Mas cuidado: o modelo copia o exemplo
quase palavra por palavra. Escreva o exemplo como você quer ouvir.

**Detalhe pequeno vira regra própria.** Coisas como *"nunca use travessão"* ou
*"nunca repita o nome da pessoa"* parecem mesquinhas escritas assim. São elas
que entregam o atendimento automático.

**Regra colada no dado pesa mais.** Se uma regra depende de uma informação, repita
ela **junto** da informação, no fim do arquivo — não só na seção de regras, dez
telas acima. Parece redundância e não é: neste projeto, na clínica de origem, a
agente ofereceu agendamento a quem tinha consulta no dia seguinte, com o dado na
frente dela, e só parou quando a ordem foi colada no dado.

---

## 5. Depois de editar

```bash
npm run agente:deploy   # regera o prompt E publica a função
```

> Um comando só: o `agente:deploy` já roda o `npm run prompt` antes. Rodar os
> dois não faz mal — só é redundante.

> **O `npm run prompt` confere antes de gerar.** Se o prompt perdeu um
> marcador, uma das nove seções, a subseção de uma ferramenta ou uma frase da
> ficha — tudo o que está no 🔴 da seção 2 —, ele para, diz o que falta, e
> **nada é publicado**. Quem confere é o
> [`conferir-contrato.mjs`](conferir-contrato.mjs). Ele pega o que quebra em
> silêncio; o que ela **fala**, só o teste no WhatsApp mostra.

Não pulou nenhum passo? Então:

1. Ligue o **modo teste** e ponha o seu número na lista, na página Atendente de
   IA. Sem isso, o primeiro teste responde a um cliente de verdade.
2. Converse com ela pelo WhatsApp como um cliente conversaria — inclusive
   torto: mandando áudio, mudando de ideia, perguntando preço três vezes.
3. Leia a conversa na tela **Conversas**, do lado da equipe.

> **Nenhum prompt nasce pronto.** O da clínica de origem foi para produção
> parecendo ótimo, e o primeiro teste real derrubou seis coisas em uma tarde. Reserve os primeiros
> dias para ajustar — é trabalho previsto, não sinal de que deu errado.

---

## 6. O que este guia não repete

De propósito:

| Onde | O que está lá |
|---|---|
| [`prompt.md`](prompt.md) | O prompt inteiro, funcionando. É o exemplo |
| [`README.md`](README.md) § 8 | Por que cada decisão do prompt foi tomada, e o que o primeiro teste real quebrou |
| [`README.md`](README.md) § 7 | As oito ferramentas, uma a uma |
| [`DATABASE.md`](../DATABASE.md) § 8 | Tudo o que o agente lê e grava no banco |
| [`CLAUDE.md`](../CLAUDE.md) | As regras do projeto inteiro |

Se uma regra estiver escrita aqui **e** lá, um dia as duas discordam. Este guia
ensina a escrever; os outros contam o que já está escrito.
