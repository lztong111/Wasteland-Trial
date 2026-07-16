import { useEffect, useState } from 'react';

const DESKTOP_AUTO_COLLAPSE_MS = 8000;
const NARROW_AUTO_COLLAPSE_MS = 3500;
const NARROW_QUERY = '(max-width: 640px)';

function isNarrowViewport(): boolean {
    return typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches;
}

interface ControlsHintProps {
    forceExpanded?: boolean;
}

export function ControlsHint({ forceExpanded = false }: ControlsHintProps) {
    // 窄屏默认收起，避免首屏被大块帮助挡住；桌面仍先展开再自动收起。
    const [expanded, setExpanded] = useState(() => !isNarrowViewport());
    const isDev = import.meta.env.DEV;

    useEffect(() => {
        if (forceExpanded) {
            setExpanded(true);
            return undefined;
        }

        // 窄屏若用户未展开，不必再计时；已展开则更快收起。
        if (!expanded && isNarrowViewport()) return undefined;

        const delay = isNarrowViewport() ? NARROW_AUTO_COLLAPSE_MS : DESKTOP_AUTO_COLLAPSE_MS;
        const timer = window.setTimeout(() => setExpanded(false), delay);
        return () => window.clearTimeout(timer);
    }, [forceExpanded, expanded]);

    useEffect(() => {
        const media = window.matchMedia(NARROW_QUERY);
        const onChange = () => {
            // 切到窄屏时自动收起，桌面不强制展开以免打断用户。
            if (media.matches && !forceExpanded) setExpanded(false);
        };
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, [forceExpanded]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.code === 'KeyH' && !event.repeat) {
                event.preventDefault();
                setExpanded(prev => !prev);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    if (!expanded) {
        return (
            <button
                type="button"
                className="ui-panel controls-hint controls-hint--collapsed"
                onClick={() => setExpanded(true)}
                aria-label="展开操作说明"
            >
                <kbd>H</kbd> 帮助
            </button>
        );
    }

    return (
        <div className="ui-panel controls-hint" aria-label="操作说明">
            <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动 · <kbd>空格</kbd> 跳跃 · <kbd>Shift</kbd> 闪避</div>
            <div>左键三段连击 · <kbd>Q</kbd> 重击 · 右键远程 · <kbd>E</kbd> 交互</div>
            <div>移动鼠标转动镜头 · <kbd>Esc</kbd> 暂停 / 释放鼠标</div>
            <div><kbd>I</kbd> / <kbd>Tab</kbd> 背包 · <kbd>H</kbd> 收起帮助</div>
            {isDev && <div className="controls-hint__dev">无交互物时 <kbd>E</kbd> 仍可加测试经验</div>}
        </div>
    );
}
