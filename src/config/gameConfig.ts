export const gameConfig = {
    render: {
        hardwareScalingLevel: 1.25
    },
    physics: {
        gravity: -9.81,
        maxDeltaSeconds: 0.1
    },
    world: {
        groundSize: 100,
        enemySpawnPoints: [
            [6, 1, 6],
            [-7, 1, 4],
            [4, 1, -8]
        ] as const,
        enemyRespawnDelaySeconds: 8,
        interactRange: 2.4,
        shrineHealAmount: 40,
        shrineCooldownSeconds: 12,
        chestPotionId: 'item_health_potion_chest'
    },
    player: {
        speed: 5,
        jumpForce: 5,
        maxGroundSlopeNormalY: 0.5,
        invulnerabilitySeconds: 0.7,
        hitKnockback: 2.2
    },
    camera: {
        mouseSensitivity: 0.0025,
        wheelSensitivity: 0.006,
        lowerBetaLimit: 0.35,
        defaultRadius: 8.5,
        lowerRadiusLimit: 3.2,
        upperRadiusLimit: 14,
        collisionMargin: 0.35,
        minCollisionRadius: 1.6
    },
    progression: {
        initialStats: {
            level: 1,
            currentXP: 0,
            maxXP: 100,
            hp: 100,
            maxHp: 100,
            stamina: 100,
            maxStamina: 100,
            baseDamage: 10
        },
        xpGrowthMultiplier: 1.5,
        hpPerLevel: 20,
        damagePerLevel: 2
    },
    combat: {
        meleeStaminaCost: 10,
        meleeCooldownSeconds: 1,
        meleeSwingSeconds: 0.5,
        meleeRange: 4,
        rangedCooldownSeconds: 0.5,
        projectileSpeed: 16,
        projectileDiameter: 0.4,
        projectileSpawnDistance: 1.35,
        projectileLifetimeSeconds: 2,
        projectileHitRadius: 0.65,
        meleeEffectSeconds: 0.28,
        staminaRegenPerSecond: 12
    },
    enemy: {
        maxHp: 30,
        speed: 1.8,
        attackRange: 1.6,
        attackDamage: 8,
        attackCooldownSeconds: 1.2,
        xpReward: 30,
        radius: 0.55,
        avoidLookAhead: 1.1,
        avoidSteerStrength: 1.35,
        separationDistance: 1.35
    },
    save: {
        version: 1,
        storageKey: 'gm.save.v1',
        debounceMilliseconds: 500,
        maxInventoryItems: 100
    },
    settings: {
        storageKey: 'gm.settings.v1',
        defaultMouseSensitivity: 0.0025,
        minMouseSensitivity: 0.0008,
        maxMouseSensitivity: 0.006,
        defaultMasterVolume: 0.55
    },
    audio: {
        enabledByDefault: true
    }
} as const;
