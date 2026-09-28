-- Teste da 0035 — quem tem `equipe` mas não é dona não vira dona nem mexe em dona.

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       v.email, '{}'::jsonb, now(), now()
from (values
  ('d0000000-0000-0000-0000-00000000000d', 'teste-dona@nucleo.test'),
  ('a0000000-0000-0000-0000-00000000000a', 'teste-gerente@nucleo.test'),
  ('c0000000-0000-0000-0000-00000000000c', 'teste-colega@nucleo.test')
) as v (id, email);

update public.usuarios set papel = 'dona' where id = 'd0000000-0000-0000-0000-00000000000d';
update public.usuarios set papel = 'recepcao', permissoes = '{"equipe": true}' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.usuarios set papel = 'recepcao' where id = 'c0000000-0000-0000-0000-00000000000c';

create temp table r (n serial, ok boolean, texto text);
grant all on r to authenticated;
grant usage, select on sequence r_n_seq to authenticated;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  update public.usuarios set permissoes = '{"valores": true}' where id = 'c0000000-0000-0000-0000-00000000000c';
  get diagnostics n = row_count;
  insert into r (ok, texto) values (n = 1, 'quem tem "equipe" ajusta a permissão de uma colega');

  begin
    update public.usuarios set papel = 'dona' where id = 'a0000000-0000-0000-0000-00000000000a';
    insert into r (ok, texto) values (false, 'ERRO: quem tem "equipe" se promoveu a dona');
  exception when insufficient_privilege then
    insert into r (ok, texto) values (true, 'quem tem "equipe" NÃO se promove a dona');
  end;

  begin
    update public.usuarios set papel = 'dona' where id = 'c0000000-0000-0000-0000-00000000000c';
    insert into r (ok, texto) values (false, 'ERRO: quem tem "equipe" promoveu uma colega a dona');
  exception when insufficient_privilege then
    insert into r (ok, texto) values (true, 'quem tem "equipe" NÃO promove ninguém a dona');
  end;

  begin
    update public.usuarios set ativo = false where id = 'd0000000-0000-0000-0000-00000000000d';
    insert into r (ok, texto) values (false, 'ERRO: quem tem "equipe" desligou a dona');
  exception when insufficient_privilege then
    insert into r (ok, texto) values (true, 'quem tem "equipe" NÃO desliga a dona');
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  update public.usuarios set papel = 'dona' where id = 'c0000000-0000-0000-0000-00000000000c';
  get diagnostics n = row_count;
  insert into r (ok, texto) values (n = 1, 'a dona promove outra pessoa a dona');
end $$;
reset role;

do $$
declare falhas int; txt text;
begin
  select count(*) filter (where not ok), string_agg(case when ok then '✔ ' else '✖ ' end || texto, E'\n' order by n)
    into falhas, txt from r;
  raise exception E'RESULTADO — % falha(s)\n%', falhas, txt;
end $$;
