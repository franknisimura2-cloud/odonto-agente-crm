# Banco de Dados — Núcleo

Documentação completa do schema. Serve para quem baixar este sistema e precisar
**reconstruir o banco do zero** num projeto Supabase novo.

> Este documento foi gerado a partir da inspeção do banco em produção
> (`information_schema`, `pg_constraint`, `pg_policies`, `pg_indexes`), não de
> memória. Tudo aqui é o que existe de fato.

- **Banco:** PostgreSQL 17.6 (Supabase)
- **Migração completa:** [`supabase/migrations/0001_schema_inicial.sql`](supabase/migrations/0001_schema_inicial.sql)
- **Tipos TypeScript espelhando o schema:** [`src/types/index.ts`](src/types/index.ts)

---

## 1. As migrações, uma a uma

> ### 📘 Instalando? O passo a passo é o [`INSTALACAO.md`](INSTALACAO.md)
>
> Esta seção **não é um guia de instalação** — é a referência do que cada
> migração faz. Criar o projeto, preencher as chaves, criar o primeiro usuário
> e subir a aplicação estão todos lá, num caminho só.
>
> Ela ficou aqui porque é documentação **do banco**: quem vai mexer numa tabela
> precisa saber em qual arquivo ela nasceu, e por quê.

### 1.1. Rodar as migrações

Abra o **SQL Editor** no painel do Supabase e execute os **trinta arquivos,
nesta ordem** — cada um depende do anterior:

1. `supabase/migrations/0001_schema_inicial.sql` — 6 tabelas, 1 view, 9 índices,
   13 políticas de RLS, 2 buckets de Storage, 2 funções, 2 triggers, a
   publicação de Realtime e os dados iniciais.
2. `supabase/migrations/0002_agenda_profissionais.sql` — agenda e profissionais:
   3 tabelas, 8 colunas novas em `consultas`, a restrição que impede
   agendamento duplo, 3 políticas de RLS, 2 funções, 3 triggers e o fuso horário
   da empresa.
3. `supabase/migrations/0003_whatsapp_unico.sql` — WhatsApp normalizado e único:
   1 função, 1 trigger e o índice que impede duas pessoas com o mesmo número.
4. `supabase/migrations/0004_api_agente.sql` — API do Agente de IA: a tabela
   `api_tokens` e as 7 funções que sustentam os endpoints (a Edge Function
   chama 6 delas direto; `agenda_profissionais_livres` é usada por dentro de
   `agenda_marcar` e `agenda_remarcar`, quando a pessoa não escolhe
   profissional).
5. `supabase/migrations/0005_catalogo_procedimentos.sql` — os 20 procedimentos
   da clínica odontológica onde o sistema nasceu, no lugar dos 3 de exemplo do
   seed inicial. Só dados.
6. `supabase/migrations/0006_informacoes_clinica.sql` — endereço e links da
   empresa: 8 colunas novas em `configuracoes_clinica`, 2 restrições e a view
   `informacoes_clinica_agente`, de coluna única, que o Agente de IA lê.
