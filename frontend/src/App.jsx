import { NavLink, Route, Routes } from 'react-router-dom'
import StatusPage from './pages/StatusPage/StatusPage.jsx'
import CacheAllPage from './pages/CacheAllPage/CacheAllPage.jsx'
import PokemonListPage from './pages/PokemonListPage/PokemonListPage.jsx'
import styles from './App.module.css'

const navLinkClassName = ({ isActive }) => (isActive ? styles.navActive : undefined)

function App() {
  return (
    <div className={styles.app}>
      <nav className={styles.nav}>
        <NavLink to="/" end className={navLinkClassName}>
          Estado
        </NavLink>
        <NavLink to="/cache" className={navLinkClassName}>
          Cachear
        </NavLink>
        <NavLink to="/pokemon" className={navLinkClassName}>
          Pokémon
        </NavLink>
      </nav>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<StatusPage />} />
          <Route path="/cache" element={<CacheAllPage />} />
          <Route path="/pokemon" element={<PokemonListPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
