import { Suspense } from 'react'
import { AppShell } from '@/components/app-shell'

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppShell>
      <Suspense
        fallback={
          <section
            className="card card-pad"
            role="status"
            aria-live="polite"
          >
            Chargement de vos chantiers…
          </section>
        }
      >
        {children}
      </Suspense>
    </AppShell>
  )
}