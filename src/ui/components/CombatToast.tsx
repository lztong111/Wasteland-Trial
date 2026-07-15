import type { FeedbackKind } from '../feedback';

interface CombatToastProps {
    text: string;
    kind: FeedbackKind;
}

export function CombatToast({ text, kind }: CombatToastProps) {
    return (
        <div
            className={`combat-toast combat-toast--${kind}`}
            role="status"
            aria-live="polite"
        >
            {text}
        </div>
    );
}
