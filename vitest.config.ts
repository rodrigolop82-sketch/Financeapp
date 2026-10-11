import { fileURLToPath } from 'url'
import { defineConfig } from 'vitest/config'

// Alias "@/" como en tsconfig, para probar rutas de app/api con mocks.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
})
