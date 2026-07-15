interface InteractPromptProps {
    label: string;
}

export function InteractPromptBanner({ label }: InteractPromptProps) {
    return (
        <div className="interact-prompt" role="status" aria-live="polite">
            {label}
        </div>
    );
}
