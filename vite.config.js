import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// deploying to github pages
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/neuroflow-study-tracker/',
})
