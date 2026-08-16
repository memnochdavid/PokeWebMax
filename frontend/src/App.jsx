import { NavLink, Route, Routes } from 'react-router-dom'
import StatusPage from './pages/StatusPage/StatusPage.jsx'
import CacheAllPage from './pages/CacheAllPage/CacheAllPage.jsx'
import PokemonListPage from './pages/PokemonListPage/PokemonListPage.jsx'
import PokemonFichaPage from './pages/PokemonFichaPage/PokemonFichaPage.jsx'
import { LANGUAGES, useLanguage } from './contexts/LanguageContext.jsx'
import styles from './App.module.css'

const navLinkClassName = ({ isActive }) => (isActive ? styles.navActive : undefined)

function App() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className={styles.app}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.brandDot} />
          PokeWebMax
        </div>
        <div className={styles.links}>
          <NavLink to="/" end className={navLinkClassName}>
            Estado
          </NavLink>
          <NavLink to="/cache" className={navLinkClassName}>
            Cachear
          </NavLink>
          <NavLink to="/pokemon" className={navLinkClassName}>
            Pokémon
          </NavLink>
        </div>
        <div className={styles.langSwitch} role="group" aria-label="Idioma de los datos">
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
          <Route path="/" element={<StatusPage />} />
          <Route path="/cache" element={<CacheAllPage />} />
          <Route path="/pokemon" element={<PokemonListPage />} />
          <Route path="/ficha/:idOrName" element={<PokemonFichaPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
