export interface FloatTextItem {
    id: number;
    text: string;
    kind: 'damage' | 'xp';
    offsetX: number;
}

interface FloatTextsProps {
    items: readonly FloatTextItem[];
}

export function FloatTexts({ items }: FloatTextsProps) {
    if (items.length === 0) return null;

    return (
        <div className="float-texts" aria-hidden="true">
            {items.map(item => (
                <div
                    key={item.id}
                    className={`float-text float-text--${item.kind}`}
                    style={{ ['--float-x' as string]: `${item.offsetX}px` }}
                >
                    {item.text}
                </div>
            ))}
        </div>
    );
}
