import { expect, test } from '@playwright/test';

test('玩家可以进入游戏、获得经验、打开背包并恢复存档', async ({ page }) => {
    const browserErrors: string[] = [];
    page.on('pageerror', error => browserErrors.push(error.message));

    await page.goto('/');
    await expect(page.getByText('正在加载物理引擎')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('#renderCanvas')).toBeVisible();
    await expect(page.getByLabel('操作说明')).toBeVisible();

    await page.locator('#renderCanvas').focus();
    await page.keyboard.press('KeyE');
    await expect(page.getByText('经验')).toBeVisible();
    await expect(page.getByLabel('经验')).toHaveAttribute('aria-valuenow', '10');

    await page.keyboard.press('KeyI');
    await expect(page.getByRole('heading', { name: '背包' })).toBeVisible();
    await page.keyboard.press('KeyI');
    await expect(page.getByRole('heading', { name: '背包' })).toHaveCount(0);

    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.getByLabel('经验')).toHaveAttribute('aria-valuenow', '10', { timeout: 30_000 });
    expect(browserErrors).toEqual([]);
});

test('持续按下 WASD 时渲染循环保持响应', async ({ page }) => {
    test.setTimeout(20_000);
    const browserErrors: string[] = [];
    page.on('pageerror', error => browserErrors.push(error.message));

    await page.goto('/');
    await expect(page.getByText('正在加载物理引擎')).toHaveCount(0, { timeout: 15_000 });
    await page.locator('#renderCanvas').focus();

    const frameCountPromise = page.evaluate(() => new Promise<number>((resolve) => {
        let frameCount = 0;
        const startedAt = performance.now();
        const countFrame = () => {
            frameCount += 1;
            // 无头浏览器使用软件 WebGL，延长观察窗口以区分性能波动和真正的渲染中断。
            if (performance.now() - startedAt >= 1_500) {
                resolve(frameCount);
                return;
            }
            requestAnimationFrame(countFrame);
        };
        requestAnimationFrame(countFrame);
    }));

    for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
        await page.keyboard.down(key);
        await page.waitForTimeout(180);
        await page.keyboard.up(key);
    }

    expect(await frameCountPromise).toBeGreaterThan(10);
    await expect(page.getByLabel('操作说明').or(page.getByLabel('展开操作说明'))).toBeVisible();
    expect(browserErrors).toEqual([]);
});

test('鼠标左右键会触发明确的攻击反馈', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('正在加载物理引擎')).toHaveCount(0, { timeout: 15_000 });

    const canvas = page.locator('#renderCanvas');
    await canvas.evaluate(element => {
        element.addEventListener('pointerdown', () => element.setAttribute('data-pointerdown-seen', 'true'), { once: true });
    });
    await canvas.hover({ position: { x: 400, y: 300 } });
    await page.mouse.down({ button: 'left' });

    await expect(canvas).toHaveAttribute('data-pointerdown-seen', 'true');
    await expect(page.getByLabel('体力')).toHaveAttribute('aria-valuenow', '90');
    await expect(page.getByRole('status')).toContainText('近战');
    await page.mouse.up({ button: 'left' });

    await page.mouse.down({ button: 'right' });
    await expect(page.getByRole('status')).toHaveText('远程射击');
    await page.mouse.up({ button: 'right' });
});

test('移动鼠标即可转动镜头并支持指针锁定', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('正在加载物理引擎')).toHaveCount(0, { timeout: 15_000 });
    const canvas = page.locator('#renderCanvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const initialAlpha = await canvas.getAttribute('data-camera-alpha');

    await page.mouse.move(box!.x + 360, box!.y + 260);
    await page.mouse.move(box!.x + 520, box!.y + 260, { steps: 5 });

    await expect(canvas).not.toHaveAttribute('data-camera-alpha', initialAlpha ?? '');

    await page.mouse.down({ button: 'middle' });
    await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id ?? null))
        .toBe('renderCanvas');
    await page.mouse.up({ button: 'middle' });
    // 无头 Chromium 的页面级按键无法触发浏览器外壳处理的 Esc，直接验证标准释放接口。
    await page.evaluate(() => document.exitPointerLock());
    await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id ?? null))
        .toBeNull();
});
