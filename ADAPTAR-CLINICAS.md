# Adaptar para clínica

Para clínica de saúde: **odontológica**, que tem o caminho pronto, ou de outra
especialidade — estética, fisioterapia, nutrição, psicologia, medicina,
veterinária —, que parte do mesmo kit. **Não é clínica?** O guia é o
[`ADAPTAR-OUTROS-NICHOS.md`](ADAPTAR-OUTROS-NICHOS.md).

O Núcleo nasceu numa clínica odontológica, e o que ela usou em produção está
guardado em [`kits/clinica-odontologica/`](kits/clinica-odontologica/):

| Arquivo | O que traz |
|---|---|
| `servicos.sql` | 20 serviços, com as duas descrições e a duração. A **Avaliação Odontológica** como porta de entrada, sem custo e com 30 minutos; Limpeza e Clareamento agendam direto |
| `prompt.md` | A Letícia de clínica: as mesmas regras do genérico, mais as de saúde — nunca diagnosticar, nunca indicar tratamento, o que é urgência (dor forte, trauma, sangramento, inchaço), foto de boca |
| `descritor-de-fotos.md` | Sabe o que é odontologia, e marca a foto que não é com *"Sem relação com odontologia:"* |

**Por que partir do kit, e não do prompt genérico, em qualquer clínica:** o
genérico tem as mesmas proibições, só que em palavras de qualquer ramo —
*"nunca avalie o caso da pessoa"*. Em saúde, a palavra certa é
**diagnóstico**, e o kit já diz assim.

---

## Como usar

**Você, que vai adaptar**, abra o projeto na IDE com IA e cole:

```
Leia o ADAPTAR-CLINICAS.md e adapte o sistema para a minha clínica.
Me faça as perguntas uma de cada vez.
```

**Você, IA, que vai conduzir:**

1. **Leia antes:** o [`CLAUDE.md`](CLAUDE.md), o
   [`agente-ia/GUIA-DO-PROMPT.md`](agente-ia/GUIA-DO-PROMPT.md) e os três
   arquivos do kit.
2. **O que vale para qualquer ramo está no
   [`ADAPTAR-OUTROS-NICHOS.md`](ADAPTAR-OUTROS-NICHOS.md), e é de lá que se
   segue:** quando fazer e o token do Supabase (o começo dele), o nome da
   atendente (2.10), aplicar e publicar (3.5), testar (4), as palavras da tela
   (5) e o que não se mexe (6). Este guia cobre só o que é de clínica.
3. **Uma pergunta por vez**, em português simples.
4. **Regra de saúde não se escreve de palpite.** Diagnóstico, urgência e o que
   a atendente pode explicar vêm da clínica — e **um profissional da clínica
   lê** o que você escrever antes de publicar.

A primeira pergunta decide o caminho: **"A clínica é odontológica?"**

---

## Caminho A — clínica odontológica: o kit, quase pronto

### A.1. As perguntas

| Pergunte | Vai para |
|---|---|
| "Quais tratamentos da lista a clínica **não** faz?" | Desligar no card, na página Serviços |
| "A avaliação é gratuita, paga, ou combinada caso a caso?" | O valor da porta: `0`, o valor, ou vazio (tabela abaixo) |
| "Quais tratamentos têm um preço que pode ser dito, mesmo que 'a partir de'?" | O valor de cada um. Os que passam pela avaliação nunca têm preço falado |
| "Algum tratamento agenda direto, sem avaliação?" | O kit traz Limpeza e Clareamento assim. Os outros passam pela porta — muda na caixa do modal de Editar |
| "Quem são os dentistas, e alguém só faz alguns tratamentos?" | Profissionais, pela tela: a especialidade vira "Serviços que faz" |
| "A clínica atende convênio? Quais?" | Uma regra no prompt. O sistema não tem campo de convênio: ela responde pelo que o prompt disser |
| "Existe um telefone ou plantão para urgência?" | `## Quando passar para uma pessoa` |
| "Ela continua se chamando Letícia?" | 2.10 do `ADAPTAR-OUTROS-NICHOS.md` |

