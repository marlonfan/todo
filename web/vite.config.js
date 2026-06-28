import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function getPackageName(id) {
  const nodeModulePath = id.split('/node_modules/').pop()
  const [scopeOrName, packageName] = nodeModulePath.split('/')
  return scopeOrName?.startsWith('@') ? `${scopeOrName}/${packageName}` : scopeOrName
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          const packageName = getPackageName(id);
          if (['react', 'react-dom', 'scheduler', 'loose-envify', 'js-tokens'].includes(packageName)) {
            return 'vendor-react';
          }
          if (packageName === 'react-router' || packageName === 'react-router-dom') {
            return 'vendor-router';
          }
          if (packageName === '@tanstack/react-query' || packageName === '@tanstack/query-core') {
            return 'vendor-query';
          }
          if (packageName?.startsWith('@fullcalendar/') || packageName === 'rrule' || packageName === 'lunar-javascript') {
            return 'vendor-calendar';
          }
          if (packageName === 'vditor' || packageName === 'react-datepicker' || packageName === 'date-fns') {
            return 'vendor-editor';
          }
          if (packageName?.startsWith('@radix-ui/') || packageName === 'lucide-react') {
            return 'vendor-ui';
          }
          return 'vendor-core';
        },
      },
    },
  },
})
