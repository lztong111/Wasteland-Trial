import { Action } from '../../systems/InputManager';
import type { PointerEvent } from 'react';

interface MobileControlsProps {
    onAction: (action: Action, isDown: boolean) => void;
}

export function MobileControls({ onAction }: MobileControlsProps) {
    const bind = (action: Action) => ({
        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            onAction(action, true);
        },
        onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
            event.preventDefault();
            onAction(action, false);
        },
        onPointerCancel: () => onAction(action, false),
        onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) return;
            onAction(action, false);
        }
    });

    return (
        <div className="mobile-controls" aria-label="触控操作">
            <div className="mobile-controls__dpad">
                <button type="button" aria-label="向前移动" {...bind(Action.FORWARD)}>上</button>
                <button type="button" aria-label="向左移动" {...bind(Action.LEFT)}>左</button>
                <button type="button" aria-label="向后移动" {...bind(Action.BACKWARD)}>下</button>
                <button type="button" aria-label="向右移动" {...bind(Action.RIGHT)}>右</button>
            </div>
            <div className="mobile-controls__actions">
                <button type="button" aria-label="闪避" {...bind(Action.DODGE)}>闪避</button>
                <button type="button" aria-label="近战攻击" {...bind(Action.ATTACK_MELEE)}>轻击</button>
                <button type="button" aria-label="蓄力重击" {...bind(Action.ATTACK_HEAVY)}>重击</button>
                <button type="button" aria-label="远程攻击" {...bind(Action.ATTACK_RANGED)}>远程</button>
            </div>
        </div>
    );
}