7. `supabase/migrations/0007_horario_na_view.sql` — a linha `Atendimento:` na
   view, montada de `horario_comercial` por `horario_atendimento_texto()`.

   > ⚠️ **Essa função não sobrevive à instalação.** A migração `0009` a
   > substitui por `jornada_texto()` e roda `drop function` nela. Num banco já
   > migrado, procurar `horario_atendimento_texto()` não acha nada — e está
   > certo. Ver [4.15](#415-jornada_textoprofissional).
8. `supabase/migrations/0008_procedimentos_view.sql` — a view
   `procedimentos_clinica_agente`, de coluna única, com os serviços ativos.
9. `supabase/migrations/0009_profissionais_view.sql` — a view
   `profissionais_clinica_agente`, com a jornada de cada profissional, e a
   função `jornada_texto()`, que unifica a montagem da frase de horário.
10. `supabase/migrations/0010_agente_conversas.sql` — as conversas do WhatsApp:
    a tabela `mensagens_whatsapp`, 3 colunas de "assumir conversa" em
    `crm_clinica_dados` (com a **recriação da view** `crm_clinica`), a tabela
    `configuracoes_agente` de linha única, a função `agente_deve_responder()`,
    1 trigger, as políticas de RLS, o Realtime e o bucket `midias-whatsapp`.
    Detalhes na [seção 4.17](#417-mensagens_whatsapp--configuracoes_agente-migração-0010).
11. `supabase/migrations/0011_procedimentos_detalhados.sql` — a coluna
    `descricao_longa` em `servicos_clinica` e os 20 textos.
12. `supabase/migrations/0012_procedimentos_texto_enxuto.sql` — os mesmos 20
    textos, reescritos mais curtos (~430 caracteres) e sem travessão. Só
    conteúdo; nada de schema. Ver [4.6](#46-servicos_clinica).
13. `supabase/migrations/0013_conversas_lista.sql` — a view
    `conversas_lista`, que sustenta a coluna da esquerda da tela Conversas.
    Ver [4.18](#418-conversas_lista-view-migrações-0013-e-0014).
14. `supabase/migrations/0014_conversas_agendamento.sql` — acrescenta
    `data_agendamento` a essa view, para a etiqueta "Agendado" e o filtro da
    lista. Só `create or replace view`; nada de tabela. Ver
    [4.18](#418-conversas_lista-view-migrações-0013-e-0014).
15. `supabase/migrations/0015_baixa_da_consulta.sql` — o status `faltou` em
    `consultas` e o trigger que **promove o lead a Cliente** quando o status do
    agendamento vira `realizada`. Fecha o funil, que até aqui não fechava. Ver
    [seção 5](#5-status-do-funil).
16. `supabase/migrations/0016_ultima_consulta.sql` — a coluna calculada
    `ultima_consulta` em `crm_clinica`, para a tela Clientes. Subconsulta
    escalar, **não** join: a view é escrita pela aplicação. Ver a seção 3.
17. `supabase/migrations/0017_provedor_whatsapp.sql` — a coluna
    `provedor_whatsapp` em `configuracoes_agente`: qual ponte com o WhatsApp
    está ativa. Ver [seção 4.17](#417-mensagens_whatsapp--configuracoes_agente-migração-0010).
18. `supabase/migrations/0018_avaliacao_e_precos.sql` — a avaliação da clínica
    de origem vira a **porta de entrada**: quatro colunas em `servicos_clinica`,
    `interesse` em `consultas`, a função `reais()`, a view de serviços com fluxo
    e valor, e `agenda_marcar` recusando o que passa antes pela porta. Ver a
    [seção 4.6](#46-servicos_clinica).
19. `supabase/migrations/0019_nome_do_agente.sql` — `nome_agente` em
    `configuracoes_agente`: o nome do Agente de IA vira **dado**, lido pelas
    telas e pelo marcador `{{NOME_AGENTE}}` do prompt. Uma fonte, dois
    leitores.
20. `supabase/migrations/0020_apagar_foto_e_logo.sql` — as políticas de
    **DELETE** em `avatars` e `logos`. Sem elas dava para trocar as duas
    imagens e não dava para tirar. Ver a [seção 7](#7-storage).
21. `supabase/migrations/0021_nome_do_paciente.sql` — `agenda_marcar` passa a
    preencher o `nome_lead` **vazio** com o nome dado no ato de marcar. Antes,
    o `p_nome` só era usado no `insert` do lead — e o lead já existe desde a
    primeira mensagem do WhatsApp, então o nome que a pessoa ditava para o
    agendamento era jogado fora. Só o vazio é preenchido: nome já gravado pode
    ter vindo da recepção.

    > ⚠️ **Ela recria a `agenda_marcar` inteira**, porque `create or replace`
    > exige o corpo todo. O arquivo foi **gerado do `pg_get_functiondef()` do
    > banco** e só o bloco do lead mudou — reescrever 130 linhas à mão é
    > copiar e torcer para não mover uma vírgula.
22. `supabase/migrations/0022_procedimentos_padronizados.sql` — o serviço
    vira **vocabulário fechado**. `crm_clinica_dados.procedimentos_interesse`
    (`text[]`) substitui a coluna de texto, que passa a ser **calculada na view
    `crm_clinica`** (os itens juntados por vírgula, como
    `minutos_ultima_mensagem`). Duas triggers recusam o que não está em
    `servicos_clinica` — no array do lead e no `procedimento`/`interesse` do
    agendamento — e **normalizam a grafia** para o nome exato do catálogo.

    > **Por que trigger e não FK:** o Postgres não tem chave estrangeira de
    > elemento de array, e `CHECK` não consulta outra tabela. Tabela de ligação
    > seria pior: `crm_clinica` é VIEW, e um `join` a mais a torna
    > somente-leitura — derrubando todo o cadastro do sistema.
    >
    > ⚠️ As triggers exigem **existir**, não estar ativo: desativar um
    > serviço não pode quebrar o reagendamento de quem já marcou.
23. `supabase/migrations/0023_marcar_so_do_catalogo.sql` — `agenda_marcar`
    devolve `procedimento_desconhecido` em vez de marcar. Antes, nome que não
    batia seguia adiante com 60 minutos e **sem conferir a porta de entrada**:
    na clínica de origem, marcar "Lente de Contato" no singular passava por
    fora da avaliação, em silêncio. A trigger da `0022` já barraria, mas com
    exceção `23514` — que na ferramenta vira "não consegui acessar a agenda" e
    manda procurar defeito no lugar errado.
24. `supabase/migrations/0024_dashboard_no_banco.sql` — o Dashboard para de
    trazer pessoas e passa a **fazer perguntas**. Cinco funções de contagem
    (`dashboard_numeros`, `dashboard_por_dia`, `dashboard_dia_semana`,
    `dashboard_profissionais`, `dashboard_procedimentos`) mais a auxiliar
    `fuso_da_clinica()`, e o índice
    `crm_clinica_marcacao_idx` em `data_marcacao_agendamento`. Detalhes em 4.19.

    > A tela fazia `select * from crm_clinica` e contava no navegador. Com
    > `max_rows = 1000`, a partir do lead 1001 as contas não ficariam
    > incompletas — ficariam **erradas**, sem erro e sem aviso.
25. `supabase/migrations/0025_instalacao_neutra.sql` — a instalação nasce
    **neutra**: tira os 20 serviços odontológicos que a `0005`/`0018`
    cadastraram e o nome "Odonto Clinica" da `0001`. Só dados.

    > ⚠️ **Só age num banco que ninguém usou.** Com um contato ou um
    > agendamento sequer, ela não mexe em nada e só emite um aviso — num
    > sistema em uso, apagar o catálogo quebraria fichas e agendamentos que
    > citam esses nomes. E mesmo no banco vazio só saem os nomes da lista
    > dela: serviço cadastrado pela tela fica.
    >
    > As migrações antigas **não foram editadas**: elas já rodaram em bancos
    > de verdade. O catálogo odontológico mora agora no kit
    > [`kits/clinica-odontologica/servicos.sql`](kits/clinica-odontologica/servicos.sql)
    > — ver [4.6](#46-servicos_clinica).
26. `supabase/migrations/0026_porta_de_entrada_opcional.sql` — a porta de
    entrada vira **escolha da empresa**. `exige_avaliacao` passa a nascer
    `false`, e a view `procedimentos_clinica_agente` só escreve "Antes deste,
    marque X" quando existe uma porta ativa para apontar — antes, sem porta,
    ela mandava marcar "a avaliação" que não existia. E `0` passa a sair como
    **"Sem custo."**, no lugar de "Gratuita." (o adjetivo concordava com
    "avaliação"). Ver [4.6](#46-servicos_clinica) e
    [4.13](#413-procedimentos_clinica_agente-view).
27. `supabase/migrations/0027_servicos_por_profissional.sql` — **os serviços
    que cada profissional faz**: a tabela `profissional_servicos` (lista vazia
    = faz todos), as auxiliares `profissional_faz()`, `servico_a_agendar()` e
    `agenda_quem_faz()`, e a agenda inteira passando a respeitar a lista —
    escolha automática, disponibilidade, próxima vaga, marcar (recusa
    `profissional_nao_faz`, dizendo quem faz) e remarcar. A view de
    profissionais ganha "Só faz: ...". Três funções mudam de assinatura e vão
    com `drop` antes. Ver [4.7.1](#471-profissional_servicos-migração-0027) e
    [4.11](#411-funções-da-api).

    > **Conserto de carona:** `agenda_marcar` deixa de mandar a porta de
    > entrada marcar a si mesma, caso alguém ligue `exige_avaliacao` nela por
    > fora da tela.
28. `supabase/migrations/0028_chave_publica_sem_acesso.sql` — **a chave
    pública deixa de alcançar o que o RLS protege.** Duas portas passavam por
    fora dele: `crm_clinica` tinha perdido o `security_invoker` na `0022`
    (a `anon key` lia e alterava todos os contatos), e as funções `security
    definer` — `agenda_marcar`, `agenda_cancelar`, `agenda_remarcar`,
    `api_token_valido`, `agente_deve_responder` e `procedimento_existe` —
    eram executáveis por qualquer um. A view volta a respeitar o RLS, e as
    funções passam a ser só da `service_role`. Nenhum objeto novo: só
    permissões. Ver [armadilha 23](#9-armadilhas-conhecidas) e a
    [seção 10](#10-consultas-úteis-para-verificação).
29. `supabase/migrations/0029_cor_do_sistema.sql` — **a cor do sistema vira
    escolha da empresa**: a coluna `configuracoes_clinica.cor_sistema`, com a
    chave de uma das sete cores de `src/lib/marca.ts` (padrão `'petroleo'`, a
    cor de antes). Sem `CHECK`, de propósito. Uma coluna; nenhum objeto novo.
    Ver [4.4](#44-configuracoes_clinica).

30. `supabase/migrations/0030_follow_up.sql` — **a agente volta a falar quando
    a conversa esfria**: as extensões `pg_cron` e `pg_net`, cinco colunas de
    prazo e janela em `configuracoes_agente`, a tabela `agente_followups`
    (ver [4.20](#420-agente_followups-migração-0030)), a
    `followups_pendentes()`, que guarda a política inteira, e a
    `disparar_followups()`, que o cron chama de minuto em minuto.

    > **Ela não agenda o cron.** O `cron.schedule` precisa do endereço da SUA
    > função e do seu `WEBHOOK_SEGREDO`, e nada de instalação nenhuma entra em
    > arquivo versionado. Quem agenda é `npm run followup:ligar`, que guarda os
    > dois no Vault. Até lá, tudo aqui existe e fica parado.

31. `supabase/migrations/0031_niveis_de_acesso.sql` — **dona, recepção e
    profissional**: `usuarios` ganha `papel`, `permissoes` (o que a dona mudou
    em relação ao papel), `profissional_id` e `ativo`; `pode()` e
    `meu_profissional()` respondem às políticas, que passam a separar leitura
    de alteração; ninguém muda o próprio acesso e a última dona não sai
    (gatilho `usuarios_protege_acesso`); a coluna `valor_pago_acumulado` sai do
    alcance da equipe e volta filtrada por `valor_pago_visivel()` e
    `definir_valor_pago()`; e o gatilho da agenda passa a rodar como o sistema.
    Quem existia vira dona. Teste por papel em
    [`supabase/testes/0031_niveis_de_acesso.sql`](supabase/testes/0031_niveis_de_acesso.sql).

    > ⚠️ **Coluna nova em `crm_clinica_dados` precisa de `grant`.** A partir
    > da 0031 as permissões dessa tabela são por coluna: coluna criada depois
    > nasce invisível para a equipe, e a tela quebra com "permission denied for
    > column".

32. `supabase/migrations/0032_minhas_permissoes.sql` — `minhas_permissoes()`:
    as dez permissões do usuário numa pergunta só, calculadas pela mesma
    `pode()` das políticas. É o que a tela lê para esconder o que não serve.

33. `supabase/migrations/0033_valor_da_consulta.sql` — **o valor pago de
    cada consulta** sai do alcance da equipe, como o acumulado da 0031, e
    volta por `valores_das_consultas()` e `definir_valor_pago_consulta()`.
    ⚠️ `select('*')` em `consultas` passa a ser recusado: a tela lista as
    colunas (`COLUNAS_CONSULTA`). Teste em
    [`supabase/testes/0033_valor_da_consulta.sql`](supabase/testes/0033_valor_da_consulta.sql).

34. `supabase/migrations/0034_equipe.sql` — `usuarios.email` (copiado do
    Auth pelo gatilho), `permissao_efetiva()` (a regra que a `pode()` passa a
    usar) e `equipe()`: a lista com as permissões efetivas de cada pessoa,
    vazia para quem não tem `equipe`.

35. `supabase/migrations/0035_so_dona_mexe_em_dona.sql` — `sou_dona()` e o
    gatilho `usuarios_protege_acesso` mais estrito: promover alguém a dona,
    ou mexer no acesso de uma dona, exige ser dona.

36. `supabase/migrations/0036_dashboard_profissionais_pela_marcacao.sql` —
    o gráfico "Agendamentos por Profissional" passa a contar pela data em que
    o agendamento foi marcado (`consultas.created_at`), como o cartão
    "Agendamentos"; cancelados ficam de fora. Antes contava pela data da
    consulta, e o período termina hoje: o que era marcado para os próximos
    dias sumia do gráfico.

37. `supabase/migrations/0037_lembretes.sql` — lembretes de agendamento com
    confirmação de presença: os campos `lembrete_*` em `configuracoes_agente`
    (nascem com `lembretes_ativo = false`), `consultas.confirmada_em` (volta a
    nulo quando a data muda), a tabela `agente_lembretes`, e as funções
    `lembretes_pendentes()`, `confirmar_presenca()` e `disparar_lembretes()`.
    Ver a seção 4.21.

38. `supabase/migrations/0038_convenios.sql` — convênios (CRM Odonto): as
    tabelas `convenios`, `convenio_coberturas` e `convenio_repasses` (esta só
    com `valores`), particular/convênio na ficha e na consulta, o gatilho que
    preenche a forma da consulta pela ficha, e as duas visões da Letícia com
    os convênios aceitos e a cobertura de cada serviço. Ver a seção 4.22.

39. `supabase/migrations/0039_cobertura_pontuacao.sql` — a mesma visão
    `procedimentos_clinica_agente`, com o ponto antes de "Cobertura de
    convênio" quando a descrição do serviço não termina em ponto.

40. `supabase/migrations/0040_odontograma.sql` — o odontograma: as tabelas
    `odontogramas`, `odontograma_registros` e `odontograma_historico` (escrito
    só pelo gatilho), numeração FDI conferida no banco, e a permissão nova
    `odontograma` (Admin e profissional por padrão). Ver a seção 4.23.

A ordem importa: cada arquivo depende do anterior. Rodar fora de ordem falha.

**Aplicar:** `node scripts/aplicar-migracoes.mjs` (ou `--clinica <nome>`)
aplica só as que faltam e anota cada uma em `public._migracoes_aplicadas`.
Testar sem gravar: `node scripts/testar-sql.mjs <migração> <teste>`.

Confira o resultado com as consultas da [seção 10](#10-consultas-úteis-para-verificação).

### 1.2. E depois das migrações

O resto da instalação — as chaves, o primeiro usuário, as Edge Functions e o
webhook — está no [`INSTALACAO.md`](INSTALACAO.md).

Duas coisas deste banco que valem saber antes de mexer nele:

- **A `service_role key` nunca entra no `.env`.** Aquele arquivo vira JavaScript
  no navegador. Ela ignora todo o RLS, e o Supabase já a entrega às Edge
  Functions sozinho — ver [seção 6](#6-segurança-rls).
- **O perfil em `public.usuarios` nasce por trigger** (`on_auth_user_created`)
  quando o usuário é criado no Auth. Não crie a linha à mão.

Confira o resultado com as consultas da
[seção 10](#10-consultas-úteis-para-verificação).

---

## 2. Visão geral

> **Os nomes do banco são da origem, e ficaram por contrato.** O sistema nasceu
> numa clínica odontológica, e tabela, coluna, view, função, chave de status,
> bucket e migração guardam as palavras de lá — telas, Edge Functions e a API
> externa dependem delas, então não mudam. O texto em volta usa as palavras da
> tela: `consultas` são os **agendamentos**; `servicos_clinica` e tudo que tem
> `procedimento` no nome são os **serviços**; `crm_clinica` são os **contatos**
> (leads e clientes); o sufixo `_clinica` é a **empresa**; e
> `paciente_recorrente` aparece na tela como **"Cliente Recorrente"**. Vale para
> o documento inteiro.

```mermaid
erDiagram
    auth_users ||--|| usuarios : "id (mesmo UUID)"
    crm_clinica_dados ||--o{ consultas : "lead_id"
    crm_clinica_dados ||--|| crm_clinica : "view calculada"
    profissionais ||--o{ consultas : "profissional_id"
    profissionais ||--o{ profissional_horarios : "jornada"
    profissionais ||--o{ profissional_bloqueios : "indisponibilidade"

    usuarios {
        uuid id PK_FK
        text nome
        text avatar_url
    }
    crm_clinica_dados {
        uuid id PK
        text nome_lead
        text status
        timestamptz ultima_mensagem
    }
    crm_clinica {
        int minutos_ultima_mensagem "calculado"
    }
    consultas {
        uuid id PK
        uuid lead_id FK
        uuid profissional_id FK
        timestamptz data_consulta
        int duracao_minutos
        numeric valor_pago
    }
    profissionais {
        uuid id PK
        text nome
        text cor
        boolean ativo
    }
    profissional_horarios {
        uuid id PK
        uuid profissional_id FK
        smallint dia_semana
    }
    profissional_bloqueios {
        uuid id PK
        uuid profissional_id FK "nulo = empresa toda"
        timestamptz inicio
        timestamptz fim
    }
    configuracoes_clinica {
        uuid id PK
        text nome_clinica
        text fuso_horario
        text endereco
        text cidade
        text estado
    }
    horario_comercial {
        uuid id PK
        smallint dia_semana UK
    }
    servicos_clinica {
        uuid id PK
        text nome
        boolean ativo
    }
```

| Objeto | Tipo | Papel |
|---|---|---|
| `crm_clinica_dados` | tabela | O coração — dados dos leads e clientes |
| `crm_clinica` | **view** | O que a aplicação lê e escreve (ver seção 3) |
| `consultas` | tabela | Agendamentos — lead + profissional + horário |
| `profissionais` | tabela | Quem atende. **A agenda de cada um são os agendamentos dele** |
| `profissional_horarios` | tabela | Jornada, 1 linha por dia da semana |
| `profissional_bloqueios` | tabela | Férias, feriado, almoço |
| `profissional_servicos` | tabela | Os serviços que cada profissional faz. **Sem linha = faz todos** (ver 4.7.1) |
| `usuarios` | tabela | Perfil da equipe, espelha `auth.users` |
| `configuracoes_clinica` | tabela | Identidade, endereço e fuso da empresa (linha única) |
| `mensagens_whatsapp` | tabela | Cada mensagem trocada no WhatsApp. É a memória do Agente de IA **e** a fonte da tela de conversas (ver 4.17) |
| `configuracoes_agente` | tabela | Linha única: modelo, prompt, liga/desliga, modo teste e os prazos do follow-up (ver 4.17) |
| `agente_followups` | tabela | Um follow-up enviado, por linha. É o que impede o mesmo toque duas vezes (ver 4.20) |
| `informacoes_clinica_agente` | **view** | Os dados da empresa em frases prontas, uma por linha, para o Agente de IA (ver 4.12) |
| `procedimentos_clinica_agente` | **view** | Os serviços ativos, um por linha, para o Agente de IA (ver 4.13) |
| `profissionais_clinica_agente` | **view** | Os profissionais ativos, a jornada e — de quem tem lista — os serviços que fazem, um por linha, para o Agente de IA (ver 4.14) |
| `conversas_lista` | **view** | Uma linha por conversa do WhatsApp, para a tela Conversas (ver 4.18) |
| `horario_comercial` | tabela | Grade de atendimento, 1 linha por dia |
| `servicos_clinica` | tabela | Catálogo de serviços |

> **Não existe tabela `agendas`, e isso é proposital.** A agenda de um
> profissional é o conjunto de agendamentos com o `profissional_id` dele.
> Cadastrar o profissional já cria a agenda; não há como as duas coisas
> divergirem, nem estado intermediário para consertar.

---

## 3. A decisão de arquitetura mais importante

**`crm_clinica` não é uma tabela. É uma view.**

Quem for mexer neste banco precisa entender isso antes de qualquer outra coisa.

```
crm_clinica_dados   →   tabela física (guarda os dados)
        ↓
crm_clinica         →   view que a aplicação usa
                          = todas as colunas da tabela
                          + minutos_ultima_mensagem (calculado na leitura)
                          + ultima_consulta         (calculado na leitura)
```

### Por quê

A interface mostra "última interação há X minutos" nos cards do CRM. Esse número
precisa estar **sempre atualizado**.

Numa coluna comum, ele congelaria no instante da gravação: um lead parado há 3
horas continuaria exibindo "há 2 minutos" para sempre, porque ninguém reescreveu
a linha nesse meio-tempo.

E não pode ser uma coluna `GENERATED` do Postgres, porque essas só aceitam
funções imutáveis — e `now()` não é.

A view resolve os dois problemas: o valor é recalculado **a cada leitura**, sem
job agendado e sem escrita periódica no banco.

### Definição

```sql
create or replace view public.crm_clinica
with (security_invoker = true)
as
  select
    -- ... todas as colunas de crm_clinica_dados, uma a uma ...
    case
      when d.ultima_mensagem is null then null
      else floor(extract(epoch from (now() - d.ultima_mensagem)) / 60)::integer
    end as minutos_ultima_mensagem,

    -- migração 0016
    (select max(c.data_consulta) from public.consultas c
      where c.lead_id = d.id and c.status = 'realizada') as ultima_consulta
  from public.crm_clinica_dados d;
```

> A view **não usa mais `d.*`**. A expansão do `*` é congelada na criação, então
> uma coluna nova na tabela não apareceria na view sem recriá-la; e
> `create or replace` exige a lista literal para acrescentar colunas no fim.

### O que isso significa na prática

- **Escrita funciona normalmente.** A view é auto-atualizável pelo Postgres
  (origem única, sem agregação), então `INSERT`, `UPDATE` e `DELETE` em
  `crm_clinica` funcionam igual a uma tabela. A aplicação e a automação não
  precisam saber que é uma view.
- **Nunca escreva nas colunas calculadas** (`minutos_ultima_mensagem` e
  `ultima_consulta`). Gravar nelas causa erro.
- **⚠️ NUNCA acrescente `join` a esta view.** É a armadilha mais cara aqui: uma
  view só é auto-atualizável com **um único item no FROM**. Um `join lateral` —
  que é como `conversas_lista` (4.18) resolve perguntas parecidas — a tornaria
  somente-leitura, e **todo cadastro do sistema quebraria de uma vez**: lead,
  cliente, edição de ficha e o Agente de IA escrevem por aqui.

  `ultima_consulta` é **subconsulta escalar**, não join, exatamente por isso:
  ela fica na lista de seleção e não toca o FROM. Ao mexer nesta view, confira
  depois:

  ```sql
  select is_updatable from information_schema.views where table_name='crm_clinica';
  -- YES = escrita preservada. NO = você acabou de derrubar o cadastro.
  ```

  (`conversas_lista` pode usar `join lateral` porque ninguém escreve nela.)
- **`security_invoker = true` é obrigatório.** Sem esse parâmetro, views no
  Postgres rodam com os privilégios do dono e **furam o RLS**, expondo todos os
  leads a qualquer requisição. Se recriar a view, mantenha isso.

  > ⚠️ **Isto já aconteceu.** A `0022` recriou a view com `drop` + `create
  > view ... as` e a opção ficou para trás — `drop` leva as opções junto, e o
  > `create` não as herda. A `anon key` passou a ler e alterar todos os
  > contatos até a `0028` devolver a opção. O aviso acima já existia; o que
  > faltava era uma conferência que **acusasse** o erro. Ela está na seção 10
  > e volta vazia quando está tudo certo.
- **A foreign key de `consultas` aponta para a tabela**
  (`crm_clinica_dados`), não para a view — FKs não podem referenciar views.

---

## 4. Referência das tabelas

### 4.1. `crm_clinica_dados` / `crm_clinica`

O coração do sistema. Cada linha é um lead que conversou com o Agente de IA no
WhatsApp, ou um contato cadastrado manualmente.

**Usada em:** `CRM.tsx`, `PessoasPage.tsx` (rotas `/leads` e `/clientes`),
`LeadDetail.tsx`, `Dashboard.tsx`

| Coluna | Tipo | Nulo | Default | Observação |
|---|---|:---:|---|---|
| `id` | `uuid` | não | `gen_random_uuid()` | PK |
| **Dados do contato** ||||
| `nome_lead` | `text` | sim | — | |
| `whatsapp_lead` | `text` | sim | — | **ÚNICO.** Só dígitos com DDI — ver abaixo |
| `procedimentos_interesse` | `text[]` | não | `'{}'` | **Vocabulário fechado** (`0022`). É o que a tabela guarda; cada item existe em `servicos_clinica.nome`, garantido pela trigger `crm_procedimentos_validos` |
| `procedimento_interesse` | `text` | — | — | ⚠️ **CALCULADA na view** — os itens acima juntados por vírgula. **Nunca grave nela** |
| `data_nascimento` | `date` | sim | — | Só a data, sem hora |
| `anotacoes` | `text` | sim | — | Campo livre da equipe |
| **Conversa / Agente de IA** ||||
| `resumo_conversa` | `text` | sim | — | Preenchido pela IA |
| `inicio_atendimento` | `timestamptz` | sim | `now()` | Base do "Novos Contatos" |
| `ultima_mensagem` | `timestamptz` | sim | — | Momento da última interação |
| `minutos_ultima_mensagem` | `integer` | sim | *calculado* | **Só na view.** Somente leitura |
| `ultima_consulta` | `timestamptz` | sim | *calculado* | **Só na view** (`0016`). O último agendamento com status `realizada`. Somente leitura |
| **Funil** ||||
| `status` | `text` | **não** | `'iniciou_conversa'` | `CHECK` — ver seção 5 |
| `follow_up_1` | `timestamptz` | sim | — | Quando o follow-up 1 foi enviado |
| `follow_up_2` | `timestamptz` | sim | — | |
| `follow_up_3` | `timestamptz` | sim | — | |
| **Agendamento** ||||
| `data_agendamento` | `timestamptz` | sim | — | **Quando o agendamento acontece** |
| `data_marcacao_agendamento` | `timestamptz` | sim | — | **Quando o lead marcou** |
| `id_agendamento` | `text` | sim | — | ID no sistema de agenda externo |
| **Integração Chatwoot — sem uso** ||||
| `id_conta_chatwoot` | `text` | sim | — | ⚠️ ninguém escreve |
| `id_conversa_chatwoot` | `text` | sim | — | ⚠️ ninguém escreve. Indexado |
| `id_lead_chatwoot` | `text` | sim | — | ⚠️ ninguém escreve |
| `inbox_id_chatwoot` | `text` | sim | — | ⚠️ ninguém escreve |
| **Financeiro** ||||
| `valor_pago_acumulado` | `numeric(10,2)` | sim | `0` | Total já pago pelo cliente |
| `created_at` | `timestamptz` | não | `now()` | |
| **Atendimento humano** (`0010`) ||||
| `agente_pausado` | `boolean` | não | `false` | Ligado, o agente grava e **não responde** nesta conversa |
| `assumido_por` | `uuid` | sim | — | Quem assumiu (`usuarios.id`) |
| `assumido_em` | `timestamptz` | sim | — | Quando assumiu |

> **As quatro colunas `*_chatwoot` estão zeradas em 100% das linhas** e não têm
> quem as escreva: elas são do desenho antigo, com Chatwoot e n8n, que foi
> abandonado (seção 8). Ficaram porque removê-las exigiria dropar e recriar a
> view `crm_clinica` (4.17), e coluna nula não custa nada. **Não construa nada
> em cima delas** — inclusive o índice de `id_conversa_chatwoot`, que hoje não
> serve a ninguém.

#### ⚠️ `whatsapp_lead`: formato canônico e unicidade

O número é gravado **só com dígitos, incluindo o código do país, sem `+`,
espaço ou traço**: `5511987654321`. É o formato em que a Evolution entrega o
número no webhook, e desde a migração `0003` o sistema grava igual.

Duas peças garantem isso, ambas no banco:

| Peça | O que faz |
|---|---|
| `crm_clinica_normaliza_whatsapp` (trigger BEFORE) | Remove qualquer pontuação antes de gravar. Protege de colar `+55 11 98765-4321` no campo |
| `crm_clinica_whatsapp_unico` (índice único parcial) | Uma pessoa, um número. Ignora nulos, então vários contatos sem telefone convivem |

**O formato importa tanto quanto a unicidade.** Se a tela gravasse
`+55 (11) 98765-4321` e o agente `5511987654321`, seriam dois textos diferentes
para o mesmo telefone: o índice deixaria os dois entrarem, a busca do
agendamento não acharia o contato criado pelo agente, e a recepção cadastraria a
pessoa de novo — o mesmo bug, por outro caminho.

O trigger **não inventa código de país**. Um número sem DDI continua sem DDI:
adivinhar o país pelo tamanho acertaria no Brasil e erraria em silêncio no resto.
Quem garante o DDI é quem escreve — a tela, pelo seletor de país
([`src/lib/telefones.ts`](src/lib/telefones.ts)), e o Agente de IA, que copia o
número do JID da Evolution, onde ele já vem completo.

Violação devolve **`23505`**. As telas traduzem para "esse número já é de
Fulano" e oferecem abrir ou usar o contato existente.

> **Cuidado com as duas datas de agendamento.** Elas são diferentes e o
> Dashboard usa cada uma para uma coisa:
> `data_marcacao_agendamento` conta quantos agendamentos foram *marcados* no
> período; `data_agendamento` lista os *próximos agendamentos*. Trocar uma pela
> outra quebra as métricas em silêncio.

**Índices:**

| Índice | Coluna | Para quê |
|---|---|---|
| `crm_clinica_conversa_cw_idx` | `id_conversa_chatwoot` | ⚠️ **Sem uso.** Era como o n8n achava o lead da conversa; hoje a busca é por `whatsapp_lead` |
| `crm_clinica_created_at_idx` | `created_at DESC` | Listagem em `Leads.tsx` |
| `crm_clinica_status_idx` | `status` | Colunas do Kanban |
| `crm_clinica_inicio_idx` | `inicio_atendimento` | Métricas do Dashboard (`dashboard_numeros`, `dashboard_por_dia`, `dashboard_dia_semana`) |
| `crm_clinica_marcacao_idx` | `data_marcacao_agendamento` | KPI "Agendamentos" e a série de agendamentos do gráfico de linha (`0024`) |
| `crm_clinica_agendamento_idx` | `data_agendamento` | Próximos agendamentos |
| `crm_clinica_whatsapp_unico` | `whatsapp_lead` parcial | **Impede duas pessoas com o mesmo número** e atende a busca por telefone |

---

### 4.2. `consultas`

Agendamentos. Um lead tem N agendamentos; um profissional tem N agendamentos —
e é esse segundo vínculo que forma a agenda dele.

**Usada em:** `Agenda.tsx`, `NovoAgendamentoModal.tsx`, `LeadDetail.tsx`,
`PessoasPage.tsx` (o agendamento criado no cadastro) e `Dashboard.tsx` — que lê
direto em "Próximos Agendamentos" e por `dashboard_profissionais` /
`dashboard_procedimentos` (4.19).

| Coluna | Tipo | Nulo | Default | Observação |
|---|---|:---:|---|---|
| `id` | `uuid` | não | `gen_random_uuid()` | PK |
| `lead_id` | `uuid` | **não** | — | FK → `crm_clinica_dados(id)` **ON DELETE CASCADE** |
| `profissional_id` | `uuid` | sim | — | FK → `profissionais(id)` **ON DELETE RESTRICT** |
| `procedimento` | `text` | não | — | Um nome de `servicos_clinica` — a trigger `consultas_procedimento_valido` (`0022`) recusa o resto e normaliza a grafia |
| `data_consulta` | `timestamptz` | não | — | Quando começa |
| `duracao_minutos` | `integer` | não | `60` | `CHECK` 1..600 |
| `data_fim` | `timestamptz` | não | *trigger* | **Derivada.** Nunca grave nela |
| `status` | `text` | não | `'agendada'` | `agendada` \| `realizada` \| `cancelada` \| `faltou` (`0015`). Só `agendada` bloqueia horário |
| `origem` | `text` | não | `'equipe'` | `equipe` \| `agente_ia` |
| `chave_externa` | `text` | sim | — | Idempotência da API. **UNIQUE** quando preenchida |
| `valor_pago` | `numeric(10,2)` | sim | — | |
| `observacoes` | `text` | sim | — | |
| `interesse` | `text` | sim | — | O que a pessoa procura, quando o agendamento é a porta de entrada |
| `cancelado_em` | `timestamptz` | sim | — | |
| `motivo_cancelamento` | `text` | sim | — | |
| `created_at` | `timestamptz` | não | `now()` | |
| `updated_at` | `timestamptz` | não | `now()` | Trigger `consultas_updated_at` |

**Índices:**

| Índice | Colunas | Para quê |
|---|---|---|
| `consultas_lead_data_idx` | `(lead_id, data_consulta DESC)` | Histórico na ficha do contato |
| `consultas_profissional_data_idx` | `(profissional_id, data_consulta)` | Agenda de um profissional num período |
| `consultas_data_idx` | `(data_consulta)` | Agenda sem filtro de profissional |
| `consultas_chave_externa_idx` | `(chave_externa)` parcial | Idempotência — impede agendamento duplicado em retry |

#### ⚠️ `consultas_sem_sobreposicao` — a restrição que impede agendamento duplo

```sql
exclude using gist (
  profissional_id with =,
  tstzrange(data_consulta, data_fim) with &&
) where (status = 'agendada' and profissional_id is not null)
```

Um profissional não pode ter dois agendamentos **ativos** se sobrepondo. Vale só
para `status = 'agendada'`: cancelado libera o horário, realizado é passado.

#### Por que `data_fim` existe como coluna

O caminho óbvio seria calcular o fim dentro da própria restrição, com
`data_consulta + make_interval(mins => duracao_minutos)`. O PostgreSQL recusa:

```
42P17 -> functions in index expression must be marked IMMUTABLE
```

Não é o `make_interval` — esse é imutável. O problema é o operador
`timestamptz + interval`, que é apenas **STABLE**: um `interval` pode conter dias
e meses, e somar dias a um `timestamptz` depende do fuso e do horário de verão.
Aqui o intervalo é sempre em minutos, o que seria exato, mas o planejador não
tem como saber disso.

Por isso o fim é materializado em `data_fim`, mantido pelo trigger
**`consultas_data_fim`** (BEFORE INSERT/UPDATE — precisa estar preenchido antes
da checagem da restrição, que acontece depois dos triggers BEFORE). A restrição
compara duas colunas, o que é imutável por definição.

Coluna `GENERATED` não resolveria: sofre da mesma exigência de imutabilidade.

> **Isto foi descoberto aplicando a migração no banco real**, não lendo o SQL. É
> o tipo de erro que só aparece na execução.

Está no banco, e não no código, porque a recepção e o Agente de IA escrevem pelo
mesmo caminho ao mesmo tempo. Verificar em JavaScript ("já tem algo nesse
horário?") e depois inserir deixa uma janela entre a leitura e a escrita — e o
resultado é dois clientes no mesmo horário. É intermitente e ninguém reproduz.

Quem violar recebe **`23P01` (`exclusion_violation`)**. A interface já traduz
isso ("Esse horário acabou de ser ocupado"); a API deve devolver **409** e nunca
repetir a chamada — repetir dá o mesmo erro.

Exige a extensão `btree_gist` (criada pela migração).

> **`ON DELETE CASCADE` do lead:** excluir um lead apaga **todos** os
> agendamentos dele, incluindo o histórico financeiro. Decisão consciente.
>
> **`ON DELETE RESTRICT` do profissional:** o oposto — o banco **impede** apagar
> um profissional que tenha agendamentos. A tela oferece desativar
> (`ativo = false`), que tira da agenda sem destruir histórico.

---

### 4.3. `usuarios`

Perfil da equipe. **Espelha `auth.users`** — a PK é o mesmo UUID.

**Usada em:** `Configuracoes.tsx`, `Sidebar.tsx`

| Coluna | Tipo | Nulo | Default | Observação |
|---|---|:---:|---|---|
| `id` | `uuid` | não | — | PK **e** FK → `auth.users(id)` ON DELETE CASCADE |
| `nome` | `text` | não | `''` | |
| `avatar_url` | `text` | sim | — | URL pública no bucket `avatars` |
| `created_at` | `timestamptz` | não | `now()` | |

**A linha é criada automaticamente.** O trigger `on_auth_user_created` em
`auth.users` chama `public.handle_new_user()`, que insere o perfil. Sem ele,
todo usuário novo derrubaria a tela de Configurações — o código usa `.single()`,
que falha quando não encontra a linha.

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.usuarios (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', ''));
  return new;
end;
$$;
```

O `nome` sai de `raw_user_meta_data.nome`: quem nasce pelo
`npm run instalar:usuario -- email --nome "Maria Souza"` já vem com ele; quem é
criado pelo painel do Supabase nasce com `''`, e preenche em Configurações →
Perfil.

---

### 4.4. `configuracoes_clinica`

Identidade e endereço da empresa. **Tem no máximo uma linha.**

**Usada em:** `Configuracoes.tsx` (abas Perfil e Empresa), `Sidebar.tsx`, `Layout.tsx` (a cor), e a view
`informacoes_clinica_agente` (seção 4.12), que o Agente de IA lê.

| Coluna | Tipo | Nulo | Default |
|---|---|:---:|---|
| `id` | `uuid` | não | `gen_random_uuid()` |
| `nome_clinica` | `text` | sim | — |
| `logo_url` | `text` | sim | — |
| `fuso_horario` | `text` | não | `'America/Sao_Paulo'` |
| `endereco` | `text` | sim | — |
| `bairro` | `text` | sim | — |
| `cidade` | `text` | sim | — |
| `estado` | `text` | sim | — |
| `cep` | `text` | sim | — |
| `google_maps_url` | `text` | sim | — |
| `instagram_url` | `text` | sim | — |
| `site_url` | `text` | sim | — |
| `cor_sistema` | `text` | não | `'petroleo'` |
| `created_at` | `timestamptz` | não | `now()` |
| `updated_at` | `timestamptz` | não | `now()` |

**Restrições:** `configuracoes_clinica_estado_valido` aceita só as 27 UFs (ou
nulo); `configuracoes_clinica_cep_valido` exige `^\d{8}$`.

> **`cor_sistema` guarda a chave, não a cor** (migração `0029`): `'petroleo'`,
> `'verde'`… A lista das sete e os quatro tons de cada uma moram em
> `src/lib/marca.ts`. Quem escreve é o seletor da aba **Empresa**; quem lê é o
> `Layout`, uma vez por sessão. **Sem `CHECK`**, pela mesma razão do
> `fuso_horario` logo abaixo — ampliar a lista não deve exigir migração —, e
> uma chave que a tela não conhece vira a padrão, sem erro. A tela de login
> **não** lê esta coluna (sem sessão, o RLS devolve zero linhas): ela abre na
> cor que aquele navegador lembra.

> **`endereco` é um campo só** — guarda "Rua das Flores, 120 - sala 3"
> inteiro. Separar rua, número e complemento obrigaria a remontar a frase na
> leitura, e daria três jeitos diferentes de o mesmo endereço ficar estranho.

> **`cidade` é livre, `estado` é lista.** Cidade escrita à mão é inevitável — são
> milhares. UF é um conjunto fechado de 27, e digitada à mão vira "SP", "sp" e
> "São Paulo" na mesma coluna.

> **`cep` guarda só dígitos** (`01010000`), como `whatsapp_lead`. A pontuação
> existe na tela; o `CHECK` recusa qualquer coisa formatada.

> **`fuso_horario` não é enfeite.** `profissional_horarios` guarda `time` sem
> fuso e `consultas.data_consulta` é `timestamptz`; cruzar os dois exige saber em
> que fuso "08:00" foi escrito. O servidor do Supabase roda em UTC — sem fixar
> isto, o cálculo de disponibilidade da API erra em 3 horas e o Agente de IA
> passa a oferecer horário de madrugada. Fica no banco, e não no código, para
> mudar sem novo deploy.
>
> Quem escreve é a aba **Horários** de Configurações, com uma lista de **quatro**
> opções — os quatro deslocamentos do Brasil, já que sem horário de verão os
> catorze nomes IANA do país desabam em quatro. A coluna continua **sem `CHECK`**,
> pela mesma razão que a paleta de `cores.ts` não tem: ampliar a lista um dia não
> deve exigir migração. Até 01/09/2026 não havia tela nenhuma para este campo, e
> corrigi-lo era um `update` no SQL Editor.
>
> ⚠️ **Trocar o valor não move nenhum agendamento já gravado.** `data_consulta` é
> `timestamptz` — um **instante**, não "14:00". Corrigir o fuso acerta o que for
> marcado dali para frente; o que entrou com o fuso errado continua na hora
> errada, e só sai de lá remarcado à mão.

A unicidade é garantida por um índice sobre uma expressão constante:

```sql
create unique index configuracoes_clinica_singleton
  on public.configuracoes_clinica ((true));
```

Sem ele, um duplo clique no upload de logo criaria uma segunda linha e o
`.limit(1).single()` do código passaria a falhar.

`updated_at` é mantido pelo trigger `configuracoes_clinica_updated_at`.

---

### 4.5. `horario_comercial`

Grade de atendimento — **uma linha por dia da semana**.

**Usada em:** `Configuracoes.tsx` (edição) e `jornada_texto(null)` (4.15), que
monta a linha `Atendimento:` da view `informacoes_clinica_agente` (4.12) — a
frase que a Letícia fala.

> **O Dashboard lia esta tabela e não lê mais.** Era a rosca "dentro x fora do
> horário comercial", removida em 02/09/2026 a pedido da clínica onde o sistema
> nasceu.

| Coluna | Tipo | Nulo | Default | Observação |
|---|---|:---:|---|---|
| `id` | `uuid` | não | `gen_random_uuid()` | PK |
| `dia_semana` | `smallint` | não | — | **UNIQUE**, `CHECK (0..6)` |
| `hora_inicio` | `time` | não | — | Sem fuso |
| `hora_fim` | `time` | não | — | |
| `ativo` | `boolean` | não | `true` | Dia fechado = `false` |

> **`dia_semana`: 0 = domingo … 6 = sábado.** Segue o `getDay()` do JavaScript,
> porque o código compara os dois valores diretamente.

O `UNIQUE (dia_semana)` importa: a interface localiza o dia com um `find()`, e
linhas duplicadas fariam todas menos a primeira serem ignoradas em silêncio.

---

### 4.6. `servicos_clinica`

Catálogo de serviços oferecidos.

**Usada em:** `Procedimentos.tsx` (a página Serviços) e o endpoint
`GET /procedimentos` da API do Agente de IA — que devolve **só o nome**, sem
`id` nem descrição.

| Coluna | Tipo | Nulo | Default |
|---|---|:---:|---|
| `id` | `uuid` | não | `gen_random_uuid()` |
| `nome` | `text` | não | — |
| `descricao` | `text` | não | `''` |
| `descricao_longa` | `text` | sim | — |
| `ativo` | `boolean` | não | `true` |
| `exige_avaliacao` | `boolean` | não | `false` (era `true` até a `0026`) |
| `preco_a_partir_de` | `numeric(10,2)` | sim | — |
| `duracao_minutos` | `integer` | não | `60` |
| `e_avaliacao` | `boolean` | não | `false` |
| `created_at` | `timestamptz` | não | `now()` |

**Índices:** `servicos_clinica_created_at_idx` — a listagem ordena por cadastro.
E `servicos_clinica_avaliacao_unica`, índice **parcial** sobre `e_avaliacao`
`where e_avaliacao`: garante uma porta de entrada só, sem prender as outras
linhas a um `false` compartilhado.

#### O fluxo de agendamento (migrações 0018 e 0026)

`exige_avaliacao` marcado significa que **o agente não agenda este
serviço**: agenda o que estiver com `e_avaliacao` e grava este nome em
`consultas.interesse`. Quem confere é a função `agenda_marcar`, que devolve
`motivo = 'exige_avaliacao'` e o nome da porta em `sugestao`.

**A porta é opcional** (`0026`). Sem nenhum serviço com `e_avaliacao`
ativo, `exige_avaliacao` **não vale**: `agenda_marcar` marca direto (ela já
fazia isso desde a `0018`) e a view não fala em porta. A coluna não é apagada
quando a empresa deixa de usar a porta — fica guardada, e volta a valer se uma
porta for escolhida de novo. Quem lê precisa olhar as duas coisas juntas; a
tela faz isso, e o SQL também.

> ⚠️ **A regra vale para os agentes, não para a empresa.**
> `NovoAgendamentoModal.tsx` grava direto em `consultas`, sem passar pela
> função — de propósito. A trava existe para impedir um agente de decidir pela
> empresa, não para impedir a recepção de marcar o que quiser.

#### `preco_a_partir_de` tem TRÊS estados

| Valor | O que o agente faz |
|---|---|
| `null` | Não fala valor |
| `0` | **"Sem custo."** na lista — a frase que derruba a objeção de quem não quer pagar só para saber o preço. Era "Gratuita." até a `0026`, e o adjetivo concordava com "avaliação" |
| `> 0` | "A partir de R$ X" |

**Zero não é vazio aqui.** Tratá-lo como ausente joga fora a melhor resposta
que o agente tem; tratá-lo como preço faria ele dizer "a partir de R$ 0,00".

O nome da coluna é `preco_a_partir_de`, e não `preco`, porque é assim que o
agente fala. Um campo chamado `preco` seria preenchido com valor fechado, e a
frase continuaria dizendo "a partir de".

É **ignorado** quando o serviço passa pela porta (`exige_avaliacao` **e** uma
porta existindo) — por isso o campo some do modal de edição, e o salvamento
grava `null`. Campo que existe sem ser usado é campo
preenchido errado, e um preço guardado que nunca será falado é pior: parece
combinado com alguém.

> **Não cadastre marcas registradas** (ClearCorrect, Invisalign e similares).
> Use a descrição genérica do serviço: "Alinhadores Transparentes".
> Isso vale também para os prompts do Agente de IA, que fala com o público.

#### A instalação nasce sem catálogo; o odontológico é um kit

Desde a [`0025`](supabase/migrations/0025_instalacao_neutra.sql), uma
instalação nova tem **zero** linhas aqui: cada empresa cadastra os próprios
serviços pela tela.

O catálogo da clínica odontológica onde o sistema nasceu virou o kit
[`kits/clinica-odontologica/servicos.sql`](kits/clinica-odontologica/servicos.sql)
— **não é migração**: roda uma vez no SQL Editor, depois de todas elas, só
quando a empresa é uma clínica odontológica. Ele foi **gerado do banco depois
da `0024`**, e não redigitado: reproduz os 20 serviços com as duas descrições,
a duração, os valores e a avaliação como porta de entrada, idênticos ao que as
migrações produziam. Rodar duas vezes não duplica.

Abaixo, os 20 do kit, na ordem em que a página Serviços os lista.

| # | Serviço | # | Serviço |
|---|---|---|---|
| 1 | Avaliação Odontológica *(a porta de entrada)* | 11 | Levantamento de Seio Maxilar |
| 2 | Lentes de Contato | 12 | Prótese Dentária |
| 3 | Facetas em Resina | 13 | Tratamento de Canal |
| 4 | Clareamento Dental | 14 | Placa de Bruxismo |
| 5 | Gengivoplastia | 15 | Tratamento de DTM |
| 6 | Alinhadores Transparentes | 16 | Limpeza e Profilaxia |
| 7 | Implante Unitário | 17 | Raspagem |
| 8 | Carga Imediata | 18 | Tratamento Periodontal |
| 9 | Prótese Fixa sobre Implantes | 19 | Enxerto Gengival |
| 10 | Enxerto Ósseo | 20 | Extração de Siso |

> **A `descricao` é a explicação do serviço em uma linha**, escrita em
> linguagem de cliente, não em jargão técnico. Ela vai para a tela e para a
> lista que a atendente lê (4.13) — a API externa devolve só o nome —, e é o
> nome que a pessoa ouve no WhatsApp. Por isso os nomes também são os do
> cliente (no kit: "Limpeza e Profilaxia", não "profilaxia dentária
> supragengival").

#### As duas descrições não são a mesma coisa em tamanhos diferentes

Elas têm **destinos diferentes**, e confundi-las custa dinheiro em toda
conversa:

| Coluna | Vai para onde | Quando é lida |
|---|---|---|
| `descricao` | **Dentro do prompt** do agente, via `procedimentos_clinica_agente` | Em **toda** mensagem, junto com a dos outros 19 |
| `descricao_longa` | **Fora do prompt.** A ferramenta `detalhes_do_servico` busca direto na tabela | Só quando a pessoa pergunta **daquele** serviço |

Os 20 textos longos do kit somam ~8.600 caracteres. Se estivessem no prompt,
seriam cobrados inclusive de quem só mandou "oi" — para carregar 19 textos que
aquela conversa nunca vai usar. Fora dele, o prompt continua em **1.961 caracteres**,
exatamente o mesmo de antes da coluna existir.

Daí as duas réguas, ambas avisadas na tela de edição:

- **`descricao` até ~120 caracteres.** É o catálogo: serve para o agente saber
  que o serviço existe, não para explicá-lo.
- **`descricao_longa` em torno de 430, teto sugerido de 600.** Não é limite
  técnico. A Letícia responde em até 50 palavras; acima disso ela para de
  escolher o que dizer e passa a **resumir por conta própria** — e resumo
  automático é onde nasce a frase que nenhum profissional escreveu.

> **Sem travessão (`—`) nos textos longos.** O modelo copia a pontuação do que
> lê, e travessão em mensagem de WhatsApp entrega texto de máquina.

> ⚠️ **Os 20 textos longos do kit são rascunho** e precisam da revisão de um
> dentista da clínica. Prazos, número de sessões e condutas variam por caso — e
> agora isso é dito a paciente.

> **A duração é do serviço** (`duracao_minutos`, desde a `0018`). Ao marcar, o
> agente usa a do serviço, a menos que quem chama mande `duracao_minutos`; os
> 60 minutos são só o padrão da coluna. Serviço que ocupa mais tempo precisa da
> duração certa no modal de edição — senão a agenda reserva menos tempo do que
> o atendimento consome.

---

### 4.7. `profissionais`

Os profissionais da empresa — quem atende.

**Usada em:** `Dashboard.tsx` (via `dashboard_profissionais`, 4.19 — e ⚠️ o
inativo continua aparecendo nos períodos em que atendeu),
`Profissionais.tsx`, `Agenda.tsx`, `NovoAgendamentoModal.tsx`,
`LeadDetail.tsx`

| Coluna | Tipo | Nulo | Default | Observação |
|---|---|:---:|---|---|
| `id` | `uuid` | não | `gen_random_uuid()` | PK |
| `nome` | `text` | não | — | |
| `sobrenome` | `text` | não | `''` | |
| `cor` | `text` | não | `'#1E6E8C'` | `CHECK` hex de 6 dígitos |
| `ativo` | `boolean` | não | `true` | Inativo some da agenda e dos seletores |
| `created_at` | `timestamptz` | não | `now()` | |
| `updated_at` | `timestamptz` | não | `now()` | Trigger `profissionais_updated_at` |

**Índice:** `profissionais_ativo_idx` em `(ativo, nome)`.

> **O profissional não é usuário do sistema.** Não faz login e não tem linha em
> `usuarios` — é um recurso de agenda, com os serviços que faz em
> `profissional_servicos` ([4.7.1](#471-profissional_servicos-migração-0027)).
> Se um dia cada profissional precisar ver apenas a própria agenda, será
> preciso acrescentar `usuario_id` aqui e reescrever as políticas da seção 6.
> Mais fácil decidir antes de haver dados.

> **A `cor` é dado, não identidade visual.** Serve para distinguir uma agenda da
> outra no calendário — a mesma lógica das cores de status. Trocar a marca da
> empresa não deve trocar isto. A paleta oferecida na interface é fixa
> (`src/lib/cores.ts`), mas o banco aceita qualquer hex válido, então ampliá-la
> não exige migração.

#### 4.7.1. `profissional_servicos` (migração `0027`)

Os serviços que cada profissional faz. O João corta e faz barba; a Ana só faz
coloração.

**Usada em:** `Profissionais.tsx` (o campo "Serviços que faz"), o aviso das três
telas da recepção que marcam (`AvisoForaDaLista`), e — no banco — pelas funções
da agenda e pela view `profissionais_clinica_agente`.

| Coluna | Tipo | Nulo | Default | Observação |
|---|---|:---:|---|---|
| `profissional_id` | `uuid` | não | — | FK → `profissionais(id)` **ON DELETE CASCADE**. Parte da PK |
| `servico_id` | `uuid` | não | — | FK → `servicos_clinica(id)` **ON DELETE CASCADE**. Parte da PK |
| `created_at` | `timestamptz` | não | `now()` | |

**PK `(profissional_id, servico_id)`**, e o índice
`profissional_servicos_servico_idx` em `(servico_id)` para a pergunta da
agenda: "quem faz o serviço Y?".

> ### ⚠️ Lista vazia = faz TODOS
>
> Um profissional **sem nenhuma linha aqui atende qualquer serviço** — como
> sempre foi. A lista existe para **restringir**, e só quem tem lista é
> restrito. É o que fez da `0027` uma mudança sem susto: ninguém precisou
> cadastrar nada, e nenhum agendamento mudou de dono.
>
> A regra mora em **`profissional_faz(profissional, servico)`**, e só ali; a
> tela tem uma cópia para **avisar** (`src/lib/servicosDosProfissionais.ts`).

**Por que tabela de ligação, e não `text[]` em `profissionais`:** o vínculo é
por `id`. Renomear um serviço não quebra a lista de ninguém, e apagar um
serviço tira ele das listas sozinho.

> ⚠️ **A consequência do cascade:** se o serviço apagado era o **único** da
> lista de alguém, a lista fica vazia — e vazia quer dizer "faz tudo". É o caso
> raro de apagar a especialidade inteira de um especialista. **Desativar** o
> serviço não tem esse efeito: a linha fica, e a pessoa continua restrita a ele
> (a view diz "Só faz: nenhum serviço ativo no momento").

**A recepção passa por fora**, como na porta de entrada: as telas gravam
direto em `consultas`, e só avisam em âmbar. A regra existe para o agente não
decidir pela empresa.

---

### 4.8. `profissional_horarios`

Jornada de trabalho — **uma linha por dia da semana, por profissional**. Mesma
modelagem de `horario_comercial`, porque cada profissional tem horário diferente.

**Usada em:** `Profissionais.tsx` (edição), `Agenda.tsx` (sombreado fora do
expediente), `NovoAgendamentoModal.tsx` (aviso de encaixe)

| Coluna | Tipo | Nulo | Default | Observação |
|---|---|:---:|---|---|
| `id` | `uuid` | não | `gen_random_uuid()` | PK |
| `profissional_id` | `uuid` | **não** | — | FK → `profissionais(id)` **ON DELETE CASCADE** |
| `dia_semana` | `smallint` | não | — | `CHECK (0..6)` |
| `hora_inicio` | `time` | não | — | Sem fuso — ver `fuso_horario` na seção 4.4 |
| `hora_fim` | `time` | não | — | `CHECK (hora_fim > hora_inicio)` |
| `ativo` | `boolean` | não | `true` | Dia sem atendimento = `false` |

**UNIQUE `(profissional_id, dia_semana)`** — a interface acha o dia com um
`find()`, e linhas duplicadas fariam todas menos a primeira sumirem em silêncio.
Aqui é pior que em `horario_comercial`: a API de disponibilidade leria só a
primeira e ofereceria horário errado ao cliente.

**Índice:** `profissional_horarios_prof_idx` em `(profissional_id)`.

> `dia_semana`: **0 = domingo … 6 = sábado**, igual a `horario_comercial` e ao
> `getDay()` do JavaScript. Manter idêntico é o que permite comparar as duas
> grades sem conversão.

---

### 4.9. `profissional_bloqueios`

Férias, feriado, almoço, congresso, compromisso pessoal.

**Usada em:** `NovoAgendamentoModal.tsx` e no cálculo de disponibilidade das
funções da agenda (4.11) — que servem à Letícia e à API.

| Coluna | Tipo | Nulo | Default | Observação |
|---|---|:---:|---|---|
| `id` | `uuid` | não | `gen_random_uuid()` | PK |
| `profissional_id` | `uuid` | **sim** | — | FK → `profissionais(id)` CASCADE. **Nulo = empresa inteira** |
| `inicio` | `timestamptz` | não | — | |
| `fim` | `timestamptz` | não | — | `CHECK (fim > inicio)` |
| `motivo` | `text` | não | `''` | |
| `created_at` | `timestamptz` | não | `now()` | |

**Índices:** `profissional_bloqueios_periodo_idx` em `(inicio, fim)` e
`profissional_bloqueios_prof_idx` em `(profissional_id, inicio)`.

> **Por que `profissional_id` aceita nulo:** feriado, dedetização e
> confraternização valem para todo mundo. Sem isso, marcar um feriado exigiria
> uma linha por profissional — e esquecer um deles significa o Agente de IA
> oferecendo horário num dia em que a empresa está fechada.

> **Bloqueio não entra na restrição de exclusão da seção 4.2.** Ele impede que a
> agenda *ofereça* o horário, mas não impede a equipe de encaixar alguém por
> cima conscientemente. Emergência em feriado existe.

---

### 4.10. `api_tokens`

Chaves de acesso da API do Agente de IA. Contrato completo em
[`API_AGENTE.md`](API_AGENTE.md).

**Usada em:** `TokenApi.tsx` (menu do usuário → Token e API), que cria e revoga;
e pela Edge Function, via `api_token_valido()`, a cada chamada.

| Coluna | Tipo | Nulo | Default | Observação |
|---|---|:---:|---|---|
| `id` | `uuid` | não | `gen_random_uuid()` | PK |
| `nome` | `text` | não | — | Como a equipe identifica ("integração da recepção") |
| `prefixo` | `text` | não | — | Início visível (`odk_7f3a…`), para distinguir na lista |
| `hash` | `text` | não | — | **SHA-256 do token. UNIQUE** |
| `ativo` | `boolean` | não | `true` | Revogar é `false` |
| `criado_por` | `uuid` | sim | — | FK → `usuarios(id)` ON DELETE SET NULL |
| `ultimo_acesso` | `timestamptz` | sim | — | Atualizado pela API, no máximo a cada 5 min |
| `revogado_em` | `timestamptz` | sim | — | |
| `created_at` | `timestamptz` | não | `now()` | |

> **O valor do token não existe em lugar nenhum.** Guarda-se só o hash: dá para
> conferir quem chega, não para reconstruir. Por isso ele é exibido uma única
> vez, na criação — e é nesse momento que a tela mostra os cURLs já preenchidos.
> Guardar o valor legível faria de um vazamento do banco a entrega de todos os
> tokens de uma vez.

> **Revogar não apaga.** `ativo = false` preserva o histórico de quem teve
> acesso e quando.

---

### 4.11. Funções da API

Sete funções servem a Edge Function `agenda`. Elas existem **no banco**, e não no
TypeScript, por três motivos: remarcar precisa ser atômico; o cruzamento entre a
jornada (`time` sem fuso) e o agendamento (`timestamptz`) só é confiável com o
`AT TIME ZONE` do Postgres; e assim dá para testar tudo com SQL, sem subir nada.

| Função | Papel |
|---|---|
| `api_token_valido(hash)` | Confere o token e carimba `ultimo_acesso` |
| `agenda_profissionais_livres(inicio, duracao, procedimento)` | Quem está livre num horário **e faz o serviço** |
| `agenda_horarios_disponiveis(data, profissional, duracao, passo, procedimento)` | Slots livres num dia — com `procedimento`, só de quem faz, e na duração dele |
| `agenda_proxima_vaga(a_partir_de, profissional, duracao, procedimento)` | Próximo dia com vaga (até 60 dias) |
| `agenda_quem_faz(procedimento)` | Os profissionais ativos que podem receber um pedido desse serviço (já resolvida a porta) |
| `agenda_marcar(...)` | Acha ou cria o cliente, escolhe profissional **entre quem faz**, insere. **Recusa** o serviço com `exige_avaliacao` (`sugestao` = a porta) e o profissional que não faz o serviço (`profissional_nao_faz`, `sugestao` = quem faz) |
| `reais(numeric)` | `1500.5` → `R$ 1.500,50`. Independente de locale, de propósito |
| `agenda_cancelar(...)` | Cancela, com conferência opcional pelo WhatsApp |
| `agenda_remarcar(...)` | Move o agendamento num `UPDATE` só. Trocar para quem não faz o serviço devolve `profissional_nao_faz` |

E duas auxiliares da `0027`, que as de cima usam:

| Função | Papel |
|---|---|
| `profissional_faz(profissional, servico)` | **A regra inteira:** lista vazia ou contendo o serviço = sim. Serviço nulo = sim (sem filtro) |
| `servico_a_agendar(nome)` | O que vai de fato para a agenda quando alguém pede `nome`: a porta de entrada, se ele passa por ela; ele mesmo, nos outros casos — com a duração |

> ⚠️ **Três delas mudaram de assinatura na `0027`** (`agenda_profissionais_livres`,
> `agenda_horarios_disponiveis`, `agenda_proxima_vaga` ganharam `procedimento`)
> e foram com `drop` antes: parâmetro novo sem `drop` cria **sobrecarga**, e o
> PostgREST responde "function is not unique" para as duas. Os parâmetros novos
> têm padrão nulo — quem chama sem eles continua na regra antiga.
>
> **`servico_a_agendar` existe para a disponibilidade.** No kit de clínica, quem
> pergunta pelos horários de "Lentes de Contato" vai sair com a **avaliação**
> marcada: os horários certos são os de quem faz a avaliação, na duração dela.

As três últimas devolvem `ok`, `motivo` e os campos da resposta — o `motivo` é o
que vira frase para a pessoa na Edge Function.

As de escrita são `security definer` **com `set search_path = public`**. Sem esse
`set`, `security definer` é vetor clássico de escalada de privilégio: quem chama
poderia plantar um schema com objetos de mesmo nome.

**E só a `service_role` as executa** (`0028`), junto com `api_token_valido`.
`security definer` passa por cima do RLS, e o Postgres dá `EXECUTE` a `PUBLIC`
em toda função nova — até a `0028`, qualquer um com a `anon key` marcava e
cancelava agendamento por `POST /rest/v1/rpc/agenda_marcar`. Quem chama de
verdade são as duas Edge Functions, e as duas usam a `service_role key`.

> ⚠️ **`drop` + `create` devolve o `EXECUTE` a todo mundo.** Mudar a
> assinatura de uma destas funções exige repetir, na mesma migração, o
> `revoke ... from public, anon, authenticated` e o `grant ... to
> service_role` da `0028`. `create or replace` mantém as permissões.

---

### 4.12. `informacoes_clinica_agente` (view)

Os dados da empresa em frases prontas, **uma coluna, uma informação por linha**.
É o que o Agente de IA consulta quando precisa falar do endereço, do
Instagram ou do site com a pessoa.

| Coluna | Tipo |
|---|---|
| `informacao` | `text` |

```
Nome: Odonto Clinica
Rua: Rua das Flores, 120 - sala 3
Bairro: Centro
Cidade: São Paulo/SP
CEP: 01010-000
Atendimento: segunda a sexta das 08:00 às 18:00, sábado das 08:00 às 12:00
Link do Google Maps: https://maps.app.goo.gl/...
Instagram: https://instagram.com/clinica
Site: https://clinica.com.br
```

*(Nome e endereço do exemplo são os da clínica onde o sistema nasceu.)*

**A linha `Atendimento:` não vem de campo digitado.** Ela é montada de
`horario_comercial` por `jornada_texto(null)` (4.15), a mesma grade que a empresa
preenche em Configurações → Horários de Funcionamento. Mudou a grade, mudou a
frase na leitura seguinte — ninguém digita horário duas vezes.

> ⚠️ **`horario_comercial` é o horário da empresa, não o da agenda** — ver o
> aviso ao fim da seção 4.17.

> **Por que view e não tabela.** Uma segunda tabela precisaria ser mantida em
> sincronia com `configuracoes_clinica`, e um dia não estaria — alguém edita o
> endereço na tela e esquece de propagar, ou o trigger falha em silêncio. A view
> é calculada na leitura: **o estado "desatualizada" não existe**. É o mesmo
> motivo pelo qual `crm_clinica` é view sobre `crm_clinica_dados`.

> **Por que uma coluna só.** Quem lê vai falar com uma pessoa. Valor sem rótulo
> obriga o agente a adivinhar qual linha é o CEP e qual é o bairro — e uma hora
> ele erra. Frase pronta elimina a adivinhação, na mesma lógica do campo
> `mensagem` da API.

> **Campo vazio não vira linha.** O `||` com `NULL` devolve `NULL` e o `WHERE`
> derruba a linha, então a empresa sem site simplesmente não tem a linha `Site:`
> — em vez de ter uma linha `Site: ` pelada, que o agente leria como "o site da
> empresa é nada". O `nullif(trim(...), '')` cobre o campo salvo com espaço em
> branco, que não é `NULL` mas produziria o mesmo efeito.

**A ordem é fixa** dentro da própria view, via uma coluna `ordem` que não é
selecionada. A saída sai sempre na mesma sequência.

**Acesso:** `security_invoker = true`, então vale o RLS de
`configuracoes_clinica`. Na prática: a `service_role` da Edge Function lê, a equipe logada
lê, e quem não tem sessão não lê nada. **O agente lê a view direto, sem passar
pela API** — ele já entra no banco com a `service_role` para gravar os leads em
`crm_clinica`, e uma leitura a mais pela mesma conexão não acrescenta superfície.

```sql
select informacao from public.informacoes_clinica_agente;
```

---

### 4.13. `procedimentos_clinica_agente` (view)

Os serviços que a empresa oferece, **uma coluna, um por linha**, já escrito
como frase. Mesma receita da 4.12, para o agente saber o que existe e não
inventar serviço.

| Coluna | Tipo |
|---|---|
| `procedimento` | `text` |

```
Avaliação Odontológica: Primeira consulta: o dentista examina, conversa sobre o que você quer e monta o plano de tratamento. Sem custo.
Lentes de Contato: Lâminas finíssimas de porcelana coladas na frente dos dentes para mudar cor e formato. Antes deste, marque Avaliação Odontológica.
Limpeza e Profilaxia: Remoção de placa e tártaro com polimento final, indicada a cada seis meses. A partir de R$ 250,00.
…
```

*(O exemplo é o kit odontológico, com um valor preenchido na Limpeza.)*

**A frase final segue a ordem do `case`, que é a regra de negócio:**

| Situação | Final da linha |
|---|---|
| `exige_avaliacao` **e** existe uma porta ativa | `. Antes deste, marque <nome da porta>.` |
| `preco_a_partir_de = 0` | `. Sem custo.` |
| `preco_a_partir_de > 0` | `. A partir de R$ X.` |
| nada disso | *(nada)* |

Passar pela porta vence o preço: um valor preenchido por engano num serviço
que passa por ela nunca é falado. **Sem porta, a primeira linha da tabela não
existe** (`0026`) — até ali, a view escrevia "Antes deste, marque a avaliação."
mesmo sem avaliação nenhuma, e a atendente prometia um agendamento que não dava
para marcar. A porta nunca manda marcar a si mesma (`a.id <> s.id`).

> ⚠️ **As três frases são contrato com o `prompt.md`** (o genérico e o do kit),
> que explica o que cada uma significa. Mudou a frase aqui, mude lá.

> **O nome ocupa a posição do rótulo**, e não há prefixo `Procedimento:`. Aqui
> todas as linhas são da mesma natureza — repetir a palavra em vinte linhas
> seria ruído que o agente leria em voz alta. Na 4.12 o rótulo existe porque
> cada linha é de um tipo diferente.

> **Sem descrição, a linha é só o nome.** O `coalesce` sobre o `||` faz o trecho
> inteiro sumir, em vez de deixar um dois-pontos pendurado no fim.

**Ordem:** `created_at` — a mesma da página Serviços, que é a ordem que a
empresa escolheu. No kit, começa pela Avaliação, por onde quase todo
tratamento passa; alfabética jogaria os Alinhadores para a frente e a
Avaliação para o meio.

> Note que **o endpoint `GET /procedimentos` da API ordena por nome**, não por
> cadastro, e devolve só o nome, sem descrição. São superfícies diferentes para
> consumidores diferentes: a API existe desde antes, e o agente agora lê a view.

**Só os ativos.** Desligar o serviço na página Serviços tira ele da boca do
agente, sem ninguém mexer no código.

```sql
select procedimento from public.procedimentos_clinica_agente;
```

---

### 4.14. `profissionais_clinica_agente` (view)

Os profissionais ativos, **uma coluna, um por linha**, com a jornada de cada um —
que é o que a pessoa pergunta logo em seguida.

| Coluna | Tipo |
|---|---|
| `profissional` | `text` |

```
Ana Souza: atende segunda a sexta das 08:00 às 18:00. Só faz: Coloração.
Beatriz Rocha: atende terça das 13:00 às 19:00, quinta das 13:00 às 19:00
Pedro Alves
```

O nome ocupa a posição do rótulo, como na 4.13. Sem jornada cadastrada, a linha
é só o nome — o `coalesce` sobre o `||` derruba o trecho inteiro em vez de
deixar um "atende" pendurado. Ordem alfabética, que é como se lê lista de gente.
Só os ativos: desligar o profissional na tela Profissionais tira ele da boca do
agente.

**"Só faz: ..." (migração `0027`)** aparece só em quem tem lista em
`profissional_servicos`, com os serviços **ativos** na ordem do catálogo. Sem
lista, nada é acrescentado — e o prompt explica que sem "Só faz" a pessoa faz
todos. Sem isto a atendente ofereceria a Ana para um corte, e a agenda
recusaria na hora de marcar, na frente do cliente.

> ⚠️ **Quem tem lista só de serviços desativados não perde o "Só faz"**: a
> linha diz *"Só faz: nenhum serviço ativo no momento."* Sem isso ela leria que
> a pessoa faz tudo, enquanto a agenda não a oferece para nada.

> ⚠️ **A view não traz o `id`, de propósito.** Ela é para **conversar**. Para
> marcar com um profissional específico, o `profissional_id` vem de
> `GET /profissionais` da API — um UUID no meio de uma frase falável só serviria
> para o agente ter que extrair de volta, e ninguém lê UUID em voz alta.

```sql
select profissional from public.profissionais_clinica_agente;
```

---

### 4.15. `jornada_texto(profissional)`

A função que transforma grade de horário em frase. Serve às duas coisas:

| Argumento | Lê | Usada por |
|---|---|---|
| `null` | `horario_comercial` | `informacoes_clinica_agente` (4.12) |
| `uuid` | `profissional_horarios` daquele profissional | `profissionais_clinica_agente` (4.14) |

```sql
select public.jornada_texto(null);   -- segunda a sexta das 08:00 às 18:00, sábado das 08:00 às 12:00
```

**O trabalho é agrupar dias seguidos com o mesmo horário.** Sem isso a frase
vira seis linhas repetindo "das 08:00 às 18:00", que ninguém fala assim e o
agente leria inteiro. O agrupamento é a técnica clássica de ilhas:
`ordem - row_number()` fica constante enquanto a sequência não quebra.

**Domingo vira 7 na ordenação.** A semana do banco começa nele, mas a frase em
português começa na segunda — assim sai "segunda a sexta, sábado, domingo", e
não o contrário.

Nenhum dia ativo devolve `NULL`, o `||` propaga e a linha some da view.

> As duas tabelas de horário têm as mesmas colunas relevantes (`dia_semana`,
> `hora_inicio`, `hora_fim`, `ativo`), por isso **uma função só** atende as
> duas. A migração 0007 tinha criado `horario_atendimento_texto()` apenas para a
> empresa; a 0009 unificou e a apagou. Duas cópias da regra de agrupamento seria
> uma a mais do que o necessário, e a segunda envelheceria calada.

---

### 4.16. `n8n_chat_histories` — não existe

**Esta tabela não está no banco.** Conferido:
`select to_regclass('public.n8n_chat_histories')` devolve `null`.

Ela vem do desenho antigo, em que a conversa seria orquestrada pelo **n8n** e a
memória ficaria no nó Postgres Chat Memory, que cria a própria tabela na
primeira mensagem que recebe na vida. Esse caminho foi abandonado antes de rodar
uma mensagem sequer: o agente virou código deste repositório (seção 8), e a
memória dele é `mensagens_whatsapp` (4.17).

A seção continua aqui, e vazia de propósito — o nome aparece em commits antigos,
em documentação anterior e nas quatro colunas `*_chatwoot` de
`crm_clinica_dados` (4.1), que também nunca foram preenchidas. **Quem topar com
a referência precisa achar a resposta em algum lugar**, e a resposta é: não
existe, não vai existir, procure em `mensagens_whatsapp`.

> **Se você está migrando um banco que TEM essa tabela**, ela não pertence a este
> schema. Nada aqui a lê ou escreve, nenhuma migração a cria, e nenhuma tela a
> mostra.

---

### 4.17. `mensagens_whatsapp` · `configuracoes_agente` (migração `0010`)

Criadas para o Agente de IA próprio — a Letícia — que substitui o fluxo do n8n.

**📘 A documentação completa está em
[`agente-ia/README.md`](agente-ia/README.md), seção 6.** Aqui fica só o
resumo, para quem estiver lendo o schema de cima a baixo.

| Objeto | O que é |
|---|---|
| `mensagens_whatsapp` | Cada mensagem trocada. É a memória do agente **e** a fonte da tela Conversas — a mesma, de propósito |
| `configuracoes_agente` | Uma linha: modelo, prompt em uso, liga/desliga, modo teste e o provedor de WhatsApp ativo |
| `agente_deve_responder(text)` | A regra do modo teste, num lugar só |
| `mensagens_whatsapp_atualiza_lead` | Trigger que mantém `ultima_mensagem` — **só conta mensagem do contato** |
| Bucket `midias-whatsapp` | **Privado**, diferente de `avatars` e `logos` (seção 7) |

Três colunas novas em `crm_clinica_dados`: `agente_pausado`, `assumido_por` e
`assumido_em` — o botão "Assumir conversa".

#### `modelo` — sem `CHECK`, de propósito

`text not null default 'gpt-4.1'`. **Não há restrição no banco**, e isso é
escolha: acrescentar modelo não deveria exigir migração, pela mesma razão de
[`cores.ts`](src/lib/cores.ts) e da lista de fusos. Quem recusa o valor errado
é a API do fornecedor, e o motivo dela ("this model does not exist") é melhor
que um `23514` nosso.

Os valores aceitos vivem em **três lugares**, e nada os sincroniza:

| Onde | O quê |
|---|---|
| `ModeloAgente`, em [`src/types/index.ts`](src/types/index.ts) | O tipo |
| `MODELOS`, em [`src/lib/modelosIA.ts`](src/lib/modelosIA.ts) | Nome, nota e fornecedor de cada um — é o que a tela desenha |
| `conversar()`, em `supabase/functions/_shared/llm.ts` | Para qual API vai, e com quais parâmetros |

> ⚠️ **A tela não oferece o que não tem chave.** `GET /whatsapp/chaves-ia`
> responde quais fornecedores estão configurados nos secrets — **sim ou não,
> nunca a chave** — e o card do modelo sem chave nasce desligado, com o motivo.
> Antes disso, escolher um Claude com a `ANTHROPIC_API_KEY` vazia derrubava a
> atendente em silêncio: o erro só aparecia no log da função.

#### `provedor_whatsapp` (migração `0017`)

Qual ponte com o WhatsApp está ativa: `evolution` ou `uazapi`. **Uma de cada
vez** — o `CHECK` não impede, mas o sistema fala com uma só.

A coluna nasceu com um provedor implementado, de propósito: ela é barata agora
e cara depois. Sem ela, a tela diria "Evolution" em texto fixo, e o dia da
troca viraria caça ao literal espalhado por telas, rotas e mensagens de erro.

**Desde 01/09 as duas estão implementadas.** A abstração foi escrita só quando
a segunda API chegou — com um provedor só, a interface seria palpite. Quem lê
esta coluna é `_shared/pontes.ts`, **a cada requisição**: trocar na tela vale
na mensagem seguinte, sem republicar a função. As credenciais das duas podem
conviver preenchidas nas secrets; o que decide é esta coluna, não a presença
da chave.

> ⚠️ **As credenciais NÃO moram aqui.** Ficam nas secrets do Supabase, fora do
> alcance do navegador. `configuracoes_agente` é lida por `authenticated` com
> acesso total (seção 6): chave de API nessa tabela seria chave visível para
> qualquer pessoa com login no sistema. Esta coluna diz **quem** está ativo,
> nunca **como** se autentica.

> Por que a tela precisa mostrar isso: em 01/09 o servidor da Evolution caiu e o
> único sintoma foi silêncio no WhatsApp. Saber qual provedor está ativo é o que
> diz em qual painel ir olhar — "WhatsApp desconectado", sozinho, não responde
> essa pergunta.

#### `nome_agente` (migração `0019`)

Como o Agente de IA se chama. Antes vivia em **dois sistemas que não se
falavam** — `src/lib/agente.ts` (as telas) e `agente-ia/prompt.md` (a conversa)
—, e renomear exigia editar os dois torcendo para nenhum ficar para trás.

Agora é uma coluna, e os dois leem dela: as telas pelo `useAgente()`, o prompt
pelo marcador `{{NOME_AGENTE}}`.

> ⚠️ **É o NOME, não o cargo.** "Atendente IA" (o crachá) e "Atendente de IA"
> (o nome da página) continuam constantes no código: trocar "Letícia" por
> "Sofia" não deve renomear a tela.

`not null` com padrão `'Letícia'` e `CHECK` de 1 a 40 caracteres depois do
`trim`. Vazio não é um estado que valha a pena existir — a agente se apresenta
em toda primeira mensagem, e nulo obrigaria todo leitor a ter um fallback
próprio, até um deles esquecer e ela se apresentar como "undefined".

Regra do projeto: mudou o `CHECK`, mude `src/types/index.ts` no mesmo commit.

> ⚠️ **A `0010` teve que dropar e recriar a view `crm_clinica`** para as três
> colunas novas aparecerem nela: a view era `select d.*`, e o Postgres
> **congela** essa expansão no momento da criação.
>
> **Hoje o caminho é outro.** Desde a `0016` a view lista as colunas uma a uma,
> e acrescentar coluna é `create or replace view` com a coluna nova **no fim**
> da lista — sem `drop`, então os `grant` ficam. **Repita
> `with (security_invoker = true)`**, como a `0016` fez: foi essa opção que a
> `0022` deixou para trás. A seção 3 conta o que isso custou, e a consulta de
> segurança da seção 10 tem que voltar vazia depois.

> ⚠️ **`horario_comercial` é o horário da empresa; `profissional_horarios` é o
> que a agenda realmente oferece.** Os dois podem divergir: anunciar até as
> 18:00 sem nenhum profissional depois das 17:00 faz o agente prometer horário
> que a consulta de disponibilidade recusa em seguida. A Letícia lê o primeiro para
> conversar e o segundo para marcar — e não tem como perceber sozinha que os
> dois discordam.

---

### 4.18. `conversas_lista` (view, migrações `0013` e `0014`)

A coluna da esquerda da tela **Conversas**: uma linha por pessoa que já trocou
mensagem, com a última frase, quantas estão sem ler, quem assumiu e o
agendamento marcado.

**Usada por:** [`src/lib/conversas.ts`](src/lib/conversas.ts) e, por ela,
[`ListaConversas.tsx`](src/components/ListaConversas.tsx). O Agente de IA
**não** lê esta view — ela é de tela, não de conversa.

| Coluna | Vem de |
|---|---|
| `lead_id`, `nome_lead`, `whatsapp_lead`, `status` | `crm_clinica_dados` |
| `agente_pausado`, `assumido_por`, `assumido_em` | `crm_clinica_dados` |
| `assumido_por_nome` | join com `usuarios` |
| `ultimo_conteudo`, `ultimo_tipo`, `ultimo_autor`, `ultima_em` | a última linha de `mensagens_whatsapp` |
| `nao_lidas` | contagem em `mensagens_whatsapp`, só `autor = 'paciente'` |
| `data_agendamento` | `crm_clinica_dados` — o agendamento ativo mais próximo (`0014`) |

#### Por que é view, e não consulta na tela

O que a lista precisa é **a última mensagem de cada conversa** — um
`distinct on`, que o PostgREST não sabe pedir. Sem a view, a tela teria duas
saídas ruins: uma consulta por conversa (N+1 a cada atualização, e a lista
atualiza a cada mensagem que chega) ou baixar todas as mensagens de todo mundo
para descartar 95% no navegador.

Ela é calculada na leitura, como `crm_clinica` e as três views do agente. O
estado "desatualizada" não existe.

#### "Quem agendou?" se pergunta a `data_agendamento`, nunca ao `status`

É a armadilha desta view, e ela erra **em silêncio**.

A leitura óbvia de "esta pessoa marcou horário" seria
`status = 'consulta_agendada'`. Mas o trigger `consultas_sincroniza_lead`
(seção 5) **preserva** `consulta_realizada` e `paciente_recorrente` quando
alguém marca de novo — de propósito, porque é por esses dois status que
[`src/lib/pessoas.ts`](src/lib/pessoas.ts) separa `/leads` de `/clientes`, e
rebaixá-los jogaria um cliente de volta na lista de Leads a cada retorno.

**Consequência: um cliente que volta e marca continua em
`paciente_recorrente`.** Filtrar por status perderia exatamente quem mais volta
— serviço de várias sessões, retorno, manutenção.

`data_agendamento` não tem esse problema: o mesmo trigger a recalcula para
**qualquer** status, como `min(data_consulta)` dos agendamentos ativos, e a zera
quando não sobra nenhum. É a única coluna da ficha que responde à pergunta.

A regra vive em `temConsultaMarcada()`, em
[`src/lib/conversas.ts`](src/lib/conversas.ts) — não repita a comparação solta
na tela.

```sql
-- Os que um filtro por status perderia. Toda linha aqui é um erro evitado:
select nome_lead, status, data_agendamento
  from public.crm_clinica_dados
 where data_agendamento is not null
   and status <> 'consulta_agendada';
```

> A coluna entrou **no fim** da lista, e não ao lado de `status`, onde leria
> melhor. `create or replace view` no Postgres só aceita colunas novas no fim;
> reordenar exigiria `drop view`, que derrubaria os grants e deixaria a tela sem
> lista no meio do caminho.

#### Três detalhes que a definem

1. **`join lateral` sem `left`, de propósito.** Quem nunca trocou mensagem não é
   uma conversa, e não aparece na lista. Um lead cadastrado na mão pela recepção
   fica de fora até alguém escrever.
2. **`security_invoker = true`**, pelo mesmo motivo de `crm_clinica`. Sem isso a
   view rodaria com os poderes de quem a criou, e a `anon key` — que é pública,
   vai no bundle do site — leria as conversas de todos os contatos sem sessão.
3. **Sem `order by` embutido.** A ordem natural é `order=ultima_em.desc`, e quem
   consulta é que pede: `order by` dentro de view é ignorado por qualquer
   consulta que ordene por cima, e dá a falsa impressão de estar garantido.

#### Desempenho

Os três índices que ela usa já vieram da `0010`, e não por acaso:

| Índice | Serve a |
|---|---|
| `mensagens_whatsapp_conversa_idx` (`lead_id, criada_em`) | O `limit 1` da última mensagem |
| `mensagens_whatsapp_nao_lidas_idx` (parcial) | A contagem de não lidas |
| `mensagens_whatsapp_recentes_idx` (`criada_em desc`) | A ordenação da lista |

> ⚠️ **Realtime não assina view.** A tela assina as TABELAS
> `mensagens_whatsapp` e `crm_clinica_dados`, e **relê** esta view quando algo
> chega. Assinar a view não dá erro: simplesmente nunca dispara — a mesma
> armadilha de `crm_clinica` (seção 8.6).

> **Por que reler em vez de remendar com o payload.** O evento traz a linha da
> tabela; a lista precisa da última mensagem, do contador de não lidas e do nome
> de quem assumiu — três coisas calculadas na view. É a mesma decisão da Agenda,
> que recarrega o período em vez de aplicar o payload.

---

### 4.19. Funções do Dashboard (migração 0024)

Seis funções, todas **somente leitura** e **`security invoker`** — rodam com as
permissões de quem chamou, e o RLS já libera leitura para `authenticated`.
Elevar privilégio aqui só ampliaria o estrago de uma chamada indevida.

| Função | Devolve | Recorta por |
|---|---|---|
| `fuso_da_clinica()` | `text` — o fuso, com `America/Sao_Paulo` de padrão | — |
| `dashboard_numeros(ini, fim)` | `novos_contatos`, `consultas_agendadas` | `inicio_atendimento` / `data_marcacao_agendamento` |
| `dashboard_por_dia(ini, fim)` | uma linha por dia: `dia`, `atendimentos`, `agendamentos` | idem |
| `dashboard_dia_semana(ini, fim)` | 7 linhas: `dia_semana` (0=domingo), `contatos` | `inicio_atendimento` |
| `dashboard_profissionais(ini, fim)` | `profissional_id`, `nome`, `cor`, `consultas` | **`data_consulta`** |
| `dashboard_procedimentos(ini, fim)` | `procedimento`, `procurado`, `realizado` | `inicio_atendimento` **e** `data_consulta` |

**A taxa de conversão não é calculada aqui**, de propósito: é a divisão de dois
números que já estão na resposta. Devolvê-la seria uma terceira versão da mesma
verdade, pronta para divergir no dia em que alguém mudar o arredondamento.

#### O fuso, e por que ele não é detalhe

Agrupar por dia exige saber onde o dia começa, e **a sessão do PostgREST roda em
UTC**. Um contato das 23h de São Paulo é 02h do dia seguinte em UTC:

```sql
select (timestamptz '2026-09-01 23:30-03' at time zone 'America/Sao_Paulo')::date;  -- 2026-09-01
select (timestamptz '2026-09-01 23:30-03')::date;                                    -- 2026-09-02
```

Sem `at time zone`, todo mundo que escreve à noite cairia no dia seguinte do
gráfico — sistematicamente, e sem nada na tela sugerindo isso.

**As bordas do período não passam por fuso**: chegam como `timestamptz`, e
comparar instantes independe de fuso. Só o balde precisa.

> ⚠️ Se o `fuso_horario` da empresa discordar do relógio do computador da
> recepção, os baldes saem deslocados em relação às bordas escolhidas na tela. É
> a mesma conferência da aba Horários.

#### Três decisões que parecem sobrar

1. **`dashboard_por_dia` limita a série a 370 dias.** "Todo o período" começa na
   origem do tempo — sem teto, vinte mil pontos num gráfico de 260px. A tela
   compara o primeiro dia devolvido com o que pediu e **avisa** quando cortou.
2. **`dashboard_profissionais` inclui profissional ativo com zero agendamentos.**
   "Ninguém marcou com o João neste mês" é um achado, não um vazio. E inclui
   uma linha `Sem profissional` quando existe: a agenda aceita agendamento sem
   profissional, e sem essa linha a soma das barras não bateria com o total.
3. **`dashboard_procedimentos` usa `full outer join`.** Serviço realizado por
   quem nunca declarou interesse (o profissional indicou no atendimento)
   existe, e é o caso mais interessante do gráfico. Um `left join` o apagaria.

#### Conferência (rodada em 02/09/2026, com 6 leads)

No banco da clínica onde o sistema nasceu:

| Função | Devolveu | Contagem à mão |
|---|---|---|
| `dashboard_numeros` | 6 / 3 | 6 / 3 |
| `dashboard_por_dia('1970-01-01', now())` | 370 pontos | o teto |
| `dashboard_dia_semana` | 7 linhas, soma 6 | 6 |
| `dashboard_profissionais` | Marcos 3, Juliana 1, Sem profissional 1 | idem |
| `dashboard_procedimentos` | Carga Imediata 2/1, Extração de Siso 2/1 | idem |

---

### 4.20. `agente_followups` (migração `0030`)

A agente volta a falar quando a conversa esfria. Até a `0030` ela era **100%
reativa**: a Edge Function só acorda com um webhook, ou seja, só quando alguém
escreve. Follow-up é o contrário — falar quando ninguém escreveu —, e por isso
exige um relógio dentro do banco.

| Peça | O que é |
|---|---|
| `agente_followups` | Uma linha por follow-up enviado: `lead_id`, `etapa` (1 ou 2), `enviado_em` e o `texto` que o modelo escreveu |
| 5 colunas em `configuracoes_agente` | `followup_ativo`, `followup_1_minutos` (10), `followup_2_horas` (24), `followup_inicio` (09:00) e `followup_fim` (20:30) |
| `followups_pendentes()` | **Toda a política.** Quem está devendo follow-up, e de qual etapa |
| `disparar_followups()` | O que o `pg_cron` chama de minuto em minuto: havendo fila, acorda a Edge Function |

#### O relógio é a última mensagem do LEAD

É a decisão central do arquivo. Se o prazo contasse da última mensagem **de
qualquer um**, o follow-up da etapa 1 reiniciaria o próprio relógio: as 24
horas da etapa 2 passariam a contar da fala dela, e cada toque empurraria o
seguinte para sempre.

Contando do último `autor = 'paciente'`, as duas etapas medem a mesma coisa — há
quanto tempo a **pessoa** está calada — e o ciclo **se rearma sozinho**: quando
ela responde, os follow-ups já enviados ficam para trás daquela data e voltam a
valer na próxima vez que a conversa esfriar. É isto que a consulta pergunta:

```sql
not exists (select 1 from agente_followups f
            where f.lead_id = ... and f.etapa = 1
              and f.enviado_em > c.ultima_do_lead)
```

#### As travas, que são o que separa follow-up de spam

| Trava | Por quê |
|---|---|
| **Pediu para não ser procurado** | `nao_perturbe`, ligado pela ferramenta de mesmo nome. É a única trava sobre o que a pessoa **disse** — ver abaixo |
| **Já é cliente** | `consulta_realizada` e `paciente_recorrente` ficam de fora. O follow-up existe para trazer quem ainda não veio; cliente que some não está sumindo de uma negociação, está sem assunto |
| A última palavra tem que ser da agente | Se o lead falou por último, ela está **devendo resposta**. Follow-up ali esconde um defeito atrás de uma simpatia |
| Quem tem hora marcada não recebe | Isso seria lembrete de consulta: outro texto, outro momento, outra funcionalidade |
| Conversa pausada ou assumida fica de fora | `agente_pausado` e `assumido_por` (migração `0010`). O robô não entra por cima de quem está atendendo à mão |
| `agente_deve_responder()` vale igual | A mesma trava do webhook, o que faz o **modo teste** valer aqui. Sem ela, o primeiro teste dispararia para todo mundo que já escreveu |
| A etapa 1 tem teto de tempo | Ela só vale **entre** os dois prazos. Sem o teto, quem está calado há três dias receberia a etapa 1 e a 2 no mesmo minuto |
| Só a etapa 2 respeita a janela | Decisão de produto: 10 minutos é dentro de uma conversa viva, e quem escreveu 22h30 está acordado às 22h40. Um dia depois, não |
| **Quem cancelou pula a etapa 1** | Ver abaixo |

#### "Não me procure mais" — a única trava sobre o que a pessoa disse

Três colunas em `crm_clinica_dados` (`nao_perturbe`, `nao_perturbe_em`,
`nao_perturbe_motivo`), ligadas pela ferramenta `nao_perturbe` da agente. Todas
as outras travas são estruturais — tem hora marcada, está pausada, já recebeu —
e nenhuma delas lê a conversa. Sem esta, quem escreve *"não tenho mais
interesse"* recebe um follow-up dez minutos depois, e insistir depois de um não
explícito é o caminho mais curto para o número ser denunciado.

**Quem marca é a agente**, porque é ela que está lendo: é a única capaz de
separar *"não quero mais nada"* de *"não quero esse horário"*. O prompt manda
não usar em dúvida — deixar de marcar custa uma mensagem a mais; marcar por
engano cala o sistema para sempre com alguém que ainda queria ser atendido.

⚠️ **Isto não cala a agente.** Se a pessoa escrever de novo, ela responde
normalmente. O que acaba é a **procura**, não o atendimento — quem cala é
`agente_pausado`, que é outra coisa e tem outro botão. E a ferramenta só liga,
nunca desliga: voltar atrás é decisão de gente, na ficha.

As três colunas estão na view `crm_clinica`, para a equipe poder ver por que
aquele lead parou de receber follow-up. Um lead que some da fila sem explicação
é o defeito que este projeto mais persegue.

#### Quem cancelou é o lead mais perto de voltar

Cancelar **não** é dizer "não quero mais": a pessoa quis, escolheu dia e hora e
desmarcou, quase sempre porque o horário deixou de servir. Tratá-la como quem
perdeu o interesse joga fora o lead mais fácil de recuperar que existe.

Duas consequências no código:

- **Ela pula o toque de 10 minutos** (`ultimo_status <> 'cancelada'` na etapa 1).
  Dez minutos depois de desmarcar, um "quer remarcar?" soa como quem não aceitou
  o não. Ela cai na etapa 2, que com a janela de horário chega **no dia
  seguinte** — que é quando o convite funciona.
- **A instrução do follow-up conta o que aconteceu**, com o serviço e o dia que
  ela tinha marcado, e manda convidar para um horário novo **sem perguntar por
  que cancelou**. Isso mora na `oQueAconteceuComOAgendamento()`, na Edge
  Function, e não na ficha: as frases da ficha são contrato com o `prompt.md` e
  seriam cobradas em toda mensagem de toda conversa.

O mesmo vale para quem **faltou** (`status = 'faltou'`), com outro texto: nada
de cobrar a falta.

#### A reserva é gravada ANTES do envio

O cron bate a cada minuto; gerar o texto e enviar leva segundos. Sem reserva,
a batida seguinte leria a mesma fila e a pessoa receberia o mesmo toque duas
vezes. A Edge Function grava a linha **antes de responder 200** ao cron, e a
apaga se o envio falhar — quem falha volta para a fila, quem foi atendido sai
dela.

#### O Kanban ganhou moradores

As colunas **Follow-up 1** e **Follow-up 2** existem desde a `0001` e nunca
receberam ninguém: não havia o que movesse um lead para lá. Agora o envio move —
de `iniciou_conversa`, `conversando` e `consulta_cancelada` (e, na etapa 2,
também de `follow_up_1_feito`).

**`consulta_cancelada` entra na lista**, e isso é intencional: quem cancelou
continua sendo lead, o cancelamento é um passo dentro do funil e não uma saída
dele, e ver o card em "Follow-up" é como a equipe descobre que aquele
cancelamento **já foi perseguido**. O cancelamento não some — fica no
agendamento, na conversa e em `agente_followups`.

Quem está em `consulta_realizada` ou `paciente_recorrente` **não é tocado**:
esses dois status são o que separa a tela Clientes da tela Leads, e mudá-los
arrancaria um cliente de onde a equipe o procura.

#### O cron não é agendado por migração

`cron.schedule` precisa do endereço da função — que carrega o ref do projeto — e
do `WEBHOOK_SEGREDO`. Nada de instalação nenhuma entra em arquivo versionado
(a mesma regra que tirou o `--project-ref` do `package.json`). Quem agenda é
`npm run followup:ligar`, que guarda os dois no **Vault** do próprio banco;
`followup:desligar` tira da agenda e `followup:estado` mostra job, batidas e
fila.

---

### 4.21. `agente_lembretes` e `consultas.confirmada_em` (migração `0037`)

A agente avisa quem tem horário marcado, e o SIM da pessoa vira o selo
**Confirmada** na Agenda. Mesmo desenho do follow-up: a política inteira mora
em `lembretes_pendentes()`, o `pg_cron` chama `disparar_lembretes()` a cada
minuto e ela só acorda a Edge Function (`POST /whatsapp/lembretes`) quando há
fila.

| Peça | O que é |
|---|---|
| `configuracoes_agente.lembretes_ativo` | A chave geral. **Nasce `false`**: instalação com consultas futuras de gente de verdade não começa a mandar mensagem sozinha. Liga-se na tela Atendente de IA |
| `lembrete_vespera_ativo` / `_horas` | O lembrete antecipado — padrão 24 h (2 a 72). Só sai dentro da janela `followup_inicio`–`followup_fim` |
| `lembrete_antes_ativo` / `_minutos` | O de cima da hora — padrão 30 min (10 a 360). A qualquer hora |
| `lembrete_pedir_confirmacao` | O antecipado termina com "responda SIM" |
| `consultas.confirmada_em` | Quando confirmou (SIM ou a equipe, à mão). O gatilho `consultas_limpa_confirmacao` zera quando a data muda |
| `agente_lembretes` | Uma linha por lembrete enviado: `(consulta_id, etapa, para_data)` é `unique` e serve de reserva, como em `agente_followups` |

**As travas** (todas em `lembretes_pendentes()`): só consulta `agendada` e
futura; um lembrete por etapa por data (remarcou, a data nova ganha os dela);
não lembra do que acabou de ser marcado (`created_at` depois do momento do
lembrete); o antecipado não sai a menos de 1 h do "antes"; `nao_perturbe` não
recebe; e `agente_deve_responder()` — agente ligada e modo teste respeitado.

**A confirmação.** O webhook, depois da espera, lê a rajada da pessoa. Se é um
"sim" (`_shared/lembretes.ts`, `lerConfirmacao`), chama
`confirmar_presenca(lead)`, que só marca a consulta cujo lembrete antecipado
**pediu** confirmação para aquela data. Só "sim" e cortesia: resposta fixa
("Presença confirmada! Te esperamos amanhã…") e a agente não entra. "Sim" mais
uma pergunta: confirma, e a agente responde o resto. Sem lembrete esperando, o
"sim" segue para a agente como qualquer mensagem.

O texto dos lembretes é **fixo** (sem modelo de IA) e fica gravado em
`agente_lembretes.texto` e na conversa, como mensagem da agente. Como quem tem
hora marcada não recebe follow-up, os dois não se atropelam.

As três funções são só da `service_role`: expõem telefone, mudam consulta ou
fazem a agente falar. O relógio é `npm run lembretes:ligar` (endereço no Vault
como `lembretes_url`; o segredo é o mesmo `followup_segredo`).

---

### 4.22. Convênios (migração `0038`)

A primeira peça da roda da clínica odontológica: o convênio traz o paciente, o
plano de tratamento converte o que ele não cobre em particular, o retorno
semestral traz de volta.

| Peça | O que é |
|---|---|
| `convenios` | Os convênios aceitos. **Não se apaga em uso** (ficha e consulta apontam com `ON DELETE RESTRICT`): desativa-se, e ele some da Letícia e das listas |
| `convenio_coberturas` | A linha existir = o convênio cobre aquele serviço |
| `convenio_repasses` | Quanto o convênio paga à clínica por serviço. **RLS por `valores`**, para ler e para alterar — para os outros a leitura volta vazia |
| `crm_clinica_dados.forma_pagamento` | `particular`, `convenio` ou nulo (não se sabe), com `convenio_id`, `convenio_carteirinha` e `convenio_validade` |
| `consultas.forma_pagamento` | Idem, com `convenio_id`. Check: convênio exige qual; particular não tem convênio |
| `crm_clinica.convenio_nome` | Calculada na visão, para a tela e para a ficha da Letícia |

**A regra da consulta** (gatilho `consultas_forma_pagamento_padrao`, antes do
insert, só quando a forma vem vazia — vale para a tela, a Letícia e a API):
ficha convênio X + serviço coberto por X → convênio X; ficha convênio X +
serviço não coberto → particular (a conversão); ficha particular → particular;
ficha em branco → em branco. Quando a ficha é preenchida depois, o gatilho
`leads_completa_forma_pagamento` completa as consultas **futuras e em branco**
— nunca mexe no que alguém escolheu.

Os dois gatilhos são `SECURITY DEFINER`: quem marca a consulta pode não ver a
ficha, e quem edita a ficha pode não mexer na agenda — sem isso, a regra
falharia calada justo para a recepção. A regra em si
(`forma_pagamento_padrao`) é só da `service_role`.

**A Letícia**: `informacoes_clinica_agente` ganha "Convênios aceitos: …" e
`procedimentos_clinica_agente`, "Cobertura de convênio: …" em cada serviço
coberto. A ferramenta `atualizar_ficha` grava `forma_pagamento`, `convenio`
(enum dos ativos) e `carteirinha`; convênio fora da lista volta como recusa
(`convenio_nao_aceito`), e ela oferece o particular.

---

### 4.23. Odontograma (migração `0040`)

O mapa da boca: dente por dente, face por face. O que está **a tratar** é a
matéria-prima do plano de tratamento (a fase seguinte).

| Peça | O que é |
|---|---|
| `odontogramas` | Um por paciente: `deciduos` mostra os dentes de leite (51–85) |
| `odontograma_registros` | Cada achado: `dente` (FDI, conferido por `dente_fdi_valido`), `faces` (M, D, O, V, L; vazio = dente inteiro), `condicao`, `situacao` (`a_tratar`, `existente`, `tratado`), `observacao`, quem criou e quem alterou por último |
| `odontograma_historico` | Criou / alterou / apagou, com o antes e o depois em JSON, quem e quando. **Só o gatilho escreve** (`odontograma_registra`, `SECURITY DEFINER`); a equipe só lê |

**Quem vê:** quem vê a ficha. A política pergunta à própria `crm_clinica_dados`
(`exists`), e o RLS dela decide — a profissional vê o odontograma de quem ela
atende, e só esse.

**Quem mexe:** a permissão `odontograma`, nova — Admin e profissional por
padrão, recepção não. ⚠️ A lista de permissões mora em `permissao_padrao`,
`minhas_permissoes`, `equipe()` e nos `src/lib/acesso.ts` e `equipe.ts`:
permissão nova entra em todos.

Apagar a pessoa apaga o odontograma e o histórico em cascata (o gatilho não
tenta registrar o apagamento de quem já não existe).

---

## 5. Status do funil

`crm_clinica_dados.status` aceita exatamente estes 9 valores, garantidos por
`CHECK`:

| Valor | Significado |
|---|---|
| `iniciou_conversa` | Lead chegou, ainda sem interação real *(default)* |
| `conversando` | Conversa em andamento com o agente |
| `consulta_agendada` | Agendamento marcado — na tela, "Agendou" |
| `consulta_cancelada` | Agendamento cancelado — na tela, "Cancelou" |
| `follow_up_1_feito` | Primeira retomada enviada — escrito pela migração `0030`, ver [4.20](#420-agente_followups-migração-0030) |
| `follow_up_2_feito` | Segunda retomada — idem |
| `follow_up_3_feito` | Terceira retomada. **Ninguém escreve este status**: o follow-up automático tem duas etapas, e a terceira coluna só recebe quem a equipe arrastar até lá |
| `consulta_realizada` | Compareceu |
| `paciente_recorrente` | Voltou mais de uma vez — na tela, "Cliente Recorrente" |

> **Estes dois últimos status separam as telas `/leads` e `/clientes`.** Quem
> está em `consulta_realizada` ou `paciente_recorrente` aparece em Clientes;
> todo o resto aparece em Leads. A regra fica em `src/lib/pessoas.ts` — ao
> adicionar um status novo, decida a qual dos dois lados ele pertence.

`consultas.status` aceita **4** valores (`faltou` entrou na migração `0015`) —
na tela, Agendado, Realizado, Cancelado e Faltou:

| Valor | Significado | Bloqueia horário? |
|---|---|:---:|
| `agendada` | Marcado e ainda de pé *(default)* | **sim** |
| `realizada` | A pessoa compareceu | não |
| `cancelada` | Desmarcado, com aviso | não |
| `faltou` | Não compareceu e não avisou | não |

> **`faltou` não é `cancelada`, e a distinção é o motivo de ele existir.** Quem
> liga desmarcando e quem simplesmente não aparece pedem telefonemas
> diferentes, e taxa de falta é métrica de agenda. Jogados na mesma linha, os
> dois viram um número que não responde nada.
>
> No **funil**, porém, os dois caem no mesmo lugar (`consulta_cancelada`): as
> duas situações significam "não tem horário marcado e precisa reagendar". O
> motivo mora no agendamento, que é onde ele pertence.

Só `agendada` participa da restrição de exclusão `consultas_sem_sobreposicao` —
agendamento que não aconteceu não segura horário na agenda.

> **`realizada` é a única porta automática para `/clientes`.** Ver a tabela do
> trigger, logo abaixo.

### O funil acompanha a agenda sozinho

O trigger **`consultas_sincroniza_lead`** (função
`public.sincronizar_agendamento_lead`) mantém a ficha do lead coerente com o que
acontece na agenda:

| Escrita em `consultas` | Efeito em `crm_clinica_dados` |
|---|---|
| INSERT com `status = 'agendada'` | `data_agendamento` = o agendamento ativo mais próximo do lead; `data_marcacao_agendamento` = agora; `status` → `consulta_agendada` |
| UPDATE de `data_consulta` (remarcação) | `data_agendamento` é recalculada. **`data_marcacao_agendamento` não muda** |
| UPDATE para `status = 'cancelada'` ou `'faltou'`, **restando outro agendamento ativo** | `data_agendamento` passa para o próximo. **O `status` não muda** |
| UPDATE para `status = 'cancelada'` ou `'faltou'`, **era o último** | `data_agendamento` = nulo; `status` → `consulta_cancelada` |
| UPDATE para `status = 'realizada'`, **1º do lead** | `data_agendamento` recalculada; `status` → `consulta_realizada` — **a pessoa vira Cliente aqui** |
| UPDATE para `status = 'realizada'`, **2º ou mais** | `status` → `paciente_recorrente` |

> ⚠️ **Os dois últimos entraram na `0015`, e antes deles NADA promovia ninguém a
> Cliente.** O trigger só reagia a `agendada` e `cancelada`, e — pior — nenhuma
> tela marcava agendamento como realizado: a Agenda só sabia cancelar. A pessoa
> era atendida e ficava em `consulta_agendada` para sempre.

**Recorrente é contado, não digitado.** O trigger faz `count(*)` dos
agendamentos `realizada` do lead na hora, em vez de deduzir do status anterior:
assim a regra é idempotente e se corrige sozinha se alguém editar um agendamento
antigo na mão.

Quatro decisões embutidas aí:

1. **Remarcar não é marcar de novo.** Se `data_marcacao_agendamento` fosse
   reescrita a cada remarcação, o Dashboard contaria o mesmo agendamento duas
   vezes — uma no mês original, outra no mês para o qual foi adiado.
2. **Quem já é cliente não volta a ser lead.** Os status `consulta_realizada` e
   `paciente_recorrente` são preservados: são eles que separam `/leads` de
   `/clientes` (`src/lib/pessoas.ts`), e rebaixá-los jogaria um cliente
   recorrente de volta na lista de Leads a cada retorno que marcasse.
3. **Cancelar uma sessão não é desistir do serviço.** Muito serviço é feito em
   várias sessões marcadas de uma vez. Por isso o trigger sempre
   **recalcula** `data_agendamento` a partir dos agendamentos ativos que restam
   (`min(data_consulta)`), em vez de deduzir da linha que disparou a operação — e
   só muda o funil para `consulta_cancelada` quando não sobra nenhum.
4. **Quem escreve a baixa é a tela; quem move o funil é o trigger.** A Agenda e
   o aviso de pendências gravam só `consultas.status`. A promoção a Cliente é
   consequência, e é consequência **atômica**: duas telas escrevendo o funil na
   mão divergiriam na primeira falha de rede.

Está num trigger, e não no React, porque a API do Agente de IA (seção 8) não
passa pelo React. Escreveu agendamento, o funil acompanha — venha de onde vier.

> **`status = 'realizada'` era deliberadamente ignorado pelo trigger — até a
> `0015`.** A ideia era que marcar comparecimento fosse ato manual na ficha,
> junto com o `valor_pago`. Na prática ninguém fazia: nenhuma tela sequer
> oferecia o botão, e o resultado foi que **ninguém nunca virava Cliente**.
>
> Hoje a baixa é explícita — a recepção responde "compareceu" ou "faltou", e o
> trigger tira a conclusão. Continua não havendo salto automático a partir do
> calendário: alguém precisa confirmar. O que mudou é que agora existe onde
> confirmar, e um aviso que cobra.

> **Ao alterar qualquer um destes valores, mude nos dois lugares:** o `CHECK` no
> banco **e** os tipos `LeadStatus` / `ConsultaStatus` em
> [`src/types/index.ts`](src/types/index.ts). Eles não são sincronizados
> automaticamente — se divergirem, o TypeScript compila e o banco rejeita a
> gravação em runtime.
>
> Foi usado `text + CHECK` em vez de `ENUM` nativo justamente para isso: alterar
> um `CHECK` é um `ALTER` simples; alterar um `ENUM` em uso é bem mais penoso.

---

## 6. Segurança (RLS)

**Premissa: sistema interno.** Todo usuário autenticado é da equipe e enxerga
tudo. Quem não estiver logado não enxerga nada.

RLS está **ativo nas 21 tabelas**. São 15 políticas:

| Tabela | Política | Operação | Regra |
|---|---|---|---|
| `crm_clinica_dados` | `leads_all` | ALL | `authenticated` — acesso total |
| `consultas` | `consultas_all` | ALL | `authenticated` — acesso total |
| `profissionais` | `profissionais_all` | ALL | `authenticated` — acesso total |
| `profissional_horarios` | `profissional_horarios_all` | ALL | `authenticated` — acesso total |
| `profissional_bloqueios` | `profissional_bloqueios_all` | ALL | `authenticated` — acesso total |
| `profissional_servicos` | `profissional_servicos_all` | ALL | `authenticated` — acesso total |
| `configuracoes_clinica` | `clinica_all` | ALL | `authenticated` — acesso total |
| `horario_comercial` | `horario_all` | ALL | `authenticated` — acesso total |
| `servicos_clinica` | `servicos_all` | ALL | `authenticated` — acesso total |
| `usuarios` | `usuarios_select` | SELECT | `authenticated` — vê todos os perfis |
| `api_tokens` | `api_tokens_all` | ALL | `authenticated` — acesso total |
| `mensagens_whatsapp` | `mensagens_whatsapp_all` | ALL | `authenticated` — acesso total |
| `configuracoes_agente` | `configuracoes_agente_all` | ALL | `authenticated` — acesso total |
| `agente_followups` | `agente_followups_le` | SELECT | `authenticated` — **só leitura**: quem grava é a Edge Function, com a `service_role` |
| `usuarios` | `usuarios_update_own` | UPDATE | **só o próprio** (`auth.uid() = id`) |

Mais **10** políticas em `storage.objects` (seção 7) — leitura, escrita e
remoção nos três buckets. O total do banco, com a consulta que o confere, está
na [seção 10](#10-consultas-úteis-para-verificação).

> As duas de `DELETE` (`avatars_own_delete` e `logos_team_delete`) chegaram na
> migração `0020`. Antes dela dava para trocar a foto e a logo, e não dava para
> tirar.

> **As duas Edge Functions usam a `service_role key`, que ignora o RLS** — são
> servidor, não sessão de usuário. O que limita cada uma não é o RLS:
> a `agenda/` é limitada pela superfície dos sete endpoints; a `whatsapp/`,
> pela lista fechada da seção 8.1, que é disciplina de código.

A função `sincronizar_agendamento_lead` (seção 5) **não** usa `security definer`:
roda com as permissões de quem chamou, que já tem acesso total pelas políticas.
Elevar privilégio ali só ampliaria o estrago de uma chamada indevida da API.

A view `crm_clinica` não tem políticas próprias: ela **herda** o RLS de
`crm_clinica_dados` por causa do `security_invoker = true`.

### Se precisar de níveis de acesso

O modelo atual não distingue papéis. Se a empresa precisar que a recepção não
veja valores financeiros, por exemplo, será preciso adicionar uma coluna de
papel em `usuarios` e reescrever as políticas — **mais fácil decidir isso antes
de ter dados** do que depois.

---

## 7. Storage

Três buckets. Os dois primeiros são **públicos**, porque o código usa
`getPublicUrl()` neles; o terceiro é **privado**, e a diferença não é detalhe.

| Bucket | Público? | Caminho | Conteúdo |
|---|:---:|---|---|
| `avatars` | sim | `{user_id}/avatar.{ext}` | Foto de perfil |
| `logos` | sim | `clinic/logo.{ext}` | Logo da empresa |
| `midias-whatsapp` | **não** | `{lead_id}/{mensagem_id}.{ext}` | O áudio e a foto que o contato mandou |

| Política | Bucket | Operação | Regra |
|---|---|---|---|
| `avatars_public_read` | avatars | SELECT | público |
| `avatars_own_insert` | avatars | INSERT | só na própria pasta (`auth.uid()`) |
| `avatars_own_update` | avatars | UPDATE | só na própria pasta |
| `avatars_own_delete` | avatars | DELETE | só na própria pasta |
| `logos_public_read` | logos | SELECT | público |
| `logos_team_insert` | logos | INSERT | qualquer autenticado |
| `logos_team_update` | logos | UPDATE | qualquer autenticado |
| `logos_team_delete` | logos | DELETE | qualquer autenticado |
| `midias_whatsapp_equipe_le` | midias-whatsapp | SELECT | qualquer autenticado |
| `midias_whatsapp_equipe_grava` | midias-whatsapp | INSERT | qualquer autenticado |

> INSERT **e** UPDATE são necessários em `avatars` e `logos` porque o upload usa
> `{ upsert: true }`. Só com INSERT, a segunda troca de foto falha.

> ⚠️ **DELETE chegou na migração `0020`, e antes dela o botão "Remover" seria
> uma mentira.** `storage.objects` tem RLS: sem política, o `remove()` do
> cliente volta sem apagar. A tela nularia a coluna achando que deu certo, e o
> arquivo ficaria servindo na URL antiga — apagado na tela, vivo na internet.
> Por isso a tela apaga **o arquivo primeiro e a coluna depois**, e desiste da
> coluna se o arquivo não sair.
>
> E ela esvazia a **pasta inteira**, não o arquivo da URL: a extensão entra no
> caminho (`avatar.png`, `avatar.jpg`), então quem já trocou de formato deixou
> o anterior lá dentro.

> **`midias-whatsapp` continua sem DELETE, de propósito.** Ali quem apaga é a
> Edge Function com a `service_role key`, pela rota `/whatsapp/apagar-pessoa`,
> em ordem (mídia primeiro, ficha depois). Uma política para a equipe abriria
> um segundo caminho para o mesmo estrago, sem essa ordem e sem a contagem na
> frente.

> ⚠️ **`midias-whatsapp` é privado de propósito, e precisa continuar assim.**
> Ali ficam áudios e fotos que os contatos mandaram — foto do próprio corpo,
> inclusive. Um bucket público entrega isso a quem descobrir a URL, sem login. Por isso a tela
> abre esses arquivos por **signed URL**, e não por `getPublicUrl()`.

> Quem grava é a Edge Function, com a `service_role key`, que não passa por
> política nenhuma. As duas políticas acima existem para a **equipe logada** ver
> a mídia na tela e anexar arquivo ao responder.

### ⚠️ O Storage **não** cascateia

Apagar um lead leva junto as mensagens e os agendamentos — as duas chaves
estrangeiras são `ON DELETE CASCADE`. **Os arquivos não vão.** Eles não são
linha do banco; `midia_url` é só o caminho.

Pior: apagar por SQL também não resolve, porque o Postgres recusa — e o
motivo é justamente esse:

```
ERROR: 42501: Direct deletion from storage tables is not allowed.
HINT:  This prevents accidental data loss from orphaned objects.
```

Apagar só o registro deixaria o arquivo no backend, invisível e sem ninguém que
soubesse a quem pertencia. O único caminho é a **Storage API**, que exige a
`service_role key`.

**Por isso apagar uma pessoa é rota de Edge Function, e não `delete` da tela:**
`POST /whatsapp/apagar-pessoa` apaga a mídia **primeiro** e a ficha depois. A
ordem não é detalhe — o caminho do arquivo é `{lead_id}/...`, então apagar a
ficha antes destruiria a única forma de saber quais arquivos eram dela.

> Um órfão real ficou no bucket em 01/09, de um lead apagado por SQL antes desta
> rota existir. Fica de exemplo do que a regra evita.

---

## 8. Integração com o Agente de IA

O agente é a **Letícia**, e ela **mora dentro deste projeto**: a Edge Function
[`supabase/functions/whatsapp/`](supabase/functions/whatsapp/). Quem entrega as
mensagens é a ponte de WhatsApp ativa — a **Evolution API** ou a **uazapi**,
ambas não oficiais, v2, à escolha da empresa (4.17) —, que chama a função por
webhook. Quem pensa é o modelo escolhido na tela, da OpenAI ou da Anthropic.

```
cliente ──▶ ponte ──webhook──▶ Edge Function `whatsapp` ────▶ modelo
              ▲                         │      ▲                │
              └──── resposta ───────────┘      └── ferramentas ─┘
                                        │
                                        ▼
                                 ESTE BANCO
```

Tudo o que ela é — prompt, ferramentas, modelo, decisões — está documentado em
[`agente-ia/README.md`](agente-ia/README.md). Esta seção cobre só o que ela
encosta **no banco**.

> **O desenho antigo, com n8n e Chatwoot, foi abandonado.** Não é mais uma
> automação externa apontada para cá: é código deste repositório. Três
> consequências para quem lê o schema:
>
> - **`n8n_chat_histories` não existe** e não vai existir. A memória da conversa
>   é `mensagens_whatsapp` ([4.17](#417-mensagens_whatsapp--configuracoes_agente-migração-0010)).
>   Ver [4.16](#416-n8n_chat_histories--não-existe).
> - **As quatro colunas `*_chatwoot`** de `crm_clinica_dados` continuam no
>   schema e **ninguém escreve nelas** ([4.1](#41-crm_clinica_dados--crm_clinica)).
> - **A chave de acesso não é colada em lugar nenhum.** O Supabase injeta a
>   `service_role key` na Edge Function; ela não passa por configuração de
>   ferramenta externa (8.2).

### 8.1. O que o agente toca no banco

Esta é a lista fechada. Nada fora dela é acessado pela função `whatsapp`.

| Objeto | Tipo | Acesso | Para quê |
|---|---|:---:|---|
| `crm_clinica` | view sobre `crm_clinica_dados` | **lê e grava** | Cria o lead na primeira mensagem, avança `iniciou_conversa` → `conversando`, e grava `nome_lead`, `procedimentos_interesse` e `resumo_conversa` pela ferramenta `atualizar_ficha` |
| `mensagens_whatsapp` | tabela (4.17) | **lê e grava** | A memória da conversa: cada mensagem trocada, dos dois lados. Lê as últimas 50 para montar o histórico |
| `consultas` | tabela (4.2) | **grava só por função SQL** | Marcar, remarcar e cancelar passam por `agenda_marcar`, `agenda_remarcar` e `agenda_cancelar` (4.11). Lê direto, **só os daquele lead**: o agendamento futuro entra na ficha do prompt, e o histórico sai pela ferramenta `historico_do_cliente` |
| Storage `midias-whatsapp` | bucket privado (7) | **grava** | O áudio e a foto que o contato mandou |
| `informacoes_clinica_agente` | view (4.12) | **só lê** | Nome, endereço, bairro, cidade/UF, CEP, horário de atendimento, Maps, Instagram e site — em frases prontas |
| `procedimentos_clinica_agente` | view (4.13) | **só lê** | Os serviços ativos, um por linha, com a descrição curta |
| `profissionais_clinica_agente` | view (4.14) | **só lê** | Os profissionais ativos, a jornada de cada um e o "Só faz: ..." de quem tem lista |
| `servicos_clinica` | tabela (4.6) | **só lê** | A `descricao_longa` de **um** serviço, pela ferramenta `detalhes_do_servico` — nunca a tabela inteira |
| `agenda_quem_faz()` | função (4.11) | **só lê** | Quem faz um serviço, quando ela pede horário com um profissional específico — para recusar dizendo quem faz |
| `configuracoes_agente` | tabela (4.17) | **só lê** | Modelo, prompt em vigor, e o `agente_deve_responder()` que decide se aquele número é atendido |
| `configuracoes_clinica` | tabela (4.4) | **só lê** | Só o `fuso_horario`, sem o qual toda data sai errada |

**Fora do alcance dela:** `profissionais`, `profissional_horarios`,
`profissional_bloqueios`, `profissional_servicos`, `horario_comercial`,
`usuarios` e `api_tokens`. As
tabelas de cadastro alimentam as views acima e as funções da agenda — e é por
ali que a informação chega até ela, já filtrada e já legível.

```sql
-- o que vai dentro do prompt, a cada mensagem
select informacao   from public.informacoes_clinica_agente;
select procedimento from public.procedimentos_clinica_agente;
select profissional from public.profissionais_clinica_agente;
```

> **As três views são para conversar, não para operar.** Nenhuma traz `id`. O
> `profissional_id` que a agenda precisa é resolvido **pelo nome**, dentro do
> código da ferramenta — uuid em prompt é convite para alucinação.

> **`minutos_ultima_mensagem` e `ultima_mensagem` ninguém precisa gravar.** O
> trigger de `mensagens_whatsapp` (4.17) carimba `ultima_mensagem`, e a view
> calcula os minutos na leitura.

> **Os follow-ups (`follow_up_1/2/3`) ainda não têm quem os escreva.** As
> colunas existem desde a `0001` e o Dashboard já as lê; a rotina que carimba
> depende de um agendador, que não foi construído.

### 8.2. A `service_role key` e o RLS

As políticas de RLS liberam apenas o papel `authenticated` — sessões de usuário
logado. **A Edge Function não tem sessão.**

O Supabase entrega a `service_role key` às Edge Functions por variável de
ambiente (`SUPABASE_SERVICE_ROLE_KEY`), e é ela que
[`_shared/db.ts`](supabase/functions/_shared/db.ts) usa em todo `fetch` ao
PostgREST. Essa chave **passa por cima do RLS**: a disciplina de só encostar no
que está na lista de 8.1 é do código, não do banco.

Duas consequências:

- **A chave nunca vai para o frontend.** No navegador roda a `anon key`,
  protegida por RLS. Se algum dia a `service_role` aparecer em `src/`, é
  incidente de segurança, não descuido de estilo.
- **Se alguém apontar outra automação para este banco**, ela precisa da mesma
  chave. Com a `anon key`, as gravações **falham em silêncio**: `200 OK`, zero
  linhas afetadas, nenhum lead no sistema.

### 8.3. O caminho de uma mensagem

1. A ponte ativa chama `POST /` da função, com o segredo em `x-webhook-segredo`
   — ou em `?segredo=`, que é como a uazapi manda
2. A função descarta grupo, newsletter e status, e **grava a mensagem** em
   `mensagens_whatsapp` — antes de qualquer coisa, para nada se perder
3. Se o número ainda não tem ficha, cria o lead em `crm_clinica` com
   `status = 'iniciou_conversa'`
4. Áudio e foto vão para o bucket `midias-whatsapp`, e **os dois viram texto
   na coluna `conteudo`**: o áudio pelo Whisper, a foto por um modelo de visão
   que a descreve. Nenhuma imagem segue para o modelo da conversa — ver a
   seção "A foto vira texto" do [`agente-ia/README.md`](agente-ia/README.md)
5. **Espera 12 segundos, em duas etapas.** Aos 8, acende o "digitando…"; aos 12,
   responde. Se chegou mensagem nova em qualquer uma delas, esta execução
   desiste — quem responde é a última. É o que faz a Letícia responder as três
   mensagens picadas de uma vez, como gente
6. `agente_deve_responder()` decide: agente ligado? conversa não assumida por
   alguém da equipe? número liberado no modo teste?
7. Monta o prompt (as três views + a data de hoje) e as últimas 50 mensagens
8. Chama o modelo, executa as ferramentas que ele pedir, e repete até ele
   parar de pedir — no máximo 6 voltas
9. A resposta é quebrada em 2 ou 3 mensagens, cada uma com "digitando…" antes
10. Grava o que respondeu em `mensagens_whatsapp` e avança
    `iniciou_conversa` → `conversando`

### 8.4. O que o agente NÃO faz

**Não insere em `consultas`.** Marcar horário não é gravar uma linha: é
conferir a jornada do profissional, recusar conflito com o que já existe,
escolher quem está livre e, ao remarcar, mover tudo num passo atômico. Um `INSERT` direto
pularia tudo isso e, ao bater na restrição de sobreposição, devolveria um
`23P01` cru — sem nenhuma frase para dizer a quem está esperando no WhatsApp.
Por isso as ferramentas chamam as funções da seção 4.11, e só elas.

**Não grava `data_agendamento` na ficha do lead.** Era assim antes de a Agenda
existir. Hoje o resultado seria um agendamento que aparece no CRM e não no
calendário — duas telas contando histórias diferentes sobre o mesmo fato. A
fonte da verdade é a linha em `consultas`; `data_agendamento` virou reflexo,
mantido pelo trigger `consultas_sincroniza_lead`.

**Não grava WhatsApp sem o código do país.** O formato canônico é
`5511987654321`, só dígitos. O número local entra, mas passa a ser um segundo
registro do mesmo telefone, invisível para a busca e para a unicidade (4.1). Um
`23505` na volta significa que o lead daquele número já existe: busque por
`whatsapp_lead` e siga com o que voltou.

**Não escreve em cadastro.** Serviços, profissionais, jornadas e horários
são da empresa, feitos pelas telas. Ela lê o que precisa pelas views de 8.1.

**Não decide sozinha se responde.** Quem decide é `agente_deve_responder()`, no
banco. Enquanto o modo teste estiver ligado, ela grava e mostra na tela toda
mensagem que chegar — e responde só aos números da lista.

### 8.5. A API da agenda continua existindo — para quem é de fora

A Edge Function [`agenda/`](supabase/functions/agenda/) e seus sete endpoints
não foram substituídos. Contrato e cURLs em [`API_AGENTE.md`](API_AGENTE.md).

A diferença é o caminho, não a regra:

| Quem | Como chega na agenda | Autenticação |
|---|---|---|
| A Letícia (função `whatsapp`) | Chama as funções SQL **direto**, por RPC no PostgREST | A `service_role key` que o Supabase injeta |
| Qualquer integração externa | `POST /marcar`, `GET /disponibilidade`… na função `agenda` | Token próprio, criado no menu do usuário → Token e API |

**As duas descem para as mesmas funções da 4.11.** A regra de jornada, a escolha
de profissional livre e a trava de sobreposição vivem num lugar só — e é isso que
mantém as duas portas honestas entre si. A `agenda/` acrescenta, para quem está
de fora, o que a Letícia não precisa: conferência de token, tradução de recusa
em frase pronta e HTTP.

O que existe no banco por causa dessa história:

| Peça | Por quê |
|---|---|
| `consultas_sem_sobreposicao` (4.2) | Recepção e agente escrevem ao mesmo tempo; só o banco fecha a janela |
| `chave_externa` UNIQUE (4.2) | Retry não pode virar agendamento duplicado. A Letícia usa `wa_{lead}_{data_hora}` |
| `profissional_bloqueios` (4.9) | Sem isso não existe "disponibilidade" confiável |
| `configuracoes_clinica.fuso_horario` (4.4) | Servidor em UTC; sem fixar o fuso, a disponibilidade erra em 3 horas |
| `origem` (4.2) | Sem isso é impossível medir ou auditar o que o agente marcou sozinho |

Duas coisas que valem para as **duas** Edge Functions:

- **Nenhuma delas pode ter dependência externa.** O runtime sobe com
  `--no-remote`; um `import` de `supabase-js` derruba a função inteira com
  `BOOT_ERROR` antes de rodar uma linha. Toda conversa com o banco é `fetch` no
  PostgREST. Import relativo de `_shared/` funciona normalmente.
- **A regra de disponibilidade em SQL espelha [`src/lib/agenda.ts`](src/lib/agenda.ts).**
  Se divergirem, o agente oferece horário que a recepção vê como ocupado. Mudou
  uma, mude a outra.

---

### 8.6. Realtime — atualização automática da tela

O CRM e a tela de detalhe assinam `postgres_changes` para reagir sozinhos
quando o Agente de IA mexe num lead: o card anda de coluna no Kanban sem
ninguém apertar F5.

A Agenda faz o mesmo com `consultas`: a tela fica aberta na recepção o dia
inteiro enquanto o Agente de IA marca pelo WhatsApp.

Para isso funcionar, as tabelas precisam estar publicadas:

```sql
alter publication supabase_realtime add table public.crm_clinica_dados;  -- 0001
alter publication supabase_realtime add table public.consultas;          -- 0002
```

> A Agenda **recarrega o período** a cada evento em vez de aplicar o payload: o
> evento vem da tabela e não traz o nome da pessoa, que na tela vem de um join
> com `crm_clinica_dados`.

### ⚠️ Publique a TABELA, nunca a VIEW

A replicação lógica do Postgres **só funciona com tabelas**. Assinar
`crm_clinica` (a view) não dá erro — a inscrição é criada normalmente e
simplesmente **nunca dispara**. É uma falha silenciosa clássica.

Por isso existe uma assimetria proposital no código:

| Operação | Objeto usado |
|---|---|
| `select` / `insert` / `update` / `delete` | `crm_clinica` (a **view**) |
| Assinatura de Realtime | `crm_clinica_dados` (a **tabela**) |

Ver [`CRM.tsx`](src/pages/CRM.tsx) e [`LeadDetail.tsx`](src/pages/LeadDetail.tsx).

### Consequência para o payload

Eventos de Realtime vêm da tabela física, então **não trazem**
`minutos_ultima_mensagem` — a coluna existe só na view. Os dois handlers fazem
merge (`{ ...anterior, ...payload.new }`), então o valor já carregado é
preservado e só fica defasado até o próximo carregamento. Para um contador em
minutos, é aceitável.

### REPLICA IDENTITY

Fica no padrão (chave primária), e é suficiente: `UPDATE` traz a linha nova
inteira e `DELETE` traz o `id`, que é tudo que o código usa. `FULL` só seria
necessário para ler valores antigos de colunas fora da PK.

### Verificar

```sql
select schemaname, tablename from pg_publication_tables
where pubname = 'supabase_realtime';
-- esperado: public | consultas
--           public | crm_clinica_dados
--           public | mensagens_whatsapp
```

Se essa consulta voltar vazia, o Realtime está morto — e nada na interface vai
indicar isso.

---

## 9. Armadilhas conhecidas

Lista do que quebra este banco de formas não óbvias:

1. **Recriar qualquer view sem `security_invoker = true`** → o RLS deixa de valer.
   Vale para `crm_clinica` e para as três views do agente (4.12 a 4.14).
2. **Assinar Realtime na view `crm_clinica`** → a inscrição é criada sem erro e
   nunca dispara. Assine sempre `crm_clinica_dados` (seção 8.6).
3. **Tentar escrever em `minutos_ultima_mensagem`** → erro; é coluna calculada.
4. **Automação usando a `anon key`** → gravações falham sem erro visível.
5. **Alterar o `CHECK` de `status` sem atualizar `src/types/index.ts`**
   (ou o contrário) → compila e quebra só em runtime.
6. **Criar a linha em `usuarios` na mão** → conflito com o trigger.
7. **Inserir duas linhas em `configuracoes_clinica`** → bloqueado pelo índice
   singleton; o código não trata esse erro.
8. **Duplicar `dia_semana` em `horario_comercial`** → bloqueado pelo UNIQUE.
9. **Confundir `data_agendamento` com `data_marcacao_agendamento`** → métricas
   do Dashboard erradas, sem nenhum sinal de erro.
10. **Excluir um lead** → apaga em cascata todos os agendamentos e o histórico
    financeiro dele.
11. **Rodar `0002` sem `0001`** → falha: o `0002` usa `set_updated_at` e altera
    `consultas`, que só existem depois do primeiro arquivo.
12. **Repetir a chamada depois de um `23P01`** → dá exatamente o mesmo erro. Isso
    não é falha transitória: é o banco recusando dois agendamentos no mesmo
    horário do mesmo profissional. A saída é outro horário.
13. **Automação inserindo em `consultas` sem `chave_externa`** → o retry cria um
    segundo agendamento idêntico e a pessoa recebe duas confirmações.
14. **Gravar `data_agendamento` direto na ficha do lead pela automação** → o
    agendamento aparece no CRM e some da Agenda. A fonte da verdade é
    `consultas`.
15. **Cadastrar profissional sem jornada** → ele existe, mas a agenda o trata
    como quem nunca atende, e todo agendamento com ele vira "fora do expediente".
16. **`horario_comercial` e `profissional_horarios` discordando** → é a armadilha
    mais silenciosa desta lista, porque **não há erro nenhum**: os dois cadastros
    estão certos cada um por si. A empresa que anuncia sábado das 08:00 às 12:00
    sem nenhum profissional com sábado na jornada faz o agente dizer que atende
    no sábado — e, na mesma conversa, não achar horário nenhum. O cliente
    entende que a empresa está enrolando. **Conferir sempre que mexer numa das
    duas**, comparando `jornada_texto(null)` com `jornada_texto(id)` de cada
    profissional (4.15).
17. **Apagar um profissional com agendamentos** → bloqueado pelo `ON DELETE
    RESTRICT` (`23503`). Use `ativo = false`.
18. **Gravar em `consultas.data_fim`** → é coluna derivada, sobrescrita pelo
    trigger na próxima escrita de `data_consulta` ou `duracao_minutos`. Grave
    esses dois e deixe o fim com o banco.
19. **Gravar WhatsApp sem o código do país** → o número entra (o trigger só tira
    pontuação, não inventa DDI) e passa a conviver com o mesmo telefone escrito
    de outra forma. A unicidade não pega, e a busca não acha.
20. **Criar o índice `crm_clinica_whatsapp_unico` com duplicatas no banco** →
    o Postgres recusa. Rode a consulta de duplicados da seção 10 e resolva
    antes.
21. **Acrescentar `import` na Edge Function** → `BOOT_ERROR` no boot, com todos
    os endpoints fora do ar de uma vez. O runtime roda com `--no-remote`.
22. **Esquecer `set search_path = public` numa função `security definer`** →
    brecha de escalada de privilégio.
23. **Criar (ou recriar com `drop`) uma função `security definer` sem o
    `revoke`/`grant` da `0028`** → ela nasce executável pela `anon key`, que
    está no navegador de qualquer um. Como passa por cima do RLS, quem não tem
    login faz o que a função faz. É a mesma armadilha da 1, pela porta das
    funções.

---

## 10. Consultas úteis para verificação

Depois de rodar a migração, confira se está tudo de pé:

```sql
-- Objetos criados (esperado: 21 tabelas + 5 views, mais a `_migracoes_aplicadas`
-- de quem usa o scripts/aplicar-migracoes.mjs)
select table_name, table_type from information_schema.tables
where table_schema = 'public' order by table_name;

-- Tabelas de `public` sem RLS (esperado: NENHUMA linha)
select relname from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- Políticas (esperado: 49 — 39 em public + 10 em storage)
--
-- ⚠️ ESTE É O ÚNICO LUGAR DA DOCUMENTAÇÃO ONDE ESTE NÚMERO É ESCRITO.
--    Ele já esteve em cinco documentos, com três valores diferentes, e
--    nenhum era o certo: a `0020` acrescentou duas políticas de DELETE e
--    ninguém atualizou as cópias. Mexeu nas políticas? Mude AQUI, e só aqui.
--    (A `0030` acrescentou a 15ª, a de leitura de `agente_followups`. A `0031`,
--    dos níveis de acesso, separou leitura de alteração em quase todas as
--    tabelas: 28 em public. A `0037` acrescentou a leitura de
--    `agente_lembretes`: 29. A `0038` (convênios) acrescentou cinco: 34.
--    A `0040` (odontograma), mais cinco: 39. Os testes da 0031, 0037,
--    0038 e 0040 conferem este número.)
select schemaname, count(*) from pg_policies
where schemaname in ('public','storage') group by schemaname;

-- Realtime (esperado: as 3 tabelas — assinar a VIEW nunca dispara)
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' order by 1;
-- esperado: consultas, crm_clinica_dados, mensagens_whatsapp

-- Divergência entre o horário anunciado e o que a agenda oferece (armadilha 16)
select 'clínica' as quem, public.jornada_texto(null) as jornada
union all
select p.nome || ' ' || p.sobrenome, public.jornada_texto(p.id)
  from public.profissionais p where p.ativo;

-- A restrição anti-conflito existe? (esperado: 1 linha, contype = 'x')
select conname, contype from pg_constraint
where conname = 'consultas_sem_sobreposicao';

-- Triggers da agenda (esperado: as 3 linhas)
select tgname from pg_trigger
where tgname in ('consultas_sincroniza_lead', 'consultas_data_fim', 'consultas_updated_at');

-- Algum WhatsApp fora do formato canônico? (esperado: 0 linhas)
select id, nome_lead, whatsapp_lead from public.crm_clinica_dados
where whatsapp_lead is not null
  and whatsapp_lead <> regexp_replace(whatsapp_lead, '[^0-9]', '', 'g');

-- Algum número repetido? (esperado: 0 linhas — se vier alguma, o índice único
-- não existe)
select whatsapp_lead, count(*), string_agg(nome_lead, ' | ')
from public.crm_clinica_dados where whatsapp_lead is not null
group by 1 having count(*) > 1;

-- Views que FURAM o RLS (esperado: NENHUMA linha — armadilha 1)
--
-- Era uma lista de todas as views para conferir o `security_invoker` de cada
-- uma. A `crm_clinica` apareceu nela sem a opção, da `0022` até a `0028`, e
-- ninguém percebeu: conferência que exige ler linha por linha não acusa nada.
-- Por isso agora ela só lista o que está errado.
select c.relname from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
  and not coalesce('security_invoker=true' = any(c.reloptions)
                or 'security_invoker=on'   = any(c.reloptions), false);

-- Funções que passam por cima do RLS e a chave pública chama
-- (esperado: SÓ `definir_valor_pago`, `definir_valor_pago_consulta`,
-- `valor_pago_visivel` e `valores_das_consultas` — armadilha 23)
--
-- As quatro são exceções de propósito (migrações 0031 e 0033): leem e gravam
-- as colunas de valor pago, que a equipe não alcança, e cada uma confere
-- `pode('valores')` antes. Qualquer OUTRO nome nesta lista é um furo.
select p.proname from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.prosecdef
  and p.prorettype <> 'trigger'::regtype
  and (has_function_privilege('anon', p.oid, 'execute')
    or has_function_privilege('authenticated', p.oid, 'execute'));

-- O cálculo dos minutos funciona? (esperado: 95)
select floor(extract(epoch from (now() - (now() - interval '95 minutes'))) / 60)::integer;

-- FOLLOW-UP (migração 0030)
--
-- A fila de agora. Num banco recém-instalado volta vazia — e volta vazia
-- também com o follow-up funcionando bem, porque quem foi atendido sai dela.
select * from public.followups_pendentes();

-- O cron está agendado? (esperado: 1 linha, DEPOIS do npm run followup:ligar)
select jobname, schedule, active from cron.job where jobname = 'followups';

-- Lembretes (0037): a fila de agora e o relógio (DEPOIS do npm run lembretes:ligar)
select * from public.lembretes_pendentes();
select jobname, schedule, active from cron.job where jobname = 'lembretes';

-- As últimas batidas. `succeeded` com `return_message` vazio é o normal:
-- é o minuto em que não havia ninguém na fila.
select d.status, d.return_message, d.start_time
from cron.job_run_details d join cron.job j on j.jobid = d.jobid
where j.jobname = 'followups' order by d.start_time desc limit 10;

-- O que já foi enviado, e o texto que o modelo escreveu na hora
select etapa, enviado_em, texto from public.agente_followups
order by enviado_em desc limit 20;
```

Para testar de verdade, faça as requisições com a `anon key` sem estar
logado — é exatamente o que qualquer pessoa consegue fazer copiando a chave do
navegador:

```bash
curl "https://SEU_REF.supabase.co/rest/v1/crm_clinica?select=nome_lead" \
  -H "apikey: SUA_ANON_KEY"
# esperado: "permission denied for view crm_clinica" (ou []) — NUNCA nomes

curl -X POST "https://SEU_REF.supabase.co/rest/v1/rpc/agenda_cancelar" \
  -H "apikey: SUA_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"p_consulta_id":"00000000-0000-0000-0000-000000000000"}'
# esperado: "permission denied for function agenda_cancelar"
# ("nao_encontrada" = a função ainda está aberta)
```
