import { NavLink, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import StatusPage from './pages/StatusPage/StatusPage.jsx'
import CacheAllPage from './pages/CacheAllPage/CacheAllPage.jsx'
import PokemonListPage from './pages/PokemonListPage/PokemonListPage.jsx'
import PokemonFichaPage from './pages/PokemonFichaPage/PokemonFichaPage.jsx'
import { LANGUAGES, useLanguage } from './contexts/LanguageContext.jsx'
import styles from './App.module.css'

const navLinkClassName = ({ isActive }) => (isActive ? styles.navActive : undefined)

function App() {
  const { language, setLanguage } = useLanguage()
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
          <NavLink to="/cache" className={navLinkClassName}>
            {t('nav.cache')}
          </NavLink>
          <NavLink to="/status" className={navLinkClassName}>
            {t('nav.status')}
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
      </nav>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<PokemonListPage />} />
          <Route path="/cache" element={<CacheAllPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/ficha/:idOrName" element={<PokemonFichaPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
