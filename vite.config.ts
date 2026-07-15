import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 保持构建配置精简，游戏模块由应用入口异步加载。
export default defineConfig({
  plugins: [react()],
  server: {
    // 监听所有网卡，便于服务器上通过公网 IP 访问。
    host: '0.0.0.0',
    port: 5173,
    // 允许用公网 IP / 域名访问，避免 Host 校验拦截。
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
})
