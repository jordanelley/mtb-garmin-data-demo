import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import gpxApi from './vite-plugin-gpx-api.js'

// https://vite.dev/config/
export default defineConfig({
  base: '/mtb-garmin-data-demo/',
  plugins: [react(), gpxApi()],
})
