import { gameConfig } from '../config/gameConfig';
import {
    type Consumable,
    type Item,
    ItemType,
    type RPGSaveState,
    type Stats,
    type Weapon
} from './RPGTypes';

type Unsubscribe = () => void;

const createInitialStats = (): Stats => ({ ...gameConfig.progression.initialStats });

export class RPGManager {
    private statsState: Stats = createInitialStats();
    private statsSnapshot: Readonly<Stats> = Object.freeze({ ...this.statsState });
    private inventoryState: Readonly<Item>[] = [];
    private inventorySnapshot: readonly Readonly<Item>[] = Object.freeze([]);
    private equippedWeaponState: Readonly<Weapon> | null = null;
    private invulnerabilitySeconds = 0;

    private readonly statsChangedListeners = new Set<() => void>();
    private readonly inventoryChangedListeners = new Set<() => void>();
    private readonly levelUpListeners = new Set<(level: number) => void>();

    public constructor() {
        this.addStarterItems();
    }

    public get stats(): Readonly<Stats> {
        return this.statsSnapshot;
    }

    public get inventory(): readonly Readonly<Item>[] {
        return this.inventorySnapshot;
    }

    public get equippedWeapon(): Readonly<Weapon> | null {
        return this.equippedWeaponState;
    }

    public get isDead(): boolean {
        return this.statsState.hp === 0;
    }

    public get isInvulnerable(): boolean {
        return this.invulnerabilitySeconds > 0;
    }

    public get invulnerabilityRemaining(): number {
        return this.invulnerabilitySeconds;
    }

    public update(deltaSeconds: number): void {
        if (this.invulnerabilitySeconds <= 0) return;
        this.invulnerabilitySeconds = Math.max(0, this.invulnerabilitySeconds - deltaSeconds);
    }

    private addStarterItems(): void {
        const woodenSword: Weapon = {
            id: 'wpn_wood_sword_01',
            name: '木剑',
            type: ItemType.WEAPON_MELEE,
            icon: '🗡️',
            description: '一把基础训练木剑。',
            damage: 5
        };
        const healthPotion: Consumable = {
            id: 'item_health_potion_01',
            name: '生命药水',
            type: ItemType.CONSUMABLE,
            icon: '🧪',
            description: '恢复 35 点生命。',
            healAmount: 35
        };
        this.addItem(woodenSword);
        this.addItem(healthPotion);
        this.equipWeapon(woodenSword.id);
    }

    public addXP(amount: number): void {
        this.assertNonNegativeFinite(amount, '经验值');
        if (amount === 0) return;

        const previousLevel = this.statsState.level;
        this.statsState.currentXP += amount;
        // 使用循环处理巨额经验，避免递归层级随外部数据增长。
        while (this.statsState.currentXP >= this.statsState.maxXP) {
            this.statsState.currentXP -= this.statsState.maxXP;
            this.statsState.level += 1;
            this.statsState.maxXP = Math.floor(
                this.statsState.maxXP * gameConfig.progression.xpGrowthMultiplier
            );
            this.statsState.maxHp += gameConfig.progression.hpPerLevel;
            this.statsState.hp = this.statsState.maxHp;
            this.statsState.baseDamage += gameConfig.progression.damagePerLevel;
        }
        this.commitStats();
        if (this.statsState.level > previousLevel) {
            this.levelUpListeners.forEach(callback => callback(this.statsState.level));
        }
    }

    public takeDamage(amount: number): boolean {
        this.assertNonNegativeFinite(amount, '伤害值');
        if (amount === 0 || this.isDead || this.invulnerabilitySeconds > 0) return false;

        this.statsState.hp = Math.max(0, this.statsState.hp - amount);
        if (this.statsState.hp > 0) {
            this.invulnerabilitySeconds = gameConfig.player.invulnerabilitySeconds;
        }
        this.commitStats();
        return true;
    }

    public grantInvulnerability(seconds: number): void {
        this.assertNonNegativeFinite(seconds, '无敌时间');
        if (seconds === 0 || this.isDead) return;

        // 多种无敌来源重叠时只延长、不缩短，避免闪避覆盖受击保护时间。
        this.invulnerabilitySeconds = Math.max(this.invulnerabilitySeconds, seconds);
        this.commitStats();
    }

    public heal(amount: number): void {
        this.assertNonNegativeFinite(amount, '治疗值');
        if (amount === 0 || this.isDead) return;

        this.statsState.hp = Math.min(this.statsState.maxHp, this.statsState.hp + amount);
        this.commitStats();
    }

