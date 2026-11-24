import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `npm start` serves the built app on Render; allow its domain and the custom domain.
  preview: { allowedHosts: ['.onrender.com', 'arc-vrf-playground.007575.xyz'] },
})
