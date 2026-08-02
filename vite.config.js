import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Each Cirkle frontend gets its own pinned dev origin so the backend's CORS
    // allow-list can name it: 5173 consumer, 5174 organizer, 5175 admin.
    // NOTE: the backend must allow http://localhost:5175 or every call from
    // here fails CORS. That's a backend change — see the README.
    port: 5175,
    strictPort: true,
  },
})
