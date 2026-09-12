import { useCallback, useEffect, useState } from 'react'

const THEME_KEY = 'app-theme'
const LIGHT_RESET_KEY = 'theme-reset-light-v1'

export const resolveInitialTheme = storage => {
  if (!storage.getItem(LIGHT_RESET_KEY)) {
    storage.setItem(THEME_KEY, 'light')
    storage.setItem(LIGHT_RESET_KEY, 'true')
    return 'light'
  }
  return storage.getItem(THEME_KEY) || 'light'
}

export const applyBodyTheme = (body, theme) => {
  if (theme === 'light') body.classList.add('light-theme')
  else body.classList.remove('light-theme')
}

export const nextTheme = theme => theme === 'dark' ? 'light' : 'dark'

export const useAppTheme = () => {
  const [theme, setTheme] = useState(() => resolveInitialTheme(localStorage))

  useEffect(() => {
    applyBodyTheme(document.body, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(current => {
      const next = nextTheme(current)
      localStorage.setItem(THEME_KEY, next)
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