    public consumeStamina(amount: number): boolean {
        this.assertNonNegativeFinite(amount, '体力消耗');
        if (amount === 0) return true;
        if (this.statsState.stamina < amount) return false;

        this.statsState.stamina -= amount;
        this.commitStats();
        return true;
    }

    public restoreStamina(amount: number): void {
        this.assertNonNegativeFinite(amount, '体力恢复');
        if (amount === 0 || this.statsState.stamina >= this.statsState.maxStamina) return;

        this.statsState.stamina = Math.min(
            this.statsState.maxStamina,
            this.statsState.stamina + amount
        );
        this.commitStats();
    }

    public revive(): void {
        if (!this.isDead) return;
        this.statsState.hp = this.statsState.maxHp;
        this.statsState.stamina = this.statsState.maxStamina;
        this.commitStats();
    }

    public addItem(item: Item): void {
        this.validateItem(item);
        if (this.inventoryState.some(existing => existing.id === item.id)) {
            throw new Error(`物品编号已存在：${item.id}`);
        }

        // 冻结副本，防止调用方保留原始引用后绕过领域规则修改数据。
        const immutableItem = Object.freeze({ ...item });
        this.inventoryState = [...this.inventoryState, immutableItem];
        this.commitInventory();
    }

    public equipWeapon(itemId: string): void {
        if (typeof itemId !== 'string' || itemId.trim() === '') {
            throw new TypeError('武器编号不能为空。');
        }

        const item = this.inventoryState.find(candidate => candidate.id === itemId);
        if (!item) throw new Error(`背包中不存在物品：${itemId}`);
        if (!this.isWeapon(item)) throw new Error(`物品不是武器：${itemId}`);

        this.equippedWeaponState = item;
        this.notifyInventoryChanged();
    }

    public useConsumable(itemId: string): { healed: number; stamina: number } {
        if (typeof itemId !== 'string' || itemId.trim() === '') {
            throw new TypeError('物品编号不能为空。');
        }
        if (this.isDead) throw new Error('死亡状态下无法使用物品。');

        const index = this.inventoryState.findIndex(candidate => candidate.id === itemId);
        if (index < 0) throw new Error(`背包中不存在物品：${itemId}`);
        const item = this.inventoryState[index];
        if (!this.isConsumable(item)) throw new Error(`物品不是消耗品：${itemId}`);

        const healAmount = item.healAmount ?? 0;
        const staminaAmount = item.staminaAmount ?? 0;
        if (healAmount <= 0 && staminaAmount <= 0) {
            throw new Error(`消耗品没有可用效果：${itemId}`);
        }

        const hpBefore = this.statsState.hp;
        const staminaBefore = this.statsState.stamina;
        if (healAmount > 0) this.heal(healAmount);
        if (staminaAmount > 0) this.restoreStamina(staminaAmount);

        this.inventoryState = this.inventoryState.filter((_, itemIndex) => itemIndex !== index);
        this.commitInventory();

        return {
            healed: this.statsState.hp - hpBefore,
            stamina: this.statsState.stamina - staminaBefore
        };
    }

    public getTotalDamage(): number {
        return this.statsState.baseDamage + (this.equippedWeaponState?.damage ?? 0);
    }

    public createSaveState(): RPGSaveState {
        return {
            stats: { ...this.statsState },
            inventory: this.inventoryState.map(item => ({ ...item })),
            equippedWeaponId: this.equippedWeaponState?.id ?? null
        };
    }

    public restoreSaveState(value: unknown): void {
        const state = this.validateSaveState(value);
        const immutableInventory = state.inventory.map(item => Object.freeze({ ...item }));

        // 所有字段验证完成后再一次性替换，避免坏存档造成半更新状态。
        this.statsState = { ...state.stats };
        this.inventoryState = immutableInventory;
        this.equippedWeaponState = state.equippedWeaponId === null
            ? null
            : immutableInventory.find(item => item.id === state.equippedWeaponId) as Readonly<Weapon>;
        this.invulnerabilitySeconds = 0;
        this.commitStats();
        this.commitInventory();
    }

    public subscribeStats(callback: () => void): Unsubscribe {
        this.statsChangedListeners.add(callback);
        return () => {
            this.statsChangedListeners.delete(callback);
        };
    }

    public subscribeInventory(callback: () => void): Unsubscribe {
        this.inventoryChangedListeners.add(callback);
        return () => {
            this.inventoryChangedListeners.delete(callback);
        };
    }

    public subscribeLevelUp(callback: (level: number) => void): Unsubscribe {
        this.levelUpListeners.add(callback);
        return () => {
            this.levelUpListeners.delete(callback);
        };
    }

