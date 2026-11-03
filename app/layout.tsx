import { Geist } from 'next/font/google'
import { Providers } from '@/components/providers'
import type { Metadata, Viewport } from 'next'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: { default: 'JobLinked — Local Talent. Local Opportunities.', template: '%s | JobLinked' },
  description: 'Discover local job opportunities, connect with verified sample employers, and track applications in Santa Maria, Bulacan. An independent frontend demonstration, not an official LGU service.',
  generator: 'v0.app',
  icons: { icon: { url: '/icon.svg', type: 'image/svg+xml' } },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#12325B',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={geist.variable} data-scroll-behavior="smooth">
      <body className="antialiased">
        <a href="#main-content" className="fixed -top-20 left-4 z-50 rounded-lg bg-primary px-5 py-3 text-white focus:top-4">Skip to content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
