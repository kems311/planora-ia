# Planora-IA

*Copilote de planning de chantier pour artisans et petites entreprises du bâtiment.*

Planora-IA is a mobile-first web app for small construction businesses. When a delay is reported on site, the schedule is recomputed automatically with the critical path method, and the people concerned are notified with the old and new dates.

> **Status: working MVP, built as a personal project.** The core loop (plan, report a delay, preview the impact, recompute, notify) works end to end. Some screens are still missing, see the [roadmap](#roadmap).

## What works today

- **Authentication**: e-mail and password (Supabase Auth, server-side sessions).
- **Projects and tasks**: finish-to-start dependencies, milestones (duration 0) and a responsible person per task.
- **Cycle protection**: a dependency that would create a loop is refused, both in the TypeScript engine and by a PostgreSQL trigger.
- **Scheduling engine** (isolated, unit-tested module): topological sort, forward pass (earliest dates), backward pass (latest dates), total float and critical path. Weekends and French public holidays are excluded.
- **Delay reporting**: +N working days on a task, with a reason and an optional photo. Before anything is saved, the app shows a **before / after preview**: the tasks whose dates change and the new project end date.
- **Notifications**: after a confirmed delay, e-mails (via Resend) list the old and new dates for the project owner and for each person whose task moves.
- **Gantt view**: bars, dependency arrows, milestones, critical tasks in red, week / month zoom.
- **Security**: Row Level Security on every table, a private photo bucket (images only, 5 MB) and a service-role key that is only used in server code, after explicit permission checks.

## Worked example

Four tasks, project starting on Monday 26 October 2026: A (2 d) → B (3 d) → D (1 d), and A → C (1 d) → D.

| Task | Early start | Early finish | Float (working days) | Critical |
|---|---|---|---|---|
| A | Mon 26 Oct | Tue 27 Oct | 0 | yes |
| B | Wed 28 Oct | Fri 30 Oct | 0 | yes |
| C | Wed 28 Oct | Wed 28 Oct | 2 | no |
| D | Mon 2 Nov | Mon 2 Nov | 0 | yes |

The critical path is A-B-D and the project ends on Monday 2 November. Reporting **+2 working days on B** moves B's end to Tue 3 Nov and D to Wed 4 Nov: the project end slips by 2 working days and C is untouched. This case is covered by the unit tests.

## How the engine works

The module in `src/lib/planning/` has no dependency on React or Supabase.

- `engine.ts`: topological sort (cycle detection), forward pass, backward pass, float and critical path.
- `date-utils.ts` and `french-calendar.ts`: working-day arithmetic and French public holidays.
- `delay-preview.ts`: simulates a delay by lengthening one task, running the engine twice and comparing the two schedules. It writes nothing.

Conventions: a 1-day task starts and finishes on the same working day; a finish-to-start link starts the successor on the next working day; a task is critical when its total float is 0.

## Tech stack

Next.js (App Router), React, TypeScript, Tailwind CSS and CSS Modules, Supabase (Auth, PostgreSQL, Row Level Security, Storage), Zod, Vitest, Resend.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Never expose it to the browser |
| `RESEND_API_KEY` | Optional. Enables e-mail notifications |
| `EMAIL_FROM`, `APP_URL` | Optional. Sender address and public URL used in e-mails |

The database schema, security policies and the private storage bucket are in `supabase/migrations/`. With the Supabase CLI: `supabase link --project-ref YOUR_REF`, then `supabase db push`.

## Tests

```bash
npm test        # Vitest: engine, Gantt layout, delay preview, e-mail content
npm run lint
npm run build
```

## Known limitations

- A reported delay lengthens the task's duration for good (the schema has no separate lag column). The details of each delay are kept in the event history.
- Only French national public holidays are handled, not regional ones.
- The task form accepts one predecessor per task; the engine and the database support several.
- Photos currently go through a server action (compressed in the browser first). A direct upload to storage is planned for hosting platforms with request-size limits.

## Roadmap

- "Today's tasks" mobile view with progress / delay / blocked buttons.
- Read-only client page through a private, revocable link.
- Activity tab with photos, and the Gantt tab wired into the project page.
- CSV import of tasks.
- Merge the two scheduling modules (`planning` and `gantt-planning`) into one.
