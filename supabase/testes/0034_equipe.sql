-- Teste da 0034 — a lista da equipe. Roda sobre o banco de hoje e desfaz tudo.

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       v.email, '{"nome": "Teste"}'::jsonb, now(), now()
from (values
  ('d0000000-0000-0000-0000-00000000000d', 'teste-dona@nucleo.test'),
  ('a0000000-0000-0000-0000-00000000000a', 'teste-recepcao@nucleo.test')
) as v (id, email);

update public.usuarios set papel = 'dona' where id = 'd0000000-0000-0000-0000-00000000000d';
update public.usuarios set papel = 'recepcao', permissoes = '{"valores": true, "conversas": false}'
 where id = 'a0000000-0000-0000-0000-00000000000a';

create temp table r (n serial, ok boolean, texto text);
grant all on r to authenticated;
grant usage, select on sequence r_n_seq to authenticated;

insert into r (ok, texto)
select email = 'teste-recepcao@nucleo.test', 'o e-mail do login chega em usuarios (gatilho)'
  from public.usuarios where id = 'a0000000-0000-0000-0000-00000000000a';

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into r (ok, texto)
  select (efetivas ->> 'valores')::boolean and not (efetivas ->> 'conversas')::boolean
         and (efetivas ->> 'pessoas')::boolean and not (efetivas ->> 'configurar')::boolean,
         'dona vê as permissões efetivas da recepcionista (ajustes por cima do papel)'
    from public.equipe() where id = 'a0000000-0000-0000-0000-00000000000a';
  insert into r (ok, texto) select count(*) >= 2, 'dona vê a equipe inteira' from public.equipe();
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into r (ok, texto) select count(*) = 0, 'recepção NÃO vê a lista da equipe' from public.equipe();
  insert into r (ok, texto) select public.pode('valores') and not public.pode('conversas'),
         'os ajustes da dona valem na pode() da recepcionista';
end $$;
reset role;

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