| A avaliação é… | Cadastre | Ela diz |
|---|---|---|
| gratuita | deixe `0` | *"a avaliação é sem custo"* — uma vez, para quem trava no preço |
| paga | o valor | *"a partir de R$ X"* |
| combinada caso a caso | vazio | não fala valor |

> ⚠️ **O `0` do kit foi uma decisão comercial da clínica de origem.** Deixado
> como está, a Letícia afirma ao primeiro paciente que a avaliação é de graça.

### A.2. Os textos longos precisam de um dentista

Os 20 textos longos do kit — o que ela responde a *"como funciona?"* — foram
escritos para outra clínica. Prazos, número de sessões e condutas mudam de uma
para outra, e **agora isso vai ser dito a paciente**.

**Você, IA:** depois de rodar o kit, junte os textos num arquivo para o
dentista ler, e aplique as correções dele — pela tela (Editar, em cada card) ou
num `update`. Não ligue a Letícia antes dessa leitura.

### A.3. Aplicar

1. **Confira o kit:** `node agente-ia/conferir-contrato.mjs kits/clinica-odontologica`
   — tem que dar "tudo certo".
2. **Os serviços:** rode o [`servicos.sql`](kits/clinica-odontologica/servicos.sql)
   no banco, com o token ou pelo SQL Editor. Rodar de novo não duplica.
3. **A atendente:** copie o `prompt.md` e o `descritor-de-fotos.md` do kit para
   `agente-ia/`, por cima dos genéricos, e acrescente o que as perguntas
   trouxeram (convênio, telefone de urgência).
4. **As respostas de A.1**, pela tela: desligar, preços, a caixa da porta, os
   dentistas.
5. **Publique:** `npm run agente:deploy`.
6. **Teste** com a lista da seção 4 do
   [`ADAPTAR-OUTROS-NICHOS.md`](ADAPTAR-OUTROS-NICHOS.md), mais estas:

| Mande | Ela precisa |
|---|---|
| Uma foto dos dentes | Acolher sem dizer o que é — nem que "parece normal" |
| "tá doendo muito e inchou" | Tratar como urgência e chamar alguém da recepção, sem oferecer avaliação comum |
| "lente resolve pra mim?" | Dizer que quem indica é o dentista, e oferecer a avaliação |
| "quanto custa a lente?" | Não falar valor — ele sai na avaliação —, e emendar o "sem custo" se a avaliação for gratuita |

---

## Caminho B — outra especialidade: o kit como ponto de partida

Estética, fisioterapia, nutrição, psicologia, medicina, veterinária. As regras
de saúde do kit servem; o que é de dente, não.

> **Estética já tem kit:** [`kits/clinica-estetica/`](kits/clinica-estetica/),
> montado nesta instalação a partir do odontológico — 10 procedimentos, a
> Avaliação Estética como porta de entrada, a urgência de reação a
> procedimento (e o SAMU para falta de ar) e o marcador
> *"Sem relação com estética:"*. Serve de ponto de partida para outra clínica
> de estética; os textos e os preços são os desta.

### B.1. As perguntas

Faça as da seção 2 do [`ADAPTAR-OUTROS-NICHOS.md`](ADAPTAR-OUTROS-NICHOS.md) —
os serviços, a porta, os profissionais, o tom, as fotos, o horário. Três delas
pesam mais numa clínica:

| Pergunte | Por quê |
|---|---|
| "Como se chama quem atende — fisioterapeuta, nutricionista, psicóloga, veterinário?" | É a palavra que entra no lugar de "dentista" em todo o prompt |
| "O que é urgência na sua especialidade, e o que fazer?" | É a linha que protege o paciente. Os exemplos abaixo são ponto de partida — confirme com o profissional responsável |
| "O primeiro atendimento é uma avaliação, uma consulta inicial?" | Quase toda clínica tem porta de entrada. Se não tiver, o prompt precisa dizer isso (B.3) |

**Pontos de partida para a urgência**, para a clínica confirmar ou corrigir:

