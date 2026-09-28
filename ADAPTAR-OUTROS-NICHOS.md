# Adaptar a outro ramo

Para qualquer negócio que atende com hora marcada e **não é clínica**:
barbearia, salão, estúdio de tatuagem, oficina, escritório de advocacia,
consultoria, pet shop, personal trainer. **É clínica?** O guia é o
[`ADAPTAR-CLINICAS.md`](ADAPTAR-CLINICAS.md).

O Núcleo chega pronto para qualquer ramo: as telas falam de lead, cliente,
serviço, profissional e agendamento, e a atendente de IA vem com um prompt
genérico, que atende qualquer negócio. Adaptar é dar a ele o **seu** negócio —
os serviços, quem atende, e as regras do seu ramo na boca da atendente.

> **Ainda não existe receita pronta por ramo.** Este guia é o questionário que
> monta a sua. O que sai dele é um **kit** — a mesma forma do kit de clínica
> odontológica —, guardado em `kits/<seu-ramo>/`.

---

## Como usar

**Você, que vai adaptar**, abra o projeto na IDE com IA e cole:

```
Leia o ADAPTAR-OUTROS-NICHOS.md e adapte o sistema para o meu negócio.
Me faça as perguntas uma de cada vez.
```

**Você, IA, que vai conduzir:**

1. **Leia antes de perguntar:** o [`CLAUDE.md`](CLAUDE.md), o
   [`agente-ia/GUIA-DO-PROMPT.md`](agente-ia/GUIA-DO-PROMPT.md), o prompt
   genérico ([`agente-ia/prompt.md`](agente-ia/prompt.md)) e o kit de clínica
   ([`kits/clinica-odontologica/`](kits/clinica-odontologica/)), que é o
   exemplo de um kit pronto.
2. **Uma pergunta por vez, em português simples**, com um exemplo de resposta.
   Quem responde pode não ser programador.
3. **Não adivinhe a regra de uma profissão.** O que a atendente não pode dizer,
   e o que é urgência, vem da pessoa — nunca de um palpite seu.
4. **Mostre antes de publicar.** Cada seção do prompt que você reescrever,
   mostre o antes e o depois.
5. **Siga a ordem.** A seção 1 pode encerrar a conversa antes do resto.

---

## Quando fazer, e o token do Supabase

**O melhor momento é durante a instalação**: depois das partes 5.1 e 5.2 do
[`INSTALACAO.md`](INSTALACAO.md) (empresa e horários) e antes da parte 6. Este
guia cobre as partes 5.3 e 5.4 com as perguntas — e o token do Supabase ainda
existe. Ele é preciso para três coisas daqui:

| Precisa do token | Não precisa |
|---|---|
| Rodar o SQL dos serviços | Cadastrar pela tela (serviços, profissionais, jornada) |
| Trocar o nome da atendente | Responder as perguntas |
| Publicar a atendente (`npm run agente:deploy`) | Escrever o kit |

**Depois da instalação também dá**, com um token novo: o
[`.supabase-token.example`](.supabase-token.example) diz como gerar, e no fim
ele é revogado de novo, como na parte 6. O SQL pode ir, em vez disso, pelo
**SQL Editor** do painel do Supabase: colar e clicar em Run.

---

## 1. Primeiro: o sistema serve para o seu negócio?

O Núcleo vende **hora de alguém**: uma pessoa atende uma pessoa, num horário.
Algumas coisas ficam fora disso, e é melhor saber agora do que depois de
cadastrar tudo.

**Você, IA: faça estas perguntas primeiro.** Se alguma resposta for sim, diga
com todas as letras o que não cabe, antes de seguir.

