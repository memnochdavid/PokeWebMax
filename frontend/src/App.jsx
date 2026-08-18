import { NavLink, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CacheAllPage from './pages/CacheAllPage/CacheAllPage.jsx'
import PokemonListPage from './pages/PokemonListPage/PokemonListPage.jsx'
import PokemonFichaPage from './pages/PokemonFichaPage/PokemonFichaPage.jsx'
import ItemsListPage from './pages/ItemsListPage/ItemsListPage.jsx'
import ItemFichaPage from './pages/ItemFichaPage/ItemFichaPage.jsx'
import { LANGUAGES, useLanguage } from './contexts/LanguageContext.jsx'
import { useTheme } from './contexts/ThemeContext.jsx'
import styles from './App.module.css'

const navLinkClassName = ({ isActive }) => (isActive ? styles.navActive : undefined)

function App() {
  const { language, setLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()

  return (
    <div className={styles.app}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.brandDot} />
          {t('nav.brand')}
        </div>
        <div className={styles.links}>
          <NavLink to="/" end className={navLinkClassName}>
            {t('nav.pokemon')}
          </NavLink>
          <NavLink to="/objetos" className={navLinkClassName}>
            {t('nav.items')}
          </NavLink>
          <NavLink to="/cache" className={navLinkClassName}>
            {t('nav.cache')}
          </NavLink>
        </div>
        <div className={styles.langSwitch} role="group" aria-label={t('nav.dataLanguageAria')}>
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              className={`${styles.langButton} ${language === code ? styles.langActive : ''}`}
              onClick={() => setLanguage(code)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-label={t(theme === 'dark' ? 'nav.themeSwitchToLight' : 'nav.themeSwitchToDark')}
          title={t(theme === 'dark' ? 'nav.themeSwitchToLight' : 'nav.themeSwitchToDark')}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
            </svg>
          )}
        </button>
      </nav>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<PokemonListPage />} />
          <Route path="/objetos" element={<ItemsListPage />} />
          <Route path="/objetos/:idOrName" element={<ItemFichaPage />} />
          <Route path="/cache" element={<CacheAllPage />} />
          <Route path="/ficha/:idOrName" element={<PokemonFichaPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
