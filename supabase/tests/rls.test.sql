begin;
select plan(6);

-- Dois usuários e dois negócios
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@teste.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@teste.com');
insert into public.businesses (id, owner_id, name, category, city) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Negócio A', 'cafes', 'Balneário Camboriú'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Negócio B', 'bares', 'Balneário Camboriú');
insert into public.messages (sender_id, recipient_id, sender_business_id, recipient_business_id, body) values
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a',
   '10000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a', 'Oi A');

-- Age como o usuário A
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.businesses), 1, 'A só enxerga o próprio negócio');
select is((select count(*)::int from public.messages), 1, 'A lê a mensagem que recebeu');
select throws_ok($$ insert into public.messages (sender_id, recipient_id, sender_business_id, recipient_business_id, body)
  values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000b','x') $$,
  '42501', null, 'escrita direta em mensagens é bloqueada');
select throws_ok($$ insert into public.partnerships (requester_id, recipient_id, requester_business_id, recipient_business_id, type, intro)
  values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000b','outro','apresentação longa') $$,
  '42501', null, 'escrita direta em parcerias é bloqueada');
select is((select count(*)::int from public.subscriptions), 0, 'A não lê assinaturas alheias');

-- Age como o usuário B: não lê o negócio de A
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.businesses where owner_id = '00000000-0000-0000-0000-00000000000a'), 0, 'B não lê contatos do negócio de A');

select * from finish();
rollback;