| Pergunte | Se for sim |
|---|---|
| "Vocês atendem em grupo — aula, turma, sessão com várias pessoas no mesmo horário?" | **Não cabe.** Cada profissional atende uma pessoa por vez, e quem garante isso é uma trava do banco — a mesma que impede a atendente e a recepção de marcarem duas pessoas no mesmo horário |
| "Além das pessoas, vocês agendam sala, box, máquina ou equipamento?" | **Cabe, com um jeitinho:** cadastre o recurso como se fosse um profissional ("Box 1", "Sala 2"). Funciona; só fica misturado na lista de profissionais |
| "Cada profissional precisa entrar no sistema e ver só a própria agenda?" | **Não existe.** Todo usuário com login vê e mexe em tudo: agendas, conversas e valores |
| "Vocês vendem pacote, plano ou mensalidade?" | **O sistema não controla.** Ele marca horário avulso e anota o valor pago; sessões restantes e mensalidade ficam por fora |
| "O cliente de vocês costuma ser uma empresa, com várias pessoas falando?" | **Não cabe bem.** Para o sistema, a pessoa **é** o número de WhatsApp dela |
| "O negócio fica fora do Brasil?" | **Não cabe sem mexer no código:** real, estados, CEP e os fusos do Brasil estão escritos nele |
| "Vocês têm mais de uma unidade?" | **Uma instalação por unidade** — um projeto do Supabase e um WhatsApp para cada uma |

> **Um "bom saber", que não impede nada:** quando o cliente não pede um
> profissional, a agenda escolhe **o primeiro livre em ordem alfabética**. Com
> dois profissionais ninguém percebe; com oito, o primeiro nome da lista enche
> antes dos outros.

---

## 2. As perguntas

**Você, IA:** uma por vez, com o exemplo. Anote tudo antes de escrever qualquer
coisa — a seção 3 diz para onde cada resposta vai.

### 2.1. O negócio

| Pergunte | Exemplo de resposta | Vai para |
|---|---|---|
| "O que a sua empresa faz, numa frase?" | "Barbearia: corte, barba e sobrancelha, só masculino" | `# IDENTIDADE` e `# SUA FUNÇÃO` do prompt |
| "Como vocês chamam quem é atendido — cliente, aluno, tutor?" | "Cliente mesmo" | O prompt; e, se for outra palavra, a lista de 3.5 |

### 2.2. Os serviços

Um por um. **Nome sem marca registrada**: a descrição do que é, nunca o nome
comercial.

| Pergunte | Por quê |
|---|---|
| "Qual o nome do serviço, do jeito que o cliente fala?" | É o nome que ela fala, e o único que o sistema aceita marcar |
| "Em uma linha, o que é?" | A descrição curta vai em **toda** conversa. Palavras do cliente, sem termo técnico |
| "Como funciona, quanto tempo leva, que cuidado precisa?" | A descrição longa: é o que ela responde a *"como funciona?"*. Sem promessa de resultado |
| "Quanto tempo ocupa na agenda?" | O tamanho do bloco. Serviço de 90 minutos cadastrado com 60 deixa a agenda marcar outro cliente em cima |
| "O preço pode ser dito? Qual?" | Três respostas possíveis, e cada uma muda o que ela fala |

| O preço é… | Cadastre | Ela fala |
|---|---|---|
| fixo, ou a partir de um valor | o valor | *"a partir de R$ X"* |
| de graça | `0` | *"é sem custo"* — e usa isso com quem trava no preço |
| combinado caso a caso | vazio | não fala valor nenhum |

> ⚠️ **Zero não é "não sei".** Zero é a atendente afirmando, ao primeiro
> cliente, que aquilo é de graça.

### 2.3. A porta de entrada

"Algum atendimento vem antes dos outros — um orçamento, uma avaliação, um
diagnóstico? Quais serviços passam por ele?"

- **Não:** a atendente marca tudo direto. É o caso normal de barbearia e salão.
- **Sim:** esse serviço vira a porta de entrada, e os que passam por ela ficam
  marcados com *"Passa pela porta de entrada"*. Quem pede um deles sai com a
  porta marcada, e o que queria fica anotado junto. Pergunte também se a porta
  é cobrada — o preço dela segue a tabela de 2.2.

### 2.4. Os profissionais

"Quem atende, em que dias e horários? Alguém só faz alguns serviços?"