| Especialidade | O que costuma ser urgência |
|---|---|
| Fisioterapia | Dor forte depois de queda ou trauma; perda de força ou de sensibilidade de repente |
| Estética | Reação depois de um procedimento: inchaço, vermelhidão forte, falta de ar |
| Nutrição | Qualquer sinal de passar mal — a atendente não orienta: manda procurar um médico |
| Psicologia | Qualquer sinal de risco à vida. A atendente **não conduz**: chama alguém da equipe e passa o CVV (188) e o SAMU (192) |
| Veterinária | Animal atropelado, envenenado ou com dificuldade para respirar |

### B.2. O kit da especialidade

**Você, IA:** monte `kits/clinica-<especialidade>/` — por exemplo,
`kits/clinica-fisioterapia/` — a partir do kit odontológico:

| Arquivo | O que fazer |
|---|---|
| `servicos.sql` | **Não copie o odontológico.** Escreva o da especialidade na mesma forma — o cabeçalho, o `insert` que pula nome repetido, a porta —, com os serviços das perguntas |
| `prompt.md` | Copie o do kit odontológico e troque o que é de dente (B.3) |
| `descritor-de-fotos.md` | Copie o do kit e troque o assunto e o marcador (B.4) |

### B.3. O que trocar no prompt

O prompt do kit fala de dente em mais de trinta linhas. Não é trocar palavra
por palavra: é reler cada uma.

| No kit odontológico | Troque por |
|---|---|
| *"secretária de uma clínica odontológica"*, na primeira linha | A especialidade: *"de uma clínica de fisioterapia"* |
| "o dentista" | O profissional da especialidade |
| Os exemplos de dente, boca e sorriso (*"meu dente tá escuro"*, *"lente resolve pra mim?"*) | Exemplos da especialidade, que um paciente de verdade diria |
| A urgência: *"dor forte, trauma, sangramento, inchaço ou acidente"* | A da especialidade (B.1) |
| `## A avaliação é a porta de entrada` | O nome da porta da clínica. **Sem porta**, traga do genérico a linha *"Nenhuma linha traz isso? Então a empresa não tem serviço de entrada: agende tudo direto"* |
| O exemplo do resumo (lentes de contato, espaço entre os dentes) | Um caso da especialidade |

**O que não se troca:** *"Nunca dê diagnóstico"* e *"Nunca indique
tratamento"* ficam como estão — em saúde, são exatamente as palavras certas. E
o 🔴 do GUIA fica intacto em qualquer caso.

### B.4. O descritor

O do kit sabe o que é odontologia: *"boca, dentes, gengiva, aparelho, prótese,
radiografia"*. Troque pelo assunto da especialidade — na fisioterapia,
postura, articulação, exame de imagem, laudo —, e o marcador junto:

- **No descritor:** que ele comece a resposta **exatamente com**
  *"Sem relação com fisioterapia:"* quando a foto não for do assunto.
- **No prompt**, em `### Quando a foto não é do assunto`: as **mesmas**
  palavras.

A conferência confere esse par. **As proibições do descritor ficam:** nunca
diagnosticar, nunca dizer que algo está "normal", nunca descrever o que não viu.

> **Psicologia quase não recebe foto.** Nesse caso o descritor genérico
> ([`agente-ia/descritor-de-fotos.md`](agente-ia/descritor-de-fotos.md)) serve
> melhor — e então o prompt não espera marcador nenhum.

### B.5. Aplicar e testar

Como no caminho A: conferir
(`node agente-ia/conferir-contrato.mjs kits/clinica-<especialidade>`), rodar o
`servicos.sql`, copiar os dois `.md` para `agente-ia/`, publicar e testar — com
uma foto da especialidade, a urgência dela e um *"isso resolve pra mim?"*.

**E um profissional da clínica lê o prompt antes de ele ir para o ar.** É a
única parte da adaptação em que um erro não se desfaz depois de enviado.

---

## E "Pacientes" em vez de "Clientes"?

É o pedido mais comum de clínica. As telas dizem Leads e Clientes de
propósito — são as mesmas em toda instalação —, mas dá para trocar. O caminho e
os cuidados estão na seção 5 do
[`ADAPTAR-OUTROS-NICHOS.md`](ADAPTAR-OUTROS-NICHOS.md). "Paciente" tem o mesmo
gênero de "cliente", então é das trocas mais simples.
