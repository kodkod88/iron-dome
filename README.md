# Iron Dome

A cinematic 2D browser game where you defend a city from incoming enemy missiles using the Iron Dome interceptor system.

## Play the Game

Open `index.html` in a modern browser — no build step required.

**Requires:** Chrome 89+, Firefox 108+, or Safari 16.4+ (importmap support).

---

## Controls

| Action | Input |
|---|---|
| Intercept a missile | Click directly on it |
| Area shot (free aim) | Click anywhere in the sky |
| Pause / Resume | `ESC` or the PAUSE button |
| Restart | `R` or the RESTART button |

---

## Gameplay

- Enemy missiles fall from the top of the screen toward your city
- Click a missile → an interceptor launches from the truck and tracks it
- Click empty sky → the interceptor detonates at that point (area shot)
- Missiles that reach the city deal damage; health reaches 0 → game over
- Intercept enough threats to trigger the victory cinematic

### Difficulty scaling (every 30 seconds)

| What changes | Rate |
|---|---|
| Spawn interval | −200 ms/level (min 500 ms) |
| Missile speed | +8% per level |
| Max simultaneous missiles | +1 per level (cap: 6) |
| Large missile frequency | +5% per level (cap: 50%) |

### Missile types

| Type | Description | Damage |
|---|---|---|
| Small | Gaza-style rocket — short, olive-green, slight wobble | 5 |
| Medium | Mid-range missile — military green, moderate speed | 10 |
| Large | Iran-style ballistic — long, striped body, slow but heavy | 20 |

---

## Run Tests

```bash
npm install
npm test
```

52 tests cover all pure-JS business logic (Missile, Interceptor, DifficultyService, CollisionService, ScoreService, HealthService, ExplosionService) using Jest. No Phaser dependency in tests.

---

## Architecture

```
src/
├── main.js
├── game/
│   ├── GameConfig.js            Phaser configuration
│   └── GameScene.js             Main scene — orchestrates all systems
├── entities/
│   ├── Missile.js               Pure JS: position, velocity, damage, trail
│   └── Interceptor.js           Pure JS: homing + anti-circling guidance
├── factories/
│   └── MissileFactory.js        Creates missiles via DifficultyService
├── renderers/
│   ├── MissileRenderer.js       Type-specific missile shapes & flames
│   └── InterceptorRenderer.js   Tamir-style interceptor visuals
├── services/
│   ├── CollisionService.js      Circle–circle collision detection
│   ├── DifficultyService.js     Level, spawn rate, speed scaling
│   ├── ScoreService.js          Score accumulation
│   ├── HealthService.js         City health tracking
│   ├── CameraEffectsService.js  Screen shake (small / medium / large)
│   ├── ExplosionService.js      Spark particle pool (cap: 220)
│   └── SmokeTrailEmitter.js     Central smoke particle manager (cap: 250)
└── ui/
    ├── UIManager.js             HUD, pause overlay, game-over screen
    └── RadarUI.js               Semi-circular radar scope with sweep
```

### Design principles

- **Phaser isolation** — `Missile`, `Interceptor`, and all services are plain JS classes with zero Phaser imports, fully unit-testable in Node
- **Single Responsibility** — each module owns exactly one concern; `GameScene` orchestrates but does not implement business logic
- **Open/Closed** — new missile types require only a new entry in `MISSILE_TYPES` (Missile.js); new difficulty curves require only changes to DifficultyService constants
- **Dependency Inversion** — `MissileFactory` receives `DifficultyService` via constructor; `GameScene` receives all services via composition
- **DRY** — missile config lives in `MISSILE_TYPES`; smoke options live in each renderer as `SMOKE_OPTS`; all difficulty formulas are centralised

### Interceptor guidance — anti-circling system

Five independent detonation conditions fire in priority order:

1. **Proximity** — within 50 px of target
2. **Dwell** — within 90 px for > 0.5 s (stuck orbiting)
3. **Overshoot** — distance increasing for 3 consecutive frames after getting close
4. **Max lifetime** — 3.2 s hard cap
5. **Ground contact** — interceptor hits the ground plane

A 90 px boost phase (straight vertical launch) prevents circling when the target is very close. Terminal guidance increases turn authority from 3.2 → 4.2 rad/s inside 160 px.