Isso vai pela **tela** (Profissionais), não por SQL: a cor e a jornada se
escolhem lá. Você, IA, anota e conduz a pessoa pela parte 5.4 do
[`INSTALACAO.md`](INSTALACAO.md). Quem faz todos os serviços fica com a lista
vazia — vazio quer dizer "faz todos".

### 2.5. O jeito de falar

| Pergunte | Vai para |
|---|---|
| "Mais formal ou mais próximo? Pode emoji?" | `# TOM DE VOZ` |
| "Tem palavra que o seu cliente usa e que ela deveria usar também? E alguma que soa errado no seu ramo?" | `# TOM DE VOZ` — as listas *Evite* e *Prefira* |

### 2.6. O que ela nunca pode dizer

**A pergunta mais importante do guia.** Todo ramo tem uma linha entre
**explicar** o serviço e **decidir pelo cliente**, e quem sabe onde ela passa é
o profissional.

"Tem alguma coisa que só o profissional pode dizer — e que, se a atendente
disser, dá problema?"

| Ramo | Exemplo de linha |
|---|---|
| Oficina | Nunca dizer qual é o defeito, nem quanto custa o conserto, sem o mecânico ver |
| Advocacia | Nunca opinar sobre o caso nem sobre a chance de ganhar |
| Estética | Nunca prometer resultado |
| Barbearia, salão | Talvez nenhuma além das que o prompt já tem |

⚠️ **O prompt genérico já tem essa linha, em palavras de qualquer ramo:**
*"Nunca avalie o caso da pessoa"* e *"Nunca indique o serviço para o caso da
pessoa"*. Ela nasceu de um erro real — na clínica de origem, era o
diagnóstico. **Traduza para o ramo; nunca apague.** Apagar não deixa buraco
visível: a atendente só fica prestativa demais e começa a opinar sobre o que
não pode.

### 2.7. Urgência

"No seu ramo, o que não pode esperar o próximo horário livre? E aí, o que ela
faz — chama alguém, passa um telefone?"

Por exemplo: carro quebrado na estrada, prazo que vence amanhã, cachorro
passando mal. Vai para `## Quando passar para uma pessoa`, que já diz
*"alguém machucado, passando mal ou em risco"* — acrescente o que é do ramo.

### 2.8. As fotos

"Que fotos seus clientes costumam mandar?" — o carro batido, a referência de
corte, um documento, uma conta.

A atendente **não vê a foto**: um modelo olha antes e escreve uma descrição,
seguindo o [`descritor-de-fotos.md`](agente-ia/descritor-de-fotos.md). Com a
resposta, dá para ensinar a ele o assunto do ramo (3.3).

### 2.9. Fora do horário

"De madrugada, ela marca normalmente, ou só responde e deixa para a equipe no
dia seguinte?" Vai para `## Fora do horário de atendimento`. O genérico marca
normalmente.

### 2.10. O nome dela

"Ela continua se chamando Letícia, ou vai ter outro nome?"

⚠️ **As telas tratam a atendente no feminino.** Umas 35 frases, em 9 telas,
dizem "a Letícia" — o botão *"Devolver para a Letícia"*, por exemplo. **Com
nome feminino, nada muda.** Com nome masculino, essas frases passam a dizer "a
Pedro", e o prompt também fala no feminino (*"Obrigada por mandar!"*). Dá para
trocar, mas é frase por frase — combine com a pessoa antes.

---

## 3. Com as respostas na mão

**Você, IA:** o que sai daqui é um kit em `kits/<ramo>/` — por exemplo,
`kits/barbearia/` —, com os mesmos três arquivos do kit de clínica. Guardado no
projeto, ele tem histórico, é conferível e dá para reinstalar.

### 3.1. `servicos.sql`

Copie a forma do
[`kits/clinica-odontologica/servicos.sql`](kits/clinica-odontologica/servicos.sql):
o cabeçalho que explica o que ele cadastra, o `insert` que pula serviço com o
mesmo nome (rodar duas vezes não duplica) e a porta de entrada, se houver.

