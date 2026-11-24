import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `npm start` serves the built app on hosts like Render; allow their domain.
  preview: { allowedHosts: ['.onrender.com'] },
})
