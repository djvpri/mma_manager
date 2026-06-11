import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { THEME_STORAGE_KEY } from '@/lib/theme'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'MMA Manager',
  description: 'Kelola gym MMA dan bawa fighter-mu menuju juara',
}

// Set tema sebelum render pertama agar tidak ada flash dark→light.
const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light')document.documentElement.dataset.theme='light';}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-octagon-dark font-sans text-gray-100 antialiased">{children}</body>
    </html>
  )
}
