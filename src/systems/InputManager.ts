export enum Action {
    FORWARD,
    BACKWARD,
    LEFT,
    RIGHT,
    JUMP,
    ATTACK_MELEE,
    ATTACK_RANGED,
    INTERACT,
    DODGE,
    ATTACK_HEAVY
}

export class InputManager {
    private readonly inputMap = new Map<Action, boolean>();
    private readonly pressedActions = new Set<Action>();

    public constructor(private readonly canvas: HTMLCanvasElement) {
        Object.values(Action).forEach(value => {
            if (typeof value === 'number') this.inputMap.set(value, false);
        });

        // 键盘事件限定在画布，避免玩家操作表单或背包时仍控制角色。
        this.canvas.tabIndex = 0;
        this.canvas.addEventListener('keydown', this.handleKeyDown);
        this.canvas.addEventListener('keyup', this.handleKeyUp);
        // Babylon 相机使用 Pointer Events，并会取消兼容鼠标事件，因此攻击也必须监听 pointerdown。
        this.canvas.addEventListener('pointerdown', this.handlePointerDown);
        this.canvas.addEventListener('contextmenu', this.preventContextMenu);
        window.addEventListener('pointerup', this.handlePointerUp);
        window.addEventListener('pointercancel', this.handlePointerUp);
        window.addEventListener('blur', this.reset);
    }

    public isActive(action: Action): boolean {
        return this.inputMap.get(action) ?? false;
    }

    public consumePress(action: Action): boolean {
        if (!this.pressedActions.has(action)) return false;
        this.pressedActions.delete(action);
        return true;
    }

    public clear(): void {
        this.reset();
    }

    public dispose(): void {
        this.canvas.removeEventListener('keydown', this.handleKeyDown);
        this.canvas.removeEventListener('keyup', this.handleKeyUp);
        this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
        this.canvas.removeEventListener('contextmenu', this.preventContextMenu);
        window.removeEventListener('pointerup', this.handlePointerUp);
        window.removeEventListener('pointercancel', this.handlePointerUp);
        window.removeEventListener('blur', this.reset);
        this.reset();
    }

    private readonly handleKeyDown = (event: KeyboardEvent): void => {
        const action = this.getKeyboardAction(event.code);
        if (action === null) return;
        if (event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
            event.preventDefault();
        }
        this.setAction(action, true);
    };

    private readonly handleKeyUp = (event: KeyboardEvent): void => {
        const action = this.getKeyboardAction(event.code);
        if (action !== null) this.setAction(action, false);
    };

    private readonly handlePointerDown = (event: PointerEvent): void => {
        this.canvas.focus();
        if (event.button === 0) this.setAction(Action.ATTACK_MELEE, true);
        if (event.button === 2) this.setAction(Action.ATTACK_RANGED, true);
    };

    private readonly handlePointerUp = (event: PointerEvent): void => {
        if (event.button === 0) this.setAction(Action.ATTACK_MELEE, false);
        if (event.button === 2) this.setAction(Action.ATTACK_RANGED, false);
    };

    private readonly preventContextMenu = (event: MouseEvent): void => event.preventDefault();

    private readonly reset = (): void => {
        this.inputMap.forEach((_value, action) => this.inputMap.set(action, false));
        this.pressedActions.clear();
    };

    private setAction(action: Action, isDown: boolean): void {
        if (isDown && !this.isActive(action)) this.pressedActions.add(action);
        this.inputMap.set(action, isDown);
    }

    private getKeyboardAction(code: string): Action | null {
        const actionByCode: Readonly<Record<string, Action>> = {
            KeyW: Action.FORWARD,
            KeyS: Action.BACKWARD,
            KeyA: Action.LEFT,
            KeyD: Action.RIGHT,
            Space: Action.JUMP,
            KeyE: Action.INTERACT,
            KeyQ: Action.ATTACK_HEAVY,
            ShiftLeft: Action.DODGE,
            ShiftRight: Action.DODGE
        };
        return actionByCode[code] ?? null;
    }
}
