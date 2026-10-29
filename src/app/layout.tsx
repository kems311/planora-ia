import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Planora-IA', template: '%s · Planora-IA' },
  description: 'Copilote de planning de chantier pour artisans et PME du bâtiment.',
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#102a43' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>
}