⚠️ **Não é uma migração.** Não crie arquivo em `supabase/migrations/` para
isso, e nunca edite uma migração que já existe.

### 3.2. `prompt.md`

Parta do genérico, [`agente-ia/prompt.md`](agente-ia/prompt.md) — e não do de
clínica.

- **Mude só o que o GUIA manda mudar** (seção 2 dele): o 🟢 à vontade, o 🟡
  com cuidado, o 🔴 nunca.
- **Uma ordem por linha, com `-` na frente, no imperativo** (seção 4 do GUIA).
- **As nove seções ficam**, com os mesmos títulos e na mesma ordem. Assunto
  novo vira um subtítulo (`##`) dentro de uma delas.

### 3.3. `descritor-de-fotos.md`

Parta do genérico, [`agente-ia/descritor-de-fotos.md`](agente-ia/descritor-de-fotos.md).
Duas escolhas:

| Deixe como está | Ensine o assunto a ele |
|---|---|
| Ele só descreve, e a atendente compara com a lista de serviços | Diga o que é "do assunto" no ramo, e que ele comece a resposta **exatamente com** *"Sem relação com oficina:"* quando não for |
| Nada a mais no prompt | O prompt precisa reconhecer esse marcador, **com as mesmas palavras**, em `### Quando a foto não é do assunto`. É o que o kit de clínica faz |

As regras de **nunca avaliar** e **nunca descrever o que não viu** ficam no
descritor, em qualquer ramo.

### 3.4. Conferir o kit

```bash
node agente-ia/conferir-contrato.mjs kits/<ramo>
```

Ele confere o que quebra em silêncio: as nove ferramentas, os seis marcadores,
as nove seções e as frases que o código escreve e o prompt reconhece — o
marcador do descritor incluído. Tem que terminar em **"tudo certo"**.

### 3.5. Aplicar

1. **Os serviços:** rode o `servicos.sql` do kit no banco — com o token, do
   jeito que a parte 3 da instalação aplicou as migrações, ou pelo SQL Editor.
2. **A atendente:** copie o `prompt.md` e o `descritor-de-fotos.md` do kit para
   `agente-ia/`, por cima dos genéricos — **na instalação avulsa**. No Núcleo
   comercializado (uma pasta por clínica em [`clinicas/`](clinicas/LEIA-ME.md)),
   eles vão para `clinicas/<nome>/`, e o `agente-ia/` fica genérico.
3. **O nome dela**, se mudou:
   `update configuracoes_agente set nome_agente = 'Sofia';` — as telas mostram
   o nome novo no próximo F5. A tela não edita o nome, de propósito (ver o
   `CLAUDE.md`).
4. **A palavra do cliente**, se não é "cliente": acrescente-a à lista
   `NOMES_GENERICOS`, em
   [`supabase/functions/_shared/ferramentas.ts`](supabase/functions/_shared/ferramentas.ts).
   É a lista de palavras que a atendente nunca grava como nome de alguém — sem
   ela, um *"sou aluno"* pode virar o nome da pessoa na ficha. **Só
   acrescente, nunca tire.**
5. **Publique:** `npm run agente:deploy`. Ele confere o contrato de novo antes.
6. **Os profissionais:** a pessoa cadastra pela tela (parte 5.4 do
   `INSTALACAO.md`).
7. **Revise na tela:** a página Serviços — os cards, a porta de entrada e os
   preços.

E faça um commit — por exemplo, *"adaptação para barbearia"*.

---

## 4. Testar, antes de desligar o modo teste

Com o **modo teste** ligado e o número da pessoa cadastrado (página Atendente de
IA), converse com a atendente pelo WhatsApp como um cliente conversaria —
inclusive torto:

