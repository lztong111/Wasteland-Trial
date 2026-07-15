import type { FullConfig } from '@playwright/test';
import { createServer } from 'vite';

export default async function globalSetup(_config: FullConfig) {
    // 在测试进程内管理 Vite，避免 Windows 无法回收 webServer 子进程。
    const server = await createServer({
        server: {
            host: '127.0.0.1',
            port: 4173,
            strictPort: true
        }
    });
    await server.listen();

    return async () => {
        await server.close();
    };
}
