/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Vite 配置：
// - root 指向 packages/game，index.html 在那里
// - 开发服务器 --host 让局域网内的手机 APP（Capacitor 通过本地 IP 加载）也能访问，实现"Web 与 APP 同时访问"
// - 产物输出到 dist/，Capacitor 的 webDir 也指向 dist/
export default defineConfig({
  root: fileURLToPath(new URL('./packages/game', import.meta.url)),
  resolve: {
    alias: {
      '@game': fileURLToPath(new URL('./packages/game/src', import.meta.url)),
    },
  },
  server: {
    host: true,    // 监听所有网卡：手机/模拟器可经局域网 IP 访问
    port: 5173,
    strictPort: false,
    cors: true,
  },
  preview: {
    host: true,
    port: 4173,
    cors: true,
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
  },
});
