import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'MMA Manager',
  description: 'Kelola gym MMA dan bawa fighter-mu menuju juara',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="bg-octagon-dark font-sans text-gray-100 antialiased">{children}</body>
    </html>
  )
}