| Mande | Ela precisa |
|---|---|
| "oi" | Se apresentar e perguntar o nome |
| O preço de um serviço com valor, de um sem valor e o da porta | Falar só o que está escrito — e o "sem custo" uma vez só |
| "quero marcar" | Marcar de verdade: confira na Agenda |
| "que dia é meu horário mesmo?" | Achar o horário, e não oferecer agendar de novo |
| Remarcar, e depois cancelar | Perguntar se não prefere remarcar, antes de cancelar |
| Um áudio | Responder como se fosse texto |
| Uma foto do assunto, e depois um meme | Acolher a primeira sem avaliar; perceber que a segunda não é do assunto |
| "isso resolve o meu caso?" | Dizer que quem indica é o profissional, e oferecer o horário |
| A urgência do ramo | Parar de conduzir e chamar alguém da equipe |
| Uma mensagem às 23h | Atender normalmente, sem prometer retorno imediato |

Depois, abra **Conversas** e a **ficha** da pessoa: o nome, o que ela procura e
o resumo têm que estar lá.

> **Nenhum prompt nasce pronto.** O da clínica de origem foi para produção
> parecendo ótimo, e o primeiro teste real derrubou seis coisas numa tarde.
> Reserve os primeiros dias para ajustar.

---

## 5. As palavras da tela (opcional)

As telas usam palavras de qualquer ramo — Leads, Clientes, Serviços,
Profissionais, Agendamento — **de propósito**: são as mesmas em toda
instalação. Se o negócio fizer questão de outra ("Alunos" em vez de
"Clientes"), dá. Mas é trabalho, e cada atualização futura do sistema vai
esbarrar nessa troca — combine antes.

**Você, IA, se for fazer:**

1. **Ache onde a palavra aparece:** `npm run nicho -- cliente --lista` mostra
   cada linha de texto que alguém lê, com arquivo e linha (o plural entra
   sozinho).
2. **Troque só o texto** — o que está entre aspas e aparece na tela. **Nunca**
   nome de tabela, coluna, rota, chave de status ou arquivo.
3. **Cuidado com o gênero.** "O agendamento marcado" vira "a sessão marcada":
   em cada frase, artigo e adjetivo precisam concordar. Os rótulos do funil são
   verbos ("Agendou", "Compareceu") justamente para não ter gênero.
4. **Os rótulos principais moram em poucos lugares:** `ROTULO_LEAD` e
   `ROTULO_CONSULTA` em [`src/lib/statusLead.ts`](src/lib/statusLead.ts), o
   `CONFIG` de [`src/components/PessoasPage.tsx`](src/components/PessoasPage.tsx),
   os itens da [`Sidebar.tsx`](src/components/Sidebar.tsx) e o cargo dela em
   [`src/lib/agente.ts`](src/lib/agente.ts).
5. **Confira:** `npm run build`, `npm run lint` (que já acusa 7 erros antigos —
   compare com o número) e abra cada tela mexida.

⚠️ **As rotas não mudam** — `/clientes` continua `/clientes`. Elas viajam em
link salvo e em URL com filtro.

---

## 6. O que não se mexe ao adaptar

| Não mexa | Por quê |
|---|---|
| Os nomes do banco (`consultas`, `crm_clinica`, `servicos_clinica`…) e as chaves de status (`consulta_agendada`…) | Vêm da clínica de origem e ficaram por contrato: telas, funções e a API dependem deles. Nenhum aparece na tela |
| As rotas e os campos da API externa ([`API_AGENTE.md`](API_AGENTE.md)) | Quem integra já usa. Lá, `/procedimentos` são os serviços, e `/consultas`, os agendamentos |
| O 🔴 do prompt: marcadores, nomes de ferramentas, as duas seções do fim, as frases da ficha | Quebra em silêncio. A conferência pega |
| O `prompt-oficial.ts` | É gerado. O que se edita são os `.md` |
| As migrações que já existem | Já rodaram em bancos de verdade. Serviço entra por kit, não por migração |
| A lista `NOMES_GENERICOS` | Só cresce. Tirar uma palavra traz de volta o defeito de gravar "cliente" como nome de alguém |

O resto das armadilhas — do banco, das telas, da agenda — está no
[`CLAUDE.md`](CLAUDE.md) e no [`DATABASE.md`](DATABASE.md), e vale igual aqui.
