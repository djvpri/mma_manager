'use client'

import { useEffect, useState } from 'react'
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme'
import { IconSun, IconMoon } from './nav-icons'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(getStoredTheme())
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-octagon-amber ${className}`}
    >
      {theme === 'dark' ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
      {theme === 'dark' ? 'Tema Terang' : 'Tema Gelap'}
    </button>
  )
}
