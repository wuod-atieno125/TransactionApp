import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

const backendEnvDirectory = fileURLToPath(new URL('../server', import.meta.url))

export default defineConfig(({ mode }) => {
  const backendEnv = loadEnv(mode, backendEnvDirectory, 'PORT')
  const backendPort = backendEnv.PORT || '5000'

  return {
    plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
    server: {
      proxy: {
        '/api': {
          target:
            process.env.API_PROXY_TARGET || `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
