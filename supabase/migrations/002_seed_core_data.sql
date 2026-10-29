-- Date initiale: colectii si categorii de baza
insert into public.song_collections (name, short_code, description, source_type)
values
  ('Tineri', 'TINERI', 'Lista de cantari pentru tineri', 'pptx'),
  ('Cantarile Evangheliei - carte rosie', 'CE_ROSIE', 'Colectia Cantarile Evangheliei - carte rosie', 'manual'),
  ('Cantarile Evangheliei - carte neagra', 'CE_NEAGRA', 'Colectia Cantarile Evangheliei - carte neagra', 'manual')
on conflict (short_code) do update set
  name = excluded.name,
  description = excluded.description,
  source_type = excluded.source_type;

insert into public.categories (name, slug)
values
  ('Paste', 'paste'),
  ('Nasterea Domnului', 'nasterea-domnului'),
  ('Botez', 'botez'),
  ('Cina Domnului', 'cina-domnului'),
  ('Sarbatoarea multumirii', 'sarbatoarea-multumirii'),
  ('Inmormantare', 'inmormantare'),
  ('Tineri', 'tineri'),
  ('Evanghelizare', 'evanghelizare'),
  ('Inchinare', 'inchinare'),
  ('Rugaciune', 'rugaciune'),
  ('Chemare la pocainta', 'chemare-la-pocainta'),
  ('Credinta', 'credinta'),
  ('Mangaiere', 'mangaiere')
on conflict (slug) do update set name = excluded.name;
