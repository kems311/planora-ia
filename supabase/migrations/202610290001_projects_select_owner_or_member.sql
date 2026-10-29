-- Le propriétaire doit pouvoir relire le chantier qu’il vient de créer : le déclencheur qui l’ajoute
-- à project_members s’exécute dans la même requête et n’est pas encore visible par la règle.
drop policy if exists projects_member_select on public.projects;
create policy projects_member_select on public.projects for select to authenticated
using (owner_id = (select auth.uid()) or public.is_project_member(id));
