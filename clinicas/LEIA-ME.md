# Clínicas

Uma pasta por clínica que usa o Núcleo. Cada uma tem o **próprio projeto no
Supabase** (banco, login, funções, WhatsApp); a tela é uma só para todas.

```
clinicas/<nome>/
  clinica.json            nome e projeto Supabase — sem segredo, é versionado
  prompt.md               a atendente desta clínica
  descritor-de-fotos.md   o par do prompt (o marcador de "foto fora do assunto")
  .env.agente.local       as chaves desta clínica — FORA do Git (ver .gitignore)
```

`<nome>` é curto, sem acento e sem espaço: `estetica-jundiai`, `odonto-centro`.

## `clinica.json`

```json
{
  "nome": "Estética Jundiaí",
  "supabase_ref": "abcdefghijklmnopqrst",
  "endereco": "esteticajundiai.seudominio.com.br",
  "kit_de_origem": "kits/clinica-estetica",
  "desde": "2026-10-01"
}
```

`endereco` é `null` enquanto a clínica não tem o endereço próprio. A ficha
pública do endereço (a que a tela lê) é outro arquivo:
`public/clinicas/<endereco>.json` — ver a seção "Várias clínicas" do
`CLAUDE.md`.

## Publicar a atendente de uma clínica

```bash
npm run agente:deploy  -- --clinica <nome>    # gera o prompt DELA e publica no projeto DELA
npm run agente:secrets -- --clinica <nome>    # sobe as chaves de clinicas/<nome>/.env.agente.local
npm run agente:deploy-agenda -- --clinica <nome>
```

Acrescente `--simular` para ver o que seria feito sem publicar.

Sem `--clinica`, vale o projeto do `.supabase-token.local` — e, se ele for de
uma clínica daqui, o kit **dela** é usado sozinho. Publicar o prompt genérico
por cima da atendente de uma clínica não acontece por esquecimento.

## E o `agente-ia/`?

Continua lá, com o prompt **genérico**: é o ponto de partida de uma clínica
nova, e o da instalação avulsa do `INSTALACAO.md`. Mudança que vale para
TODAS as clínicas (uma regra nova, uma ferramenta nova) precisa ser levada ao
`prompt.md` de cada pasta — e cada uma publicada.

⚠️ **Nenhuma chave neste diretório entra no Git.** O `.env.agente.local` já é
ignorado; confira com `git check-ignore -v clinicas/<nome>/.env.agente.local`
antes do primeiro commit de uma clínica nova.
