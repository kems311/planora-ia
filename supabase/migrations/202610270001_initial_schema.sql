-- Planora-IA — schéma initial, sécurité RLS et stockage photos.
create extension if not exists pgcrypto;

create type public.project_role as enum ('owner', 'team', 'client');
create type public.task_status as enum ('a_faire', 'en_cours', 'bloque', 'termine');
create type public.event_type as enum ('avancement', 'retard', 'bloque', 'planning');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom_complet text,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  nom text not null check (char_length(nom) between 2 and 120),
  adresse text,
  date_debut date not null,
  client_nom text,
  date_fin_prevue date,
  avancement_global smallint not null default 0 check (avancement_global between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.project_role not null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.tasks(id) on delete set null,
  nom text not null check (char_length(nom) between 1 and 180),
  duree_jours integer not null default 1 check (duree_jours >= 0),
  responsable_id uuid references public.profiles(id) on delete set null,
  statut public.task_status not null default 'a_faire',
  avancement smallint not null default 0 check (avancement between 0 and 100),
  date_debut_calculee date,
  date_fin_calculee date,
  est_critique boolean not null default false,
  marge_jours integer not null default 0 check (marge_jours >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_dependencies (
  task_id uuid not null references public.tasks(id) on delete cascade,
  predecessor_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, predecessor_id),
  check (task_id <> predecessor_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  type public.event_type not null,
  jours_retard integer check (jours_retard is null or jours_retard > 0),
  motif text,
  photo_url text,
  donnees jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  actif boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index projects_owner_idx on public.projects(owner_id);
create index project_members_user_idx on public.project_members(user_id, project_id);
create index tasks_project_idx on public.tasks(project_id);
create index tasks_responsable_idx on public.tasks(responsable_id);
create index events_task_created_idx on public.events(task_id, created_at desc);
create index share_links_token_active_idx on public.share_links(token) where actif;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, email, nom_complet)
  values(new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'nom_complet');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Fonctions SECURITY DEFINER sans récursion RLS.
create or replace function public.is_project_member(target_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = target_project_id and pm.user_id = (select auth.uid())
  );
$$;
create or replace function public.is_project_owner(target_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = target_project_id
      and pm.user_id = (select auth.uid()) and pm.role = 'owner'
  );
$$;
create or replace function public.task_project(target_task_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select project_id from public.tasks where id = target_task_id;
$$;

create or replace function public.add_owner_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_members(project_id, user_id, role)
  values(new.id, new.owner_id, 'owner');
  return new;
end;
$$;
create trigger project_owner_membership after insert on public.projects
for each row execute procedure public.add_owner_membership();

-- Barrière SQL contre les boucles, indépendante de l’interface.
create or replace function public.prevent_dependency_cycle()
returns trigger language plpgsql set search_path = '' as $$
declare task_project_id uuid; predecessor_project_id uuid;
begin
  select project_id into task_project_id from public.tasks where id = new.task_id;
  select project_id into predecessor_project_id from public.tasks where id = new.predecessor_id;
  if task_project_id is null or predecessor_project_id is null or task_project_id <> predecessor_project_id then
    raise exception 'Les deux tâches doivent appartenir au même chantier.';
  end if;
  if exists (
    with recursive successors(id) as (
      select td.task_id from public.task_dependencies td where td.predecessor_id = new.task_id
      union
      select td.task_id from public.task_dependencies td join successors s on td.predecessor_id = s.id
    ) select 1 from successors where id = new.predecessor_id
  ) then
    raise exception 'Dépendance refusée : boucle détectée.';
  end if;
  return new;
end;
$$;
create trigger dependency_cycle_guard before insert or update on public.task_dependencies
for each row execute procedure public.prevent_dependency_cycle();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.events enable row level security;
alter table public.share_links enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy profiles_project_colleague_select on public.profiles for select to authenticated
using (exists (
  select 1 from public.project_members mine join public.project_members theirs using(project_id)
  where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
));
create policy profiles_self_update on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy projects_member_select on public.projects for select to authenticated
using (public.is_project_member(id));
create policy projects_create on public.projects for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy projects_owner_update on public.projects for update to authenticated
using (public.is_project_owner(id)) with check (public.is_project_owner(id));
create policy projects_owner_delete on public.projects for delete to authenticated
using (public.is_project_owner(id));

create policy members_member_select on public.project_members for select to authenticated
using (public.is_project_member(project_id));
create policy members_owner_insert on public.project_members for insert to authenticated
with check (public.is_project_owner(project_id));
create policy members_owner_update on public.project_members for update to authenticated
using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
create policy members_owner_delete on public.project_members for delete to authenticated
using (public.is_project_owner(project_id) and role <> 'owner');

create policy tasks_member_select on public.tasks for select to authenticated
using (public.is_project_member(project_id));
create policy tasks_owner_insert on public.tasks for insert to authenticated
with check (public.is_project_owner(project_id));
create policy tasks_owner_update on public.tasks for update to authenticated
using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
create policy tasks_assignee_update on public.tasks for update to authenticated
using (public.is_project_member(project_id) and responsable_id = (select auth.uid()))
with check (public.is_project_member(project_id) and responsable_id = (select auth.uid()));
create policy tasks_owner_delete on public.tasks for delete to authenticated
using (public.is_project_owner(project_id));

create policy dependencies_member_select on public.task_dependencies for select to authenticated
using (public.is_project_member(public.task_project(task_id)));
create policy dependencies_owner_insert on public.task_dependencies for insert to authenticated
with check (public.is_project_owner(public.task_project(task_id)));
create policy dependencies_owner_delete on public.task_dependencies for delete to authenticated
using (public.is_project_owner(public.task_project(task_id)));

create policy events_member_select on public.events for select to authenticated
using (public.is_project_member(public.task_project(task_id)));
create policy events_member_insert on public.events for insert to authenticated
with check (
  user_id = (select auth.uid()) and public.is_project_member(public.task_project(task_id))
);

create policy links_member_select on public.share_links for select to authenticated
using (public.is_project_member(project_id));
create policy links_owner_insert on public.share_links for insert to authenticated
with check (public.is_project_owner(project_id) and created_by = (select auth.uid()));
create policy links_owner_update on public.share_links for update to authenticated
using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
create policy links_owner_delete on public.share_links for delete to authenticated
using (public.is_project_owner(project_id));

-- Accès client uniquement par fonction RPC et token actif : aucune policy anon sur les tables.
create or replace function public.get_shared_project(link_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'project', jsonb_build_object(
      'id', p.id, 'nom', p.nom, 'adresse', p.adresse, 'date_debut', p.date_debut,
      'client_nom', p.client_nom, 'date_fin_prevue', p.date_fin_prevue,
      'avancement_global', p.avancement_global
    ),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object(
      'id', t.id, 'nom', t.nom, 'statut', t.statut, 'avancement', t.avancement,
      'date_debut_calculee', t.date_debut_calculee, 'date_fin_calculee', t.date_fin_calculee,
      'est_critique', t.est_critique
    ) order by t.date_debut_calculee, t.created_at) from public.tasks t where t.project_id = p.id), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('photo_url', e.photo_url, 'created_at', e.created_at))
      from public.events e join public.tasks t on t.id = e.task_id
      where t.project_id = p.id and e.photo_url is not null), '[]'::jsonb)
  )
  from public.share_links sl join public.projects p on p.id = sl.project_id
  where sl.token = link_token and sl.actif = true limit 1;
$$;
grant execute on function public.get_shared_project(text) to anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('chantier-photos', 'chantier-photos', false, 5242880,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

create policy photos_member_read on storage.objects for select to authenticated
using (bucket_id = 'chantier-photos' and public.is_project_member(((storage.foldername(name))[1])::uuid));
create policy photos_member_upload on storage.objects for insert to authenticated
with check (bucket_id = 'chantier-photos' and public.is_project_member(((storage.foldername(name))[1])::uuid));
create policy photos_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'chantier-photos' and public.is_project_owner(((storage.foldername(name))[1])::uuid));
