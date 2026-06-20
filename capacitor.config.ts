import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor 配置 —— 单机离线模式
//
// 运行模型：
// - 生产：npm run app:build 后，Web 构建产物被拷进 APP，APP 完全离线运行，存档存本地沙箱，不依赖任何服务器。
// - 开发调试（可选）：设置环境变量 PAL3_DEV_SERVER_URL 指向本机 Vite（如 http://192.168.x.x:5173），
//   让 APP 连热更新服务器，和浏览器看同一份代码。不设置时默认离线运行打包产物。
//
// 存档存储：Web 端用 IndexedDB；APP 端因 WebView 同源策略也走 IndexedDB（Capacitor WebView 支持），
// 存档随 APP 安装目录保留，卸载才删除。

const devUrl = process.env.PAL3_DEV_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.pal3lite.app',
  appName: '仙剑3-ARPG',
  webDir: 'dist',
  bundledWebRuntime: false,
  // 仅在显式设置开发服务器时启用，否则 undefined = 离线运行打包产物
  ...(devUrl
    ? {
        server: {
          url: devUrl,
          cleartext: true,
        },
        android: { allowMixedContent: true },
      }
    : {}),
};

export default config;
