import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // base 用相对路径：GitHub Pages 子路径（/WillowBlog/）与 Vercel 根路径都能直接跑
  base: './',
  build: {
    // supabase-js 体积较大，单 chunk 略超默认阈值，这里放宽提示
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
})
