import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 保持构建配置精简，游戏模块由应用入口异步加载。
export default defineConfig({
  plugins: [react()],
})
