import { defineConfig } from 'vite';

// 纯静态产物,部署 Vercel / Cloudflare Pages 零配置
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      // 可选依赖:仅在 APP(Capacitor)环境安装,web 端不打包
      external: ['@capacitor/preferences'],
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
