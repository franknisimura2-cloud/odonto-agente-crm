-- =============================================================================
-- 0044 — Valor de tabela: o preço do plano de tratamento, que a Letícia não fala
-- =============================================================================
--
-- O "a partir de" (`preco_a_partir_de`) é o que a Letícia FALA — e por isso
-- ele não existe nos serviços que passam pela avaliação: implante, canal,
-- lentes têm o valor fechado pelo dentista, e a tela apaga o campo.
--
-- Só que o plano de tratamento (0041) precisa de um ponto de partida para
-- esses mesmos serviços, e o item particular nascia em R$ 0. Este é o valor
-- de TABELA da clínica: interno, só o plano usa, nunca vai para o prompt. A
-- equipe ajusta item por item no plano, como antes.
--
-- A cobertura do convênio continua valendo antes: item coberto nasce em R$ 0.
-- =============================================================================

alter table public.servicos_clinica
  add column if not exists valor_tabela numeric(10,2) check (valor_tabela is null or valor_tabela >= 0);

comment on column public.servicos_clinica.valor_tabela is
  'Valor de tabela para o plano de tratamento (interno — o agente nao le). '
  'Item particular novo nasce com ele; sem ele, com o preco_a_partir_de.';

create or replace function public.plano_itens_padrao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead      uuid;
  v_forma     text;
  v_convenio  uuid;
  v_preco     numeric;
begin
  if new.servico_id is not null then
    select coalesce(s.valor_tabela, s.preco_a_partir_de) into v_preco
      from public.servicos_clinica s where s.id = new.servico_id;
  end if;

  if new.cobertura is null then
    select p.lead_id into v_lead from public.planos_tratamento p where p.id = new.plano_id;
    select l.forma_pagamento, l.convenio_id into v_forma, v_convenio
      from public.crm_clinica_dados l where l.id = v_lead;

    if v_forma = 'convenio' and new.servico_id is not null and exists (
         select 1 from public.convenio_coberturas cc
           join public.convenios cv on cv.id = cc.convenio_id and cv.ativo
          where cc.convenio_id = v_convenio and cc.servico_id = new.servico_id) then
      new.cobertura   := 'convenio';
      new.convenio_id := v_convenio;
    else
      new.cobertura   := 'particular';
      new.convenio_id := null;
    end if;
  end if;

  if new.valor is null then
    new.valor := case when new.cobertura = 'convenio' then 0 else coalesce(v_preco, 0) end;
  end if;
  return new;
end;
$$;
