import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Fixed port + strict: avoids silent bump to 3005 while 3000 still runs an old Vite — wrong tab = wrong bundle.
  server: {
    port: 5173,
    strictPort: true,
    historyApiFallback: true,
  },
})
