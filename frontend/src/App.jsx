import { NavLink, Route, Routes } from 'react-router-dom'
import StatusPage from './pages/StatusPage/StatusPage.jsx'
import CachePokemonPage from './pages/CachePokemonPage/CachePokemonPage.jsx'
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
          Cachear Pokémon
        </NavLink>
      </nav>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<StatusPage />} />
          <Route path="/cache" element={<CachePokemonPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
