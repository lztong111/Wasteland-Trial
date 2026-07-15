import { useEffect, useMemo, useState } from 'react';
import { gameConfig } from '../../config/gameConfig';
import { ItemType, type Consumable, type Item, type Weapon } from '../../data/RPGTypes';
import type { RPGManager } from '../../data/RPGManager';

const VISIBLE_SLOTS = 20;

interface InventoryPanelProps {
    rpgManager: RPGManager;
    inventory: readonly Readonly<Item>[];
    equippedWeapon: Readonly<Weapon> | null;
    onClose: () => void;
    onUsedConsumable?: () => void;
}

function itemTypeLabel(type: ItemType): string {
    switch (type) {
        case ItemType.WEAPON_MELEE:
            return '近战武器';
        case ItemType.WEAPON_RANGED:
            return '远程武器';
        case ItemType.CONSUMABLE:
            return '消耗品';
        case ItemType.MATERIAL:
            return '材料';
        default:
            return '物品';
    }
}

function isWeapon(item: Readonly<Item>): item is Readonly<Weapon> {
    return (
        (item.type === ItemType.WEAPON_MELEE || item.type === ItemType.WEAPON_RANGED)
        && 'damage' in item
        && typeof (item as Weapon).damage === 'number'
    );
}

function isConsumable(item: Readonly<Item>): item is Readonly<Consumable> {
    return item.type === ItemType.CONSUMABLE;
}

export function InventoryPanel({
    rpgManager,
    inventory,
    equippedWeapon,
    onClose,
    onUsedConsumable
}: InventoryPanelProps) {
    const [selectedId, setSelectedId] = useState<string | null>(
        equippedWeapon?.id ?? inventory[0]?.id ?? null
    );

    useEffect(() => {
        if (selectedId && inventory.some(item => item.id === selectedId)) return;
        setSelectedId(equippedWeapon?.id ?? inventory[0]?.id ?? null);
    }, [inventory, equippedWeapon, selectedId]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.code === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const selected = useMemo(
        () => inventory.find(item => item.id === selectedId) ?? null,
        [inventory, selectedId]
    );

    const slots = useMemo(() => {
        const cells: Array<Readonly<Item> | null> = [...inventory];
        while (cells.length < VISIBLE_SLOTS) cells.push(null);
        return cells.slice(0, Math.max(VISIBLE_SLOTS, inventory.length));
    }, [inventory]);

    const canEquip = selected !== null && isWeapon(selected);
    const canUse = selected !== null && isConsumable(selected);
    const isEquipped = selected !== null && equippedWeapon?.id === selected.id;

    const handleEquip = () => {
        if (!selected || !canEquip) return;
        try {
            rpgManager.equipWeapon(selected.id);
        } catch {
            // 领域校验失败时保持 UI 稳定，不打断背包交互。
        }
    };

    const handleUse = () => {
        if (!selected || !canUse) return;
        try {
            rpgManager.useConsumable(selected.id);
            onUsedConsumable?.();
        } catch {
            // 死亡或校验失败时忽略。
        }
    };

    return (
        <div className="inventory-backdrop" onClick={onClose} role="presentation">
            <div
                className="inventory-panel"
                role="dialog"
                aria-modal="true"
                aria-label="背包"
                onClick={event => event.stopPropagation()}
            >
                <div className="inventory-panel__main">
                    <div className="inventory-panel__header">
                        <h2>背包</h2>
                        <span className="inventory-panel__capacity">
                            {inventory.length} / {gameConfig.save.maxInventoryItems}
                        </span>
                    </div>
                    <div className="inventory-grid">
                        {slots.map((item, index) => {
                            if (!item) {
                                return (
                                    <div
                                        key={`empty-${index}`}
                                        className="inventory-slot inventory-slot--empty"
                                        aria-hidden="true"
                                    />
                                );
                            }
                            const equipped = equippedWeapon?.id === item.id;
                            const selectedSlot = selectedId === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={[
                                        'inventory-slot',
                                        selectedSlot ? 'inventory-slot--selected' : '',
                                        equipped ? 'inventory-slot--equipped' : ''
                                    ].filter(Boolean).join(' ')}
                                    aria-label={`${item.name}${equipped ? '（已装备）' : ''}`}
                                    aria-pressed={selectedSlot}
                                    onClick={() => setSelectedId(item.id)}
                                >
                                    {item.icon}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <aside className="inventory-detail">
                    {selected ? (
                        <>
                            <div className="inventory-detail__icon" aria-hidden="true">
                                {selected.icon}
                            </div>
                            <h3 className="inventory-detail__name">{selected.name}</h3>
                            <p className="inventory-detail__meta">
                                {itemTypeLabel(selected.type)}
                                {isWeapon(selected) ? ` · 伤害 +${selected.damage}` : ''}
                                {isConsumable(selected) && selected.healAmount
                                    ? ` · 生命 +${selected.healAmount}`
                                    : ''}
                                {isConsumable(selected) && selected.staminaAmount
                                    ? ` · 体力 +${selected.staminaAmount}`
                                    : ''}
                                {isEquipped ? ' · 已装备' : ''}
                            </p>
                            <p className="inventory-detail__desc">{selected.description}</p>
                            <div className="inventory-detail__actions">
                                {canEquip && (
                                    <button
                                        type="button"
                                        onClick={handleEquip}
                                        disabled={isEquipped}
                                    >
                                        {isEquipped ? '已装备' : '装备'}
                                    </button>
                                )}
                                {canUse && (
                                    <button type="button" onClick={handleUse}>
                                        使用
                                    </button>
                                )}
                                <button type="button" className="button-secondary" onClick={onClose}>
                                    关闭
                                </button>
                            </div>
                        </>
                    ) : (
                        <p className="inventory-detail__empty">选择一件物品查看详情</p>
                    )}
                </aside>

                <p className="inventory-hint">
                    <kbd>I</kbd> / <kbd>Tab</kbd> / <kbd>Esc</kbd> 关闭
                </p>
            </div>
        </div>
    );
}
