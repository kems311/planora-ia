# Planora-IA — lot 1

Application mobile-first de planning de chantier. Ce lot s'arrête volontairement avant le Gantt et couvre :

- Authentification email/mot de passe avec Supabase SSR.
- Schéma PostgreSQL complet, RLS sur toutes les tables et stockage photo privé.
- Création et liste des chantiers.
- Création/suppression de tâches avec dépendance fin-début.
- Recalcul automatique des dates, marges et chemin critique.
- Week-ends et jours fériés français exclus.
- Protection anti-boucle dans le module TypeScript et dans PostgreSQL.

## Installation

```bash
cp .env.example .env.local
npm install
npm run dev
```

Renseignez dans `.env.local` l'URL et la clé publiable du projet Supabase.

## Supabase

Avec la CLI Supabase installée et un projet lié :

```bash
supabase link --project-ref VOTRE_REFERENCE
supabase db push
```

La migration `supabase/migrations/202610270001_initial_schema.sql` crée les tables, triggers, fonctions, politiques RLS, la RPC du futur lien client et le bucket privé `chantier-photos` limité à 5 Mo et aux images.

Pour un environnement local Supabase :

```bash
supabase start
supabase db reset
supabase test db
```

Dans **Authentication > URL Configuration**, ajoutez l'URL locale et l'URL Vercel. Si la confirmation email est active, l'inscription affiche un message demandant de vérifier la boîte mail.

## Vérifications

```bash
npm test
npm run lint
npm run build
```

## Moteur de planning

Le module isolé est dans `src/lib/planning/` :

- `engine.ts` : tri topologique, passe avant, passe arrière, marges, chemin critique.
- `date-utils.ts` : arithmétique en jours ouvrés.
- `french-calendar.ts` : calendrier français et jours fériés publics.
- `engine.test.ts` : tests week-end, dépendances, marge, jalons et cycles.

Convention : une tâche de durée 1 commence et finit le même jour ouvré ; une dépendance fin-début place le successeur au premier jour ouvré suivant la fin du prédécesseur. Une durée 0 représente un jalon.

## Sécurité

- Les pages serveur vérifient l'identité avec `getClaims()`.
- Le navigateur n'obtient jamais de clé `service_role`.
- RLS limite les lignes aux membres du chantier.
- Les opérations structurantes sont réservées au propriétaire ; un responsable peut mettre à jour sa tâche.
- La future vue client passera uniquement par la fonction RPC `get_shared_project(token)` ; aucune lecture anonyme directe des tables n'est autorisée.
- Les photos sont stockées dans un bucket privé avec politiques RLS.

## Suite après validation

Le Gantt, l'activité, le signalement avant/après, les notifications email, l'import CSV, « Mes tâches du jour » et la page client ne sont pas encore branchés, conformément à la demande d'attendre la validation avant le Gantt.
