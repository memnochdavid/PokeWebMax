import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // Vite 5+ bloquea por defecto cualquier Host header que no reconozca (protección
    // anti DNS-rebinding) — hace falta listar explícitamente los dominios de túnel.
    // Las entradas con "." al principio permiten cualquier subdominio, así que sirve
    // aunque ngrok genere un subdominio aleatorio nuevo cada vez que se reinicia (plan
    // gratuito, sin dominio reservado).
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io', '.ngrok.app'],
    proxy: {
      '/api': 'http://backend:8000',
    },
  },
})
