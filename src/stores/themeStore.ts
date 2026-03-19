import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

interface ThemeStore {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  if (theme === 'light') {
    html.classList.add('light')
    html.classList.remove('dark')
  } else {
    html.classList.remove('light')
    html.classList.add('dark')
  }
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      toggleTheme: () =>
        set((s) => {
          const next: Theme = s.theme === 'dark' ? 'light' : 'dark'
          applyTheme(next)
          return { theme: next }
        }),
    }),
    {
      name: 'turbine-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    }
  )
)
