-- Dev seed: shared place rows only (visits are created in-app after sign-in).

insert into public.restaurant_places (id, name, cuisine, cuisine2, is_fusion, city)
values
  ('b1000001-0000-4000-8000-000000000001', 'North Beach Pizza', 'Italian', '', false, 'San Francisco'),
  ('b1000001-0000-4000-8000-000000000002', 'Demo Dumpling House', 'Chinese', 'Taiwanese', true, 'Demo City'),
  ('b1000001-0000-4000-8000-000000000003', 'Corner Burger', 'American', '', false, 'Demo City')
on conflict (id) do nothing;

insert into public.cafe_places (id, name, city)
values
  ('c2000001-0000-4000-8000-000000000001', 'Morning Owl Coffee', 'Demo City'),
  ('c2000001-0000-4000-8000-000000000002', 'Matcha Lane', 'San Francisco')
on conflict (id) do nothing;
