import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// The API is proxied through the Vite dev server so the httpOnly auth cookie
// issued by the backend is same-origin with the SPA (no CORS / SameSite=None needed).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'https://localhost:7082'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          // The local ASP.NET dev certificate is self-signed.
          secure: false,
        },
      },
    },
    preview: {
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true, secure: false },
      },
    },
  }
})
