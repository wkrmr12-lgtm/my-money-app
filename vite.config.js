
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// MyMoney GitHub Pages 설정
export default defineConfig({
  base: '/my-money-app/',
  plugins: [react()],
})
