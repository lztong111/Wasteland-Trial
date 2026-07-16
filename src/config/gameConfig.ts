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
    objective: {
        guardianTarget: 3,
        guardianWaveCount: 2
    },
    player: {
        speed: 5,
        jumpForce: 5,
        dodgeSpeed: 12,
        dodgeDurationSeconds: 0.34,
        dodgeInvulnerabilitySeconds: 0.28,
        dodgeStaminaCost: 20,
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
        minCollisionRadius: 1.6,
        shoulderOffset: 0.72,
        targetHeight: 0.92,
        aimDistance: 60
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
        damagePerLevel: 2,
        trialUpgradeHp: 20,
        trialUpgradeDamage: 4,
        trialUpgradeStamina: 20
    },
    combat: {
        meleeComboStaminaCosts: [10, 10, 15] as const,
        meleeComboDamageMultipliers: [1, 1.25, 1.6] as const,
        meleeComboSwingSeconds: [0.38, 0.42, 0.52] as const,
        meleeCooldownSeconds: 0.45,
        meleeRange: 2.2,
        meleeHalfAngleDegrees: 55,
        heavyStaminaCost: 25,
        heavyDamageMultiplier: 2,
        heavySwingSeconds: 0.78,
        heavyCooldownSeconds: 0.9,
        heavyRange: 2.6,
        heavyHalfAngleDegrees: 48,
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
        maxHp: 40,
        speed: 1.8,
        attackRange: 1.6,
        attackDamage: 8,
        attackCooldownSeconds: 1.2,
        attackWindupSeconds: 0.65,
        attackCancelMargin: 0.55,
        xpReward: 30,
        trialHealthGrowthPerRound: 0.25,
        trialDamageGrowthPerRound: 0.15,
        trialXpGrowthPerRound: 0.2,
        radius: 0.55,
        avoidLookAhead: 1.1,
        avoidSteerStrength: 1.35,
        separationDistance: 1.35,
        archetypes: {
            grunt: {
                healthMultiplier: 1,
                damageMultiplier: 1,
                speedMultiplier: 1,
                xpMultiplier: 1,
                modelScale: 1,
                dropChance: 0
            },
            brute: {
                healthMultiplier: 1.55,
                damageMultiplier: 1.25,
                speedMultiplier: 0.72,
                xpMultiplier: 1.45,
                modelScale: 1.18,
                dropChance: 0.35
            },
            boss: {
                healthMultiplier: 2.4,
                damageMultiplier: 1.55,
                speedMultiplier: 0.62,
                xpMultiplier: 2.5,
                modelScale: 1.42,
                dropChance: 1
            }
        }
    },
    save: {
        version: 3,
        storageKey: 'gm.save.v3',
        legacyStorageKeys: ['gm.save.v2', 'gm.save.v1'] as const,
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
    },
    assets: {
        playerModel: {
            rootUrl: '/models/',
            fileName: 'Xbot.glb'
        } as { rootUrl: string; fileName: string } | null
    }
} as const;
