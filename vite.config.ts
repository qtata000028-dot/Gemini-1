import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // Define process.env.API_KEY global for client-side usage
      // This replaces `process.env.API_KEY` in your code with the actual string value
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || '')
    },
    build: {
      outDir: 'dist',
    }
  }
})