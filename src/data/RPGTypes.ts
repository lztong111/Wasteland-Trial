export enum ItemType {
    WEAPON_MELEE,
    WEAPON_RANGED,
    CONSUMABLE,
    MATERIAL
}

export interface Stats {
    level: number;
    currentXP: number;
    maxXP: number;
    hp: number;
    maxHp: number;
    stamina: number;
    maxStamina: number;
    baseDamage: number;
}

export interface Item {
    id: string;
    name: string;
    type: ItemType;
    icon: string;
    description: string;
}

export interface Weapon extends Item {
    damage: number;
    range?: number;
}

export interface Consumable extends Item {
    healAmount?: number;
    staminaAmount?: number;
}

export interface RPGSaveState {
    stats: Stats;
    inventory: Item[];
    equippedWeaponId: string | null;
}