    private commitStats(): void {
        this.statsSnapshot = Object.freeze({ ...this.statsState });
        this.statsChangedListeners.forEach(callback => callback());
    }

    private commitInventory(): void {
        this.inventorySnapshot = Object.freeze([...this.inventoryState]);
        this.inventoryChangedListeners.forEach(callback => callback());
    }

    private notifyInventoryChanged(): void {
        this.inventoryChangedListeners.forEach(callback => callback());
    }

    private assertNonNegativeFinite(value: number, fieldName: string): void {
        if (!Number.isFinite(value) || value < 0) {
            throw new RangeError(`${fieldName}必须是非负有限数值。`);
        }
    }

    private validateItem(item: Item): void {
        if (!item || typeof item !== 'object') throw new TypeError('物品不能为空。');
        if (typeof item.id !== 'string' || item.id.trim() === '') throw new TypeError('物品编号不能为空。');
        if (typeof item.name !== 'string' || item.name.trim() === '') throw new TypeError('物品名称不能为空。');
        if (!Object.values(ItemType).includes(item.type)) throw new TypeError('物品类型无效。');
        if (typeof item.icon !== 'string' || typeof item.description !== 'string') {
            throw new TypeError('物品图标和描述必须是字符串。');
        }
        if (this.isWeapon(item) && (!Number.isFinite(item.damage) || item.damage < 0)) {
            throw new RangeError('武器伤害必须是非负有限数值。');
        }
        if (this.isConsumable(item)) {
            if (item.healAmount !== undefined
                && (!Number.isFinite(item.healAmount) || item.healAmount < 0)) {
                throw new RangeError('消耗品治疗量必须是非负有限数值。');
            }
            if (item.staminaAmount !== undefined
                && (!Number.isFinite(item.staminaAmount) || item.staminaAmount < 0)) {
                throw new RangeError('消耗品体力恢复量必须是非负有限数值。');
            }
        }
    }

    private validateSaveState(value: unknown): RPGSaveState {
        if (!value || typeof value !== 'object') throw new TypeError('存档内容必须是对象。');
        const candidate = value as Partial<RPGSaveState>;
        const stats = candidate.stats;
        if (!stats || typeof stats !== 'object') throw new TypeError('存档属性无效。');

        const numericFields: Array<keyof Stats> = [
            'level', 'currentXP', 'maxXP', 'hp', 'maxHp', 'stamina', 'maxStamina', 'baseDamage'
        ];
        for (const field of numericFields) {
            if (!Number.isFinite(stats[field])) throw new RangeError(`存档属性 ${field} 无效。`);
        }
        if (!Number.isInteger(stats.level) || stats.level < 1) throw new RangeError('存档等级无效。');
        if (stats.maxXP <= 0 || stats.currentXP < 0 || stats.currentXP >= stats.maxXP) {
            throw new RangeError('存档经验值越界。');
        }
        if (stats.maxHp <= 0 || stats.hp < 0 || stats.hp > stats.maxHp) {
            throw new RangeError('存档生命值越界。');
        }
        if (stats.maxStamina <= 0 || stats.stamina < 0 || stats.stamina > stats.maxStamina) {
            throw new RangeError('存档体力值越界。');
        }
        if (stats.baseDamage < 0) throw new RangeError('存档基础伤害无效。');

        if (!Array.isArray(candidate.inventory)
            || candidate.inventory.length > gameConfig.save.maxInventoryItems) {
            throw new RangeError('存档背包无效或超过容量限制。');
        }
        const ids = new Set<string>();
        for (const item of candidate.inventory) {
            this.validateItem(item);
            if (ids.has(item.id)) throw new Error(`存档包含重复物品：${item.id}`);
            ids.add(item.id);
        }

        if (candidate.equippedWeaponId !== null && typeof candidate.equippedWeaponId !== 'string') {
            throw new TypeError('存档装备编号无效。');
        }
        if (candidate.equippedWeaponId !== null) {
            const equipped = candidate.inventory.find(item => item.id === candidate.equippedWeaponId);
            if (!equipped || !this.isWeapon(equipped)) throw new Error('存档装备不在背包中或不是武器。');
        }

        return candidate as RPGSaveState;
    }

    private isWeapon(item: Readonly<Item>): item is Readonly<Weapon> {
        return (item.type === ItemType.WEAPON_MELEE || item.type === ItemType.WEAPON_RANGED)
            && 'damage' in item
            && typeof item.damage === 'number';
    }

    private isConsumable(item: Readonly<Item>): item is Readonly<Consumable> {
        return item.type === ItemType.CONSUMABLE;
    }
}
