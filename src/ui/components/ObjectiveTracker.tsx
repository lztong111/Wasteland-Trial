import type { ObjectiveView } from '../../data/GameProgressManager';

interface ObjectiveTrackerProps {
    objective: ObjectiveView;
    trialNumber: number;
}

export function ObjectiveTracker({ objective, trialNumber }: ObjectiveTrackerProps) {
    const hasProgress = objective.current !== undefined && objective.target !== undefined;
    return (
        <section
            className={`ui-panel objective-tracker${objective.completed ? ' objective-tracker--complete' : ''}`}
            aria-label="当前目标"
        >
            <div className="objective-tracker__eyebrow">遗迹试炼 · 第 {trialNumber} 轮</div>
            <div className="objective-tracker__title">
                <span aria-hidden="true">{objective.completed ? '✓' : '◆'}</span>
                {objective.title}
                {hasProgress && (
                    <strong>{objective.current} / {objective.target}</strong>
                )}
            </div>
            <p>{objective.description}</p>
        </section>
    );
}
