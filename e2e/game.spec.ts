import { expect, test, type Page } from '@playwright/test';

async function confirmWelcome(page: Page) {
    const welcome = page.getByRole('dialog', { name: '准备进入遗迹' });
    await expect(welcome).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '开始试炼' }).click();
}

test('玩家可以进入游戏、获得经验、打开背包并恢复存档', async ({ page }) => {
    const browserErrors: string[] = [];
    page.on('pageerror', error => browserErrors.push(error.message));

    await page.goto('/');
    await expect(page.getByText('正在加载物理引擎')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('#renderCanvas')).toBeVisible();
    await expect(page.getByRole('dialog', { name: '准备进入遗迹' })).toBeVisible();
    await expect(page.getByText('战斗与闪避')).toBeVisible();
    await expect(page.getByText('目标与波次')).toBeVisible();
    await expect(page.getByText('成长与轮次')).toBeVisible();
    await page.getByRole('button', { name: '开始试炼' }).click();
    await expect(page.getByLabel('操作说明')).toBeVisible();
    await expect(page.getByLabel('当前目标')).toContainText('清除遗迹守卫');
    await expect(page.getByLabel('当前目标')).toContainText('0 / 3');

    await page.locator('#renderCanvas').focus();
    await page.keyboard.press('KeyE');
    await expect(page.getByText('经验', { exact: true })).toBeVisible();
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

test('胜利结算后进入下一轮并写入存档', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('正在加载物理引擎')).toHaveCount(0, { timeout: 15_000 });
    await confirmWelcome(page);

    // 触发一次自动保存，复用产品生成的合法 RPG 存档，只替换关卡进度。
    await page.locator('#renderCanvas').focus();
    await page.keyboard.press('KeyE');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('gm.save.v3')))
        .not.toBeNull();
    await page.addInitScript(() => {
        // 页面卸载会先保存当前状态，因此在下一页初始化、应用读档之前注入一次胜利进度。
        if (sessionStorage.getItem('e2e.victorySeeded')) return;
        const storageKey = 'gm.save.v3';
        const raw = localStorage.getItem(storageKey);
        if (!raw) throw new Error('测试存档尚未生成。');
        const save = JSON.parse(raw);
        save.progress = {
            phase: 'victory',
            trialNumber: 1,
            defeatedGuardians: 6,
            chestOpened: true,
            shrineActivated: true,
            shrineReadyAt: 0,
            victoryAcknowledged: false
        };
        localStorage.setItem(storageKey, JSON.stringify(save));
        sessionStorage.setItem('e2e.victorySeeded', 'true');
    });

    await page.reload();
    await confirmWelcome(page);
    await expect(page.getByRole('dialog', { name: '试炼完成' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('当前目标')).toContainText('遗迹试炼完成');
    await page.getByRole('button', { name: '进入下一轮' }).click();
    await expect(page.getByRole('dialog', { name: '试炼完成' })).toHaveCount(0);

    await expect.poll(() => page.evaluate(() => {
        const raw = localStorage.getItem('gm.save.v3');
        if (!raw) return null;
        const progress = JSON.parse(raw).progress;
        return progress ? `${progress.trialNumber}:${progress.phase}:${progress.defeatedGuardians}` : null;
    })).toBe('2:guardians:0');
    await page.reload();
    await confirmWelcome(page);
    await expect(page.getByRole('dialog', { name: '试炼完成' })).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByLabel('当前目标')).toContainText('第 2 轮');
    await expect(page.getByLabel('当前目标')).toContainText('0 / 3');
});

test('持续按下 WASD 时渲染循环保持响应', async ({ page }) => {
    test.setTimeout(20_000);
    const browserErrors: string[] = [];
    page.on('pageerror', error => browserErrors.push(error.message));

    await page.goto('/');
    await expect(page.getByText('正在加载物理引擎')).toHaveCount(0, { timeout: 15_000 });
    await confirmWelcome(page);
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

    // 无头 Chromium 的软件 WebGL 帧率会随机器负载波动，重点验证渲染循环没有停止。
    expect(await frameCountPromise).toBeGreaterThan(5);
    await expect(page.getByLabel('操作说明').or(page.getByLabel('展开操作说明'))).toBeVisible();
    expect(browserErrors).toEqual([]);
});

test('鼠标左右键会触发明确的攻击反馈', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('正在加载物理引擎')).toHaveCount(0, { timeout: 15_000 });
    await confirmWelcome(page);

    const canvas = page.locator('#renderCanvas');
    await canvas.evaluate(element => {
        element.addEventListener('pointerdown', () => element.setAttribute('data-pointerdown-seen', 'true'), { once: true });
    });
    await canvas.hover({ position: { x: 400, y: 300 } });
    await page.mouse.down({ button: 'left' });

    await expect(canvas).toHaveAttribute('data-pointerdown-seen', 'true');
    await expect(page.getByLabel('体力')).toHaveAttribute('aria-valuenow', '90');
    await expect(page.getByRole('status')).toContainText('轻击');
    await page.mouse.up({ button: 'left' });

    await page.mouse.down({ button: 'right' });
    await expect(page.getByRole('status')).toHaveText('远程射击');
    await page.mouse.up({ button: 'right' });
});

test('按下 Shift 会消耗体力并触发闪避反馈', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('正在加载物理引擎')).toHaveCount(0, { timeout: 15_000 });
    await confirmWelcome(page);

    const canvas = page.locator('#renderCanvas');
    await canvas.focus();
    // 等待至少一帧接地检测完成，避免在角色初始化瞬间消费输入。
    await page.waitForTimeout(250);
    await page.keyboard.press('ShiftLeft');

    await expect(page.getByRole('status')).toHaveText('闪避');
    await expect.poll(async () => Number(
        await page.getByLabel('体力').getAttribute('aria-valuenow')
    )).toBeLessThan(100);
});

test('按下 Q 会消耗体力并触发蓄力重击', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('正在加载物理引擎')).toHaveCount(0, { timeout: 15_000 });
    await confirmWelcome(page);

    await page.locator('#renderCanvas').focus();
    await page.keyboard.press('KeyQ');

    await expect(page.getByRole('status')).toHaveText('蓄力重击');
    await expect.poll(async () => Number(
        await page.getByLabel('体力').getAttribute('aria-valuenow')
    )).toBeLessThanOrEqual(75);
});

test('移动鼠标即可转动镜头并支持指针锁定', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('正在加载物理引擎')).toHaveCount(0, { timeout: 15_000 });
    await confirmWelcome(page);
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
