# Comercialização do Núcleo — plano, situação e próximos passos

Documento de passagem: o que foi decidido para vender o Núcleo a clínicas, o
que já está pronto e onde a próxima sessão continua. As regras **técnicas** de
cada peça estão no [`CLAUDE.md`](../CLAUDE.md) (seções "Celular", "Várias
clínicas", "A atendente de cada clínica" e "Instalar como aplicativo"); aqui
fica o lado de negócio e a ordem das coisas.

Última atualização: 28/09/2026.

---

## 1. Onde estamos

| Peça | Situação |
|---|---|
| Sistema responsivo (celular) — recepção, profissionais e dona | ✔ No ar |
| Instalar como aplicativo, na cor da clínica | ✔ No ar |
| **Fase 1** — um site, um endereço por clínica | ✔ No ar |
| **Fase 2** — a atendente de cada clínica em `clinicas/<nome>/` | ✔ Pronta |
| **Níveis de acesso** — dona, recepção, profissional, com permissões por pessoa e a aba Equipe | ✔ No ar (migrações 0031–0035) |
| **Fase 3** — `clinica:nova`: criar uma clínica inteira com um comando | ⏭ Próxima |
| Fases 4 a 7 | Ver seção 4 |

**O que está em produção hoje:**

| O quê | Onde |
|---|---|
| A clínica atual | https://nucleoestetica.dbxtecnologia.online — kit em `clinicas/nucleo-estetica/` |
| O endereço antigo (continua valendo, pelo `.env`) | https://nucleo-agente-crm.vercel.app |
| Site | Vercel **Pro**, time "Nisimura Design", projeto `nucleo-agente-crm`; domínio coringa `*.dbxtecnologia.online` (DNS na Vercel) |
| Banco da clínica atual | Supabase, projeto `yrdbsrjdscyitrmearni` (plano **gratuito**) |
| Código | GitHub `franknisimura2-cloud/nucleo-agente-crm` (**privado**) — `main` publica o site sozinho |
| WhatsApp | uazapi, uma instância |

---

## 2. As decisões, e por quê

| Decisão | Por quê |
|---|---|
| **Uma instalação (projeto Supabase) por clínica**, e não um banco com todas | O sistema inteiro supõe uma clínica por banco; juntar seria reescrever 30 migrações, o RLS e o agente. E dados de saúde isolados por construção são argumento de venda. Reavaliar com ~30–50 clínicas |
| **Um site só** para todas, clínica descoberta pelo endereço | Uma atualização da tela chega a todas de uma vez |
| **Vercel Pro**, e não o VPS da Hostinger | Link de teste por branch, voltar versão num clique, nada de servidor para manter. O VPS fica para o que não é das clínicas (automações, backups) |
| **Domínio coringa `*.dbxtecnologia.online`** com o DNS na Vercel | Clínica nova ganha endereço sem mexer em DNS — só a ficha. E-mail ou site da DBX no domínio passam a ser configurados no DNS da Vercel |
| **Sem service worker** no aplicativo | Nenhuma clínica fica presa numa versão velha depois de um deploy |
| **Funil sem arrastar no celular** | A dona lê; mover de etapa é no computador ou na ficha |

---

## 3. Da primeira conversa até a clínica usando

| # | Etapa | Quem | Tempo |
|:-:|---|---|---|
| 1 | **Qualificação:** uma unidade só? Atende uma pessoa por horário? Tem um chip só para o WhatsApp? Aceita WhatsApp não oficial? (seção 1 do [`ADAPTAR-OUTROS-NICHOS.md`](../ADAPTAR-OUTROS-NICHOS.md)) | Frank | 15 min |
| 2 | **Demonstração** numa "Clínica Demo" com dados fictícios (a criar) | Frank | 30–45 min |
| 3 | **Proposta e contrato:** implantação + mensalidade, quem paga OpenAI e uazapi, cláusula de dados (LGPD), termos | Frank + clínica | — |
| 4 | **Questionário:** empresa, horários, serviços (nome, descrições, preço, duração, avaliação), profissionais (jornada, o que cada uma faz), urgência, tom, e-mails de acesso | Clínica | 1–2 dias |
| 5 | **Provisionamento** (`clinica:nova`, fase 3): projeto Supabase, migrações, conferência de segurança, chave OpenAI, secrets, funções, logins, pasta e ficha | Frank | ~30 min |
| 6 | **Conteúdo:** kit da clínica (serviços + prompt, como o de estética). **Uma profissional da clínica revisa o prompt** | Frank + clínica | 1–2 dias |
| 7 | **WhatsApp**, por chamada: código de 8 dígitos no celular da clínica e "Apontar para cá" | Frank + clínica | 15 min |
| 8 | **Treinamento** de 1 h: recepção (Conversas), profissionais (Agenda no celular, instalar o app), dona (Dashboard e funil) | Frank | 1 h |
| 9 | **Teste assistido** com modo teste ligado e os números da equipe | Clínica | 3–7 dias |
| 10 | **Aceite** por escrito (checklist da parte 6 do [`INSTALACAO.md`](../INSTALACAO.md)) | Os dois | — |
| 11 | **Liberação:** a clínica desliga o modo teste — decisão registrada como dela | Clínica | — |
| 12 | **Acompanhamento:** revisar o prompt na 1ª e na 4ª semana, com conversas reais | Frank | — |

Do "fechou" à liberação: **1 a 2 semanas**, quase tudo tempo da clínica.

---

## 4. O que falta construir

| Fase | O quê | Depende de |
|:-:|---|---|
| **0** | **Bloqueios de negócio** (seção 5) | Frank |
| **3** | **`npm run clinica:nova`** — ver o roteiro na seção 6 | Supabase Pro + um token novo do Supabase na hora do teste real |
| **4** | **`npm run atualizar:todas`**: aplica as migrações novas e publica as funções em cada clínica. Precisa de uma tabela que registre as migrações já aplicadas (hoje não há) | Fase 3 |
| **5** | **Operação:** suspender/reativar (a ficha já suporta `"situacao": "suspensa"`), exportar os dados de uma clínica, painel/lista das clínicas | — |
| **6** | **Material:** questionário, checklist de implantação, roteiro de treinamento, a instalação "Clínica Demo" | — |
| **7** | `instalar:conferir` entender `clinicas/<nome>/` (hoje procura as chaves em `agente-ia/`, onde não estão mais) | — |

Mais para frente: verificação em duas etapas para a equipe das clínicas;
convite por e-mail (pede um SMTP próprio); API oficial do WhatsApp (Meta).

**Aplicar migrações** num banco: `node scripts/aplicar-migracoes.mjs` (ou
`--clinica <nome>`) — só as que faltam, registradas em
`public._migracoes_aplicadas`. A fase 4 vai rodar isso em todas as clínicas.

---

## 5. Pendências de negócio (antes do primeiro contrato)

1. **Licença do código.** O README diz que quem recebe acesso pode instalar
   para si ou para um cliente, **mas não redistribuir**. Vender como produto
   próprio pede um acordo **por escrito** com o autor original.
2. **Supabase Pro** (~US$ 25/mês + ~US$ 10/mês por projeto). O gratuito não tem
   backup, pausa projeto parado e permite só 2 projetos. A primeira clínica
   pagante já justifica.
3. **LGPD:** conversas de clínica podem ter dado de saúde (sensível). A clínica
   é controladora; a DBX, operadora. Contrato com cláusula de tratamento de
   dados, termos de uso e política de privacidade — com advogado.
4. **Verificação em duas etapas** em Supabase, Vercel, GitHub e OpenAI.
5. **As chaves de cada clínica** (`clinicas/<nome>/.env.agente.local`) num
   gerenciador de senhas: é o único registro delas, e o Supabase não as devolve.

**Custo aproximado por clínica** (conferir os preços antes de montar a
tabela): Supabase ~US$ 10/mês; uazapi por instância; OpenAI pelo uso (limite de
gasto por projeto); Vercel Pro e domínio são fixos, divididos entre todas.

---

## 6. Roteiro da fase 3 (`clinica:nova`)

Um comando que recebe o nome da clínica (e o kit de origem) e faz, na ordem:

1. **Cria o projeto** pela Management API do Supabase (`POST /v1/projects`,
   região `sa-east-1`, senha do banco gerada e mostrada uma vez) e espera ficar
   `ACTIVE_HEALTHY`.
2. **Busca a chave pública** (`/v1/projects/{ref}/api-keys`).
3. **Aplica as 30 migrações** em ordem, pela rota `database/query` — o mesmo
   caminho que a instalação da clínica atual usou — e roda as consultas de
   segurança da seção 10 do [`DATABASE.md`](../DATABASE.md) (as duas têm que
   voltar vazias).
4. **Cria `clinicas/<nome>/`** a partir do kit (prompt, descritor,
   `clinica.json` com o `supabase_ref`) e o `.env.agente.local` com o segredo
   do webhook gerado; as chaves da OpenAI e da uazapi são coladas pelo Frank.
5. **Sobe os secrets e publica as duas funções** com `--clinica <nome>`.
6. **Roda o `servicos.sql`** do kit.
7. **Cria os logins** (a lógica do `npm run instalar:usuario`, apontada para o
   projeto novo).
8. **Cria a ficha** `public/clinicas/<nome>.dbxtecnologia.online.json`.
9. Mostra o checklist do que falta: WhatsApp, treinamento, teste, aceite.

Tudo com `--simular` primeiro. O token do Supabase é gerado para a sessão e
revogado no fim.

---

## 7. Continuar em outro computador

```bash
git clone https://github.com/franknisimura2-cloud/nucleo-agente-crm.git
cd nucleo-agente-crm
npm install
```

Fora do Git, e por isso fora do clone:

| Arquivo | Levar como |
|---|---|
| `.env` (endereço e chave **pública** do Supabase) | Copiar, ou recriar a partir de `public/clinicas/` |
| `clinicas/nucleo-estetica/.env.agente.local` (OpenAI, uazapi, segredo do webhook) | **Só** por gerenciador de senhas ou pendrive |
| `.supabase-token.local` | Não existe: gerar um novo quando for publicar, e revogar no fim |

Ao começar: `git pull`. Ao terminar: commit e `git push`.

Para o Claude Code continuar: *"Leia o `docs/COMERCIALIZACAO.md` e o
`CLAUDE.md`, e continue a fase 3."*

Os testes de tela sem celular e sem banco estão em
[`scripts/teste/`](../scripts/teste/LEIA-ME.md).
