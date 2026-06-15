import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { THEME_STORAGE_KEY } from '@/lib/theme'
import RegisterServiceWorker from '@/components/pwa/RegisterServiceWorker'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'MMA Manager',
  description: 'Kelola gym MMA dan bawa fighter-mu menuju juara',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MMA Manager',
  },
}

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
}

// Set tema sebelum render pertama agar tidak ada flash dark→light.
const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light')document.documentElement.dataset.theme='light';}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-octagon-dark font-sans text-gray-100 antialiased">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  )
}
