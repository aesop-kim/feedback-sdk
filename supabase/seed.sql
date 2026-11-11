insert into public.projects (project_key, name, allowed_origins)
values (
  'lattice-demo',
  '래티스 주식회사',
  array['http://localhost:3001', 'http://127.0.0.1:3001']
)
on conflict (project_key) do update set allowed_origins = excluded.allowed_origins;
