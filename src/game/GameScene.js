/**
 * GameScene — Phaser Scene.
 * Orchestrates all game systems: spawning, updating, rendering, UI, game state.
 * Pure-JS services are injected and hold all business logic.
 */
import Phaser from 'phaser';
import { Interceptor } from '../entities/Interceptor.js';
import { MissileFactory } from '../factories/MissileFactory.js';
import { CollisionService } from '../services/CollisionService.js';
import { DifficultyService } from '../services/DifficultyService.js';
import { ScoreService } from '../services/ScoreService.js';
import { HealthService } from '../services/HealthService.js';
import { CameraEffectsService } from '../services/CameraEffectsService.js';
import { ExplosionService } from '../services/ExplosionService.js';
import { UIManager } from '../ui/UIManager.js';
import { RadarUI } from '../ui/RadarUI.js';
import { MissileRenderer } from '../renderers/MissileRenderer.js';
import { InterceptorRenderer } from '../renderers/InterceptorRenderer.js';
import { SmokeTrailEmitter } from '../services/SmokeTrailEmitter.js';

// Canvas constants
const W = 800;
const H = 600;
const GROUND_Y = H - 48;   // y at which a missile has hit the city
const TRUCK_X = W / 2;
const TRUCK_Y = H - 45;
const CLICK_TOLERANCE = 12; // extra px around missile radius for click detection
const FINALE_SCORE    = 1000; // score that triggers the cinematic ending

// Launcher geometry — coordinates must match _drawTruck()
// base = H-12 = 588, platTop = base-44 = 544, pivotY = platTop-1 = 543
const LAUNCHER_PIVOT_X     = TRUCK_X + 20;        // 420
const LAUNCHER_PIVOT_Y     = H - 57;              // 543
const LAUNCHER_DEFAULT_ANGLE = -Math.PI / 2;      // 90° vertical — VLS (upright) style
const LAUNCHER_TUBE_LENGTH   = 42;                // px — must match tubeLen in _drawTruck()
// Pre-computed fixed tip of the center tube (spawn point for all interceptors)
const LAUNCHER_SPAWN_X = LAUNCHER_PIVOT_X + Math.cos(LAUNCHER_DEFAULT_ANGLE) * LAUNCHER_TUBE_LENGTH;
const LAUNCHER_SPAWN_Y = LAUNCHER_PIVOT_Y + Math.sin(LAUNCHER_DEFAULT_ANGLE) * LAUNCHER_TUBE_LENGTH;

// ─── Star field (fixed positions, generated once — no Math.random() at draw time) ───
const STAR_POSITIONS = (() => {
  // Simple deterministic LCG so stars are always the same
  let s = 0xdeadbeef;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  return Array.from({ length: 70 }, () => [rng() * W, rng() * H * 0.52]);
})();

// ─── City skyline ────────────────────────────────────────────────────────────
// Each entry: [x, y, width, height]
// Gap left around x 470–530 for the truck
const BUILDINGS = [
  [0,   H - 72,  48, 72],
  [50,  H - 105, 42, 105],
  [95,  H - 58,  36, 58],
  [133, H - 128, 58, 128],
  [194, H - 80,  44, 80],
  [241, H - 50,  30, 50],
  [274, H - 145, 62, 145],
  [340, H - 88,  40, 88],
  [383, H - 62,  36, 62],
  [422, H - 110, 44, 110],  // ends at 466
  // gap 466–534 (truck)
  [534, H - 96,  50, 96],
  [588, H - 60,  38, 60],
  [628, H - 138, 58, 138],
  [690, H - 72,  46, 72],
  [739, H - 100, 34, 100],
  [776, H - 55,  24, 55],
];


export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  create() {
    this._difficulty = new DifficultyService();
    this._score      = new ScoreService();
    this._health     = new HealthService(100);
    this._collision  = new CollisionService();
    this._factory    = new MissileFactory(this._difficulty);

    this._missiles     = [];
    this._interceptors = [];
    this._explosions   = [];

    // Layer order: sky(0) → city(1) → entities(2) → UI(10+)
    this._skyGfx  = this.add.graphics().setDepth(0);
    this._cityGfx = this.add.graphics().setDepth(1);
    this._gfx     = this.add.graphics().setDepth(2);

    this._drawSky();
    this._drawCity();

    this._ui      = new UIManager(this);
    this._camera      = new CameraEffectsService(this.cameras.main);
    this._expSvc      = new ExplosionService();
    this._smokeEmitter = new SmokeTrailEmitter();
    // Semi-circular radar: truck world position sets the polar origin.
    // cx/cy position the flat base in the bottom-left corner of the canvas.
    this._radar = new RadarUI(
      this, W, H,
      LAUNCHER_PIVOT_X, LAUNCHER_PIVOT_Y, // truck world coords (polar origin)
      105, H - 12,                        // flat-base centre in screen space
      100                                 // radius
    );

    this._gameRunning     = false;
    this._spawnTimer      = null;
    this._finaleTriggered = false;
    this._finaleMode      = false;
    this._gameTimeScale   = 1;
    this._isPaused        = false;
    this._lastToggleTime  = 0;

    // Vertical recoil offset for the launcher (px, decays to 0 each frame)
    this._recoilY = 0;

    this._ui.showStartScreen(() => this._startGame());
  }

  update(_time, delta) {
    if (!this._gameRunning) return;
    if (this._isPaused) return; // freeze all logic; last Graphics buffers persist

    const dt = (delta / 1000) * this._gameTimeScale;

    this._difficulty.update(delta * this._gameTimeScale);
    this._updateMissiles(dt);
    this._updateInterceptors(dt);
    this._resolveCollisions();
    this._renderFrame(dt);
    this._updateHUD();

    if (!this._finaleMode) {
      if (this._health.isGameOver()) {
        this._endGame();
      } else if (!this._finaleTriggered && this._score.getScore() >= FINALE_SCORE) {
        this._triggerFinale();
      }
    }
  }

  // ─── Game state ─────────────────────────────────────────────────────────────

  _startGame() {
    this.tweens.killAll();
    if (this._spawnTimer) { this._spawnTimer.remove(false); this._spawnTimer = null; }
    this.input.off('pointerdown');

    this._difficulty.reset();
    this._score.reset();
    this._health.reset();
    this._missiles     = [];
    this._interceptors = [];
    this._explosions   = [];
    this._gfx.clear();

    this._recoilY         = 0;
    this._finaleTriggered = false;
    this._finaleMode      = false;
    this._gameTimeScale   = 1;
    this._isPaused        = false;
    this._lastToggleTime  = 0;
    this._expSvc.reset();
    this._smokeEmitter.reset();

    // Clean up any lingering overlay from previous session
    this._ui.hidePauseOverlay();

    // Register ESC — remove first to avoid duplicate listeners on restart
    this.input.keyboard.off('keydown-ESC');
    this.input.keyboard.on('keydown-ESC', () => this._togglePause());

    // R key — restart at any time during gameplay (guarded by _finaleMode)
    this.input.keyboard.off('keydown-R');
    this.input.keyboard.on('keydown-R', () => {
      if (!this._finaleMode) this._startGame();
    });

    this._ui.setPauseCallback(() => this._togglePause());
    this._ui.showPauseButton();

    this._gameRunning = true;
    this.input.on('pointerdown', (p) => this._handleClick(p));
    this._scheduleSpawn();
  }

  _endGame() {
    // Prevent re-entry
    this._finaleMode      = true;
    this._finaleTriggered = true;
    this._isPaused        = false; // force-unpause so cinematic can run

    if (this._spawnTimer) { this._spawnTimer.remove(false); this._spawnTimer = null; }
    this.input.off('pointerdown');
    this.input.keyboard.off('keydown-ESC');
    this.input.keyboard.off('keydown-R');
    this._ui.setPauseCallback(null);
    this._ui.hidePauseButton();
    this._ui.hidePauseOverlay();

    // Phase 1: 700 ms slow-motion
    this._gameTimeScale = 0.35;

    this.time.delayedCall(700, () => {
      this._gameTimeScale = 1;

      // Phase 2: massive multi-layer explosion at city center
      const ex = W / 2, ey = GROUND_Y - 18;
      this._triggerExplosion(ex, ey, 145);
      this.time.delayedCall(100, () => this._triggerExplosion(ex - 55, ey - 25, 95));
      this.time.delayedCall(200, () => this._triggerExplosion(ex + 70, ey + 10, 110));
      this._expSvc.triggerSparks(ex, ey, 200); // large extra spark burst
      this._camera.shakeLarge();

      // Phase 3: white flash
      this.time.delayedCall(450, () => {
        const flash = this.add.graphics().setDepth(50);
        flash.fillStyle(0xffffff, 1);
        flash.fillRect(0, 0, W, H);
        flash.setAlpha(0);
        this.tweens.add({
          targets: flash,
          alpha:   { from: 0, to: 0.95 },
          duration: 300,
          ease:    'Cubic.In',
          yoyo:    true,
          hold:    220,
          onComplete: () => {
            flash.destroy();

            // Phase 4: lingering smoke overlay then game-over screen
            const smoke = this.add.graphics().setDepth(25);
            smoke.fillStyle(0x111111, 0.55);
            smoke.fillRect(0, 0, W, H);
            smoke.setAlpha(0.55);
            this.tweens.add({
              targets:  smoke,
              alpha:    0,
              duration: 3000,
              ease:     'Linear',
              onComplete: () => smoke.destroy(),
            });

            this._ui.showGameOver(this._score.getScore(), () => this._startGame());
          },
        });
      });
    });
  }

  // ─── Pause ──────────────────────────────────────────────────────────────────

  _togglePause() {
    // Ignore outside active gameplay or during cinematic sequences
    if (!this._gameRunning || this._finaleMode) return;

    // Debounce — prevent rapid repeated toggles (e.g. key repeat)
    const now = Date.now();
    if (now - this._lastToggleTime < 150) return;
    this._lastToggleTime = now;

    this._isPaused = !this._isPaused;

    if (this._isPaused) {
      if (this._spawnTimer) this._spawnTimer.paused = true;
      this._ui.showPauseOverlay(
        () => this._togglePause(),
        () => this._startGame()
      );
    } else {
      if (this._spawnTimer) this._spawnTimer.paused = false;
      this._ui.hidePauseOverlay();
    }

    this._ui.updatePauseLabel(this._isPaused);
  }

  // ─── Spawning ───────────────────────────────────────────────────────────────

  _scheduleSpawn() {
    const delay = this._difficulty.getSpawnRate();
    this._spawnTimer = this.time.delayedCall(delay, () => {
      if (!this._gameRunning) return;
      const active = this._missiles.filter(m => m.active).length;
      if (active < this._difficulty.getMaxSimultaneousMissiles()) {
        this._missiles.push(this._factory.create({ canvasWidth: W, canvasHeight: H }));
      }
      this._scheduleSpawn();
    });
  }

  // ─── Input ──────────────────────────────────────────────────────────────────

  _handleClick(pointer) {
    // Trigger vertical recoil — launcher dips down then springs back via _renderFrame decay
    this._recoilY = 5;

    // Homing shot: click directly on an enemy missile
    for (let i = this._missiles.length - 1; i >= 0; i--) {
      const m = this._missiles[i];
      if (!m.active) continue;
      const dx = pointer.x - m.x;
      const dy = pointer.y - m.y;
      if (dx * dx + dy * dy < (m.radius + CLICK_TOLERANCE) ** 2) {
        this._interceptors.push(
          new Interceptor({ x: LAUNCHER_SPAWN_X, y: LAUNCHER_SPAWN_Y, target: m, areaRadius: 20, launchAngle: LAUNCHER_DEFAULT_ANGLE, groundY: GROUND_Y })
        );
        return;
      }
    }
    // Area shot: click on empty sky → flies to point, area explosion on arrival.
    // Clamp destY so a near-ground click still gets a safe arc (prevents orbiting).
    const clampedDestY = Math.min(pointer.y, LAUNCHER_SPAWN_Y - 120);
    this._interceptors.push(
      new Interceptor({ x: LAUNCHER_SPAWN_X, y: LAUNCHER_SPAWN_Y, destX: pointer.x, destY: clampedDestY, areaRadius: 70, launchAngle: LAUNCHER_DEFAULT_ANGLE, groundY: GROUND_Y })
    );
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  _updateMissiles(dt) {
    for (const m of this._missiles) {
      if (!m.active) continue;
      m.update(dt);
      if (m.y >= GROUND_Y) {
        if (!this._finaleMode) this._health.takeDamage(m.damage); // no damage during finale
        this._triggerExplosion(m.x, GROUND_Y, 36);
        m.active = false;
      }
    }
    this._missiles = this._missiles.filter((m) => m.active);
  }

  _updateInterceptors(dt) {
    for (const interceptor of this._interceptors) {
      if (!interceptor.active) continue;
      interceptor.update(dt);

      // Area-shot interceptor just reached its destination → area explosion
      if (!interceptor.active && interceptor.arrivedAt) {
        this._triggerAreaExplosion(
          interceptor.arrivedAt.x,
          interceptor.arrivedAt.y,
          interceptor.areaRadius
        );
      }
    }
    this._interceptors = this._interceptors.filter((i) => i.active);
  }

  _resolveCollisions() {
    const hits = this._collision.checkInterceptorMissile(this._interceptors, this._missiles);
    for (const { interceptor, missile } of hits) {
      this._score.addInterceptScore(missile.type);
      const r = missile.type === 'large' ? 56 : missile.type === 'medium' ? 48 : 40;
      this._triggerExplosion(missile.x, missile.y, r);
      interceptor.active = false;
      missile.active     = false;
    }
  }

  // ─── Cinematic finale ────────────────────────────────────────────────────────

  _triggerFinale() {
    this._finaleTriggered = true;
    this._finaleMode      = true;
    this._isPaused        = false; // force-unpause so cinematic can run

    if (this._spawnTimer) { this._spawnTimer.remove(false); this._spawnTimer = null; }
    this.input.off('pointerdown');
    this.input.keyboard.off('keydown-ESC');
    this.input.keyboard.off('keydown-R');
    this._ui.setPauseCallback(null);
    this._ui.hidePauseButton();
    this._ui.hidePauseOverlay();

    // Phase 1: 2 seconds of slow motion
    this._gameTimeScale = 0.35;

    this.time.delayedCall(2000, () => {
      this._gameTimeScale = 1;
      this._runFinaleBarrage();
      this.time.delayedCall(3600, () => this._runFinaleClimax());
    });
  }

  _runFinaleBarrage() {
    // Spawn 7 enemy missiles with staggered entry
    for (let i = 0; i < 7; i++) {
      this.time.delayedCall(i * 140, () => {
        this._missiles.push(this._factory.create({ canvasWidth: W, canvasHeight: H }));
      });
    }

    // Auto-fire 8 interceptors at 120 ms intervals, targeting active missiles
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(300 + i * 120, () => {
        this._recoilY = 5;
        const active = this._missiles.filter(m => m.active);
        if (active.length > 0) {
          const t = active[i % active.length];
          this._interceptors.push(new Interceptor({
            x: LAUNCHER_SPAWN_X, y: LAUNCHER_SPAWN_Y,
            target: t, areaRadius: 30,
            launchAngle: LAUNCHER_DEFAULT_ANGLE, groundY: GROUND_Y,
          }));
        } else {
          // Spread area shots across the sky if no homing targets available
          const destX = 100 + (i / 7) * 600;
          const destY = 80 + (i % 3) * 80;
          this._interceptors.push(new Interceptor({
            x: LAUNCHER_SPAWN_X, y: LAUNCHER_SPAWN_Y,
            destX, destY, areaRadius: 80,
            launchAngle: LAUNCHER_DEFAULT_ANGLE, groundY: GROUND_Y,
          }));
        }
      });
    }
  }

  _runFinaleClimax() {
    // Three large explosions in the center sky
    const cx = W / 2;
    const cy = H * 0.3;
    this._triggerExplosion(cx, cy, 130);
    this.time.delayedCall(180, () => this._triggerExplosion(cx - 100, cy + 55, 100));
    this.time.delayedCall(340, () => this._triggerExplosion(cx + 110, cy - 25, 115));

    // Screen shake
    this.cameras.main.shake(700, 0.025);

    // White flash then victory overlay
    this.time.delayedCall(350, () => {
      const flash = this.add.graphics().setDepth(50);
      flash.fillStyle(0xffffff, 1);
      flash.fillRect(0, 0, W, H);
      flash.setAlpha(0);
      this.tweens.add({
        targets:  flash,
        alpha:    { from: 0, to: 0.9 },
        duration: 260,
        ease:     'Cubic.In',
        yoyo:     true,
        hold:     180,
        onComplete: () => { flash.destroy(); this._showVictoryScreen(); },
      });
    });
  }

  _showVictoryScreen() {
    this._gameRunning = false;

    const container = this.add.container(0, 0).setDepth(30);

    // Dark vignette
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.65);
    bg.fillRect(0, 0, W, H);
    container.add(bg);

    const title = this.add.text(W / 2, H * 0.32, 'ALL THREATS\nNEUTRALIZED', {
      fontSize: '48px', fill: '#00ff88', fontFamily: 'monospace',
      stroke: '#002211', strokeThickness: 7, align: 'center',
    }).setOrigin(0.5).setAlpha(0).setScale(0.75);
    container.add(title);

    const subtitle = this.add.text(W / 2, H * 0.54, 'IRON DOME ACTIVE', {
      fontSize: '24px', fill: '#aaffcc', fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0);
    container.add(subtitle);

    const scoreText = this.add.text(W / 2, H * 0.63, `FINAL SCORE: ${this._score.getScore()}`, {
      fontSize: '20px', fill: '#ffdd44', fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0);
    container.add(scoreText);

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x006644, 1);
    btnBg.fillRoundedRect(W / 2 - 110, H * 0.75, 220, 48, 8);
    btnBg.setAlpha(0);
    container.add(btnBg);

    const btn = this.add.text(W / 2, H * 0.75 + 24, 'PLAY AGAIN', {
      fontSize: '20px', fill: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });
    container.add(btn);

    this.tweens.add({ targets: title,     alpha: 1, scaleX: 1, scaleY: 1, duration: 800, ease: 'Back.Out' });
    this.tweens.add({ targets: subtitle,  alpha: 1, delay: 600,  duration: 600 });
    this.tweens.add({ targets: scoreText, alpha: 1, delay: 1000, duration: 600 });
    this.tweens.add({
      targets: [btnBg, btn], alpha: 1, delay: 1600, duration: 600,
      onComplete: () => {
        btn.on('pointerover', () => btn.setStyle({ fill: '#00ff88' }));
        btn.on('pointerout',  () => btn.setStyle({ fill: '#ffffff' }));
        btn.once('pointerdown', () => { container.destroy(); this._startGame(); });
      },
    });
  }

  // ─── Explosions ─────────────────────────────────────────────────────────────

  _triggerExplosion(x, y, maxRadius) {
    // Spawn sparks for kinetic particle detail
    this._expSvc.triggerSparks(x, y, maxRadius);

    // Camera shake scaled to explosion size
    if (maxRadius >= 100) this._camera.shakeMedium();
    else if (maxRadius >= 50) this._camera.shakeSmall();

    const state = { x, y, radius: 3, alpha: 1 };
    this._explosions.push(state);
    this.tweens.add({
      targets: state,
      radius: maxRadius,
      alpha: 0,
      duration: 440,
      ease: 'Cubic.Out',
      onComplete: () => {
        const idx = this._explosions.indexOf(state);
        if (idx !== -1) this._explosions.splice(idx, 1);
      },
    });
  }

  _triggerAreaExplosion(x, y, blastRadius) {
    // Larger visual for area shot
    this._triggerExplosion(x, y, blastRadius * 1.1);

    // Damage all active missiles within blast radius
    const hit = this._collision.checkAreaDamage(x, y, blastRadius, this._missiles);
    for (const missile of hit) {
      this._score.addInterceptScore(missile.type);
      this._triggerExplosion(missile.x, missile.y, 38);
      missile.active = false;
    }
  }

  // ─── Rendering ───────────────────────────────────────────────────────────────

  _renderFrame(dt = 1 / 60) {
    // Exponential decay of recoil offset — reaches ~0 in ~8 frames at 60 fps
    this._recoilY *= 0.68;

    // ── Smoke emitter: age existing particles, then feed new ones ────────────
    this._smokeEmitter.update(dt);
    const nowSec = this.time.now / 1000;
    for (const m of this._missiles) {
      if (m.active && m.trail.length > 0) {
        // Emit from most-recent trail point — sits just behind the body
        const tp = m.trail[0];
        this._smokeEmitter.emit(tp.x, tp.y, MissileRenderer.SMOKE_OPTS[m.type]);
      }
    }
    for (const ic of this._interceptors) {
      if (ic.active && ic.smoke.length > 0) {
        this._smokeEmitter.emit(ic.smoke[0].x, ic.smoke[0].y, InterceptorRenderer.SMOKE_OPTS);
      }
    }

    this._gfx.clear();

    // Smoke drawn first — sits behind entity bodies
    this._smokeEmitter.draw(this._gfx);

    this._drawTruck();
    this._drawMissiles(nowSec);
    this._drawInterceptors();
    this._drawExplosions();
    // Spark particles (ExplosionService — pure JS, drawn into entity layer)
    this._expSvc.update(dt);
    this._expSvc.drawSparks(this._gfx);
    // Radar (separate Graphics layer, depth 9)
    this._radar.update(dt, this._missiles, this._interceptors);
  }

  // ─── Static scene elements (drawn once) ─────────────────────────────────────

  _drawSky() {
    const g = this._skyGfx;
    // Main vertical gradient: deep navy → mid blue toward horizon
    g.fillGradientStyle(0x020810, 0x020810, 0x0e2240, 0x0e2240, 1, 1, 1, 1);
    g.fillRect(0, 0, W, H);

    // Horizon atmospheric haze — warmer, slightly lighter band near city line
    g.fillGradientStyle(0x0e2240, 0x0e2240, 0x1a3a5c, 0x1a3a5c, 0, 0, 0.7, 0.7);
    g.fillRect(0, H * 0.6, W, H * 0.4);

    // Stars — faint white dots in upper half
    for (const [sx, sy] of STAR_POSITIONS) {
      const brightness = 0.3 + (sy / (H * 0.52)) * 0.1; // dimmer near horizon
      g.fillStyle(0xffffff, brightness);
      g.fillCircle(sx, sy, sy < H * 0.2 ? 1.2 : 0.9);
    }
  }

  _drawCity() {
    const g = this._cityGfx;

    // Building silhouettes — dark blue-grey
    g.fillStyle(0x111e30, 1);
    for (const [x, y, w, h] of BUILDINGS) {
      g.fillRect(x, y, w, h);
    }

    // Subtle lighter face on the left side of each building (fake 3-D depth)
    g.fillStyle(0x192840, 1);
    for (const [x, y, w, h] of BUILDINGS) {
      g.fillRect(x, y, Math.max(4, w * 0.18), h);
    }

    // Window lights — warm amber, low opacity; faint glow around lit windows
    for (const [bx, by, bw, bh] of BUILDINGS) {
      for (let wx = bx + 6; wx < bx + bw - 4; wx += 10) {
        for (let wy = by + 7; wy < by + bh - 4; wy += 12) {
          if (Math.random() > 0.38) {
            const lit = Math.random() > 0.25;
            if (lit) {
              // Soft light bleed onto building face
              g.fillStyle(0xffdd88, 0.06);
              g.fillCircle(wx + 2.5, wy + 3.5, 6);
            }
            g.fillStyle(lit ? 0xffdd88 : 0x335566, lit ? 0.55 : 0.18);
            g.fillRect(wx, wy, 5, 7);
          }
        }
      }
    }

    // Rooftop detail — antennas & water towers on a few buildings
    g.lineStyle(1, 0x223344, 0.9);
    [[133, H - 128], [274, H - 145], [628, H - 138]].forEach(([bx, by]) => {
      g.beginPath();
      g.moveTo(bx + 8, by);
      g.lineTo(bx + 8, by - 18);
      g.strokePath();
      g.fillStyle(0x334455, 1);
      g.fillCircle(bx + 8, by - 18, 3);
    });

    // Ground strip
    g.fillStyle(0x0b1520, 1);
    g.fillRect(0, H - 12, W, 12);
  }

  // ─── Dynamic rendering ───────────────────────────────────────────────────────

  _drawTruck() {
    const g = this._gfx;
    const x = TRUCK_X;   // 400
    const base = H - 12; // 588

    // ── 1. Ground shadow ─────────────────────────────────────────────────────
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(x, base + 3, 122, 9);

    // ── 2. Chassis (body) ────────────────────────────────────────────────────
    // Shaded lower band
    g.fillStyle(0x1e3d1e, 1);
    g.fillRect(x - 52, base - 20, 104, 10);
    // Lit upper band
    g.fillStyle(0x2d5c2d, 1);
    g.fillRect(x - 52, base - 30, 104, 11);
    // Top highlight line
    g.fillStyle(0x4a8a4a, 0.55);
    g.fillRect(x - 51, base - 30, 102, 2);
    // Panel seam (horizontal mid-line)
    g.fillStyle(0x111e11, 0.6);
    g.fillRect(x - 52, base - 21, 104, 1);

    // ── 3. Cab (left portion) ────────────────────────────────────────────────
    const cabL = x - 52;
    const cabR = x - 8;
    const cabBot = base - 28;
    const cabTop = base - 52;

    // Cab body
    g.fillStyle(0x243824, 1);
    g.fillRect(cabL, cabTop, cabR - cabL, cabBot - cabTop);

    // Cab roof (chamfered front edge)
    g.fillStyle(0x2e5c2e, 1);
    g.fillPoints([
      { x: cabL,      y: cabTop },
      { x: cabR,      y: cabTop + 3 },
      { x: cabR,      y: cabTop },
    ], true);

    // Cab top highlight
    g.fillStyle(0x4a8a4a, 0.45);
    g.fillRect(cabL + 1, cabTop, cabR - cabL - 2, 2);

    // Windshield — angled trapezoid (wider at bottom)
    g.fillStyle(0x5ab5cc, 0.62);
    g.fillPoints([
      { x: cabL + 7,  y: cabTop + 6  },
      { x: cabR - 3,  y: cabTop + 4  },
      { x: cabR - 3,  y: cabBot - 3  },
      { x: cabL + 7,  y: cabBot - 3  },
    ], true);

    // Windshield inner reflection (left pillar highlight)
    g.fillStyle(0xffffff, 0.14);
    g.fillPoints([
      { x: cabL + 8,  y: cabTop + 7  },
      { x: cabL + 18, y: cabTop + 7  },
      { x: cabL + 16, y: cabBot - 4  },
      { x: cabL + 8,  y: cabBot - 4  },
    ], true);

    // Door panel line
    g.lineStyle(1, 0x1a2e1a, 0.8);
    g.beginPath();
    g.moveTo(cabL + 22, cabTop + 6);
    g.lineTo(cabL + 22, cabBot - 2);
    g.strokePath();

    // ── 4. Launcher platform (right/rear portion) ────────────────────────────
    const platL   = x - 6;
    const platR   = x + 52;
    const platBot = base - 28;
    const platTop = base - 44;

    // Armored box — dark body
    g.fillStyle(0x192e19, 1);
    g.fillRect(platL, platTop, platR - platL, platBot - platTop);

    // Metallic gradient strip on top
    g.fillGradientStyle(0x3a5e3a, 0x2a4a2a, 0x192e19, 0x192e19, 1, 1, 1, 1);
    g.fillRect(platL, platTop, platR - platL, 5);

    // Side highlight (left edge)
    g.fillStyle(0x3a6a3a, 0.45);
    g.fillRect(platL, platTop + 1, 2, platBot - platTop - 2);

    // Panel border
    g.lineStyle(1, 0x3a5a3a, 0.55);
    g.strokeRect(platL, platTop, platR - platL, platBot - platTop);

    // Platform ventilation slits
    g.fillStyle(0x0e1e0e, 0.8);
    for (let sx = platL + 6; sx < platR - 6; sx += 10) {
      g.fillRect(sx, platTop + 8, 6, 2);
    }

    // ── 5. Launcher pivot / turret base ──────────────────────────────────────
    const pivotX = x + 20;
    const pivotY = platTop - 1 + this._recoilY; // recoilY > 0 → tubes push down then spring back

    g.fillStyle(0x333333, 1);
    g.fillCircle(pivotX, pivotY, 8);
    g.fillStyle(0x5a5a5a, 1);
    g.fillCircle(pivotX, pivotY, 5);
    g.fillStyle(0x888888, 0.7);
    g.fillCircle(pivotX - 1, pivotY - 1, 2);

    // ── 6. Missile tubes (3 parallel, ~72° from horizontal) ──────────────────
    const tubeAngle = LAUNCHER_DEFAULT_ANGLE; // fixed — launcher stays upright
    const cosA = Math.cos(tubeAngle);
    const sinA = Math.sin(tubeAngle);
    const tubeLen = LAUNCHER_TUBE_LENGTH;
    const tubeHW  = 3;   // half-width

    // Helper: rotate a local-space point around pivot
    const tubePt = (lx, ly) => ({
      x: pivotX + cosA * lx - sinA * ly,
      y: pivotY + sinA * lx + cosA * ly,
    });

    // Perpendicular direction for tube spacing
    const offsets = [-7, 0, 7];
    for (const off of offsets) {
      const px = pivotX - sinA * off;
      const py = pivotY + cosA * off;

      const rp = (lx, ly) => ({
        x: px + cosA * lx - sinA * ly,
        y: py + sinA * lx + cosA * ly,
      });

      // Tube body (dark steel)
      g.fillStyle(0x2e2e2e, 1);
      g.fillPoints([rp(0, -tubeHW), rp(tubeLen, -tubeHW), rp(tubeLen, tubeHW), rp(0, tubeHW)], true);

      // Lit top edge (simulated cylindrical sheen)
      g.fillStyle(0x686868, 0.85);
      g.fillPoints([rp(0, -tubeHW), rp(tubeLen, -tubeHW), rp(tubeLen, -tubeHW + 1.8), rp(0, -tubeHW + 1.8)], true);

      // Muzzle outer ring
      g.fillStyle(0x444444, 1);
      g.fillCircle(rp(tubeLen, 0).x, rp(tubeLen, 0).y, tubeHW + 2);

      // Muzzle bore (hollow dark centre)
      g.fillStyle(0x0a0a0a, 1);
      g.fillCircle(rp(tubeLen, 0).x, rp(tubeLen, 0).y, tubeHW - 1);
    }

    // Band clamp across all 3 tubes at mid-length
    g.fillStyle(0x555555, 0.9);
    g.fillPoints([
      tubePt(tubeLen * 0.48, -tubeHW - 8),
      tubePt(tubeLen * 0.53, -tubeHW - 8),
      tubePt(tubeLen * 0.53,  tubeHW + 8),
      tubePt(tubeLen * 0.48,  tubeHW + 8),
    ], true);

    // ── 7. Wheels (4 wheels, paired front and rear) ───────────────────────────
    const wheelY  = base - 7;
    const wheelR  = 10;
    const wheelXs = [x - 36, x - 20, x + 20, x + 36];

    for (const wx of wheelXs) {
      // Outer tyre — dark rubber
      g.fillStyle(0x111111, 1);
      g.fillCircle(wx, wheelY, wheelR);

      // Tyre highlight (upper-left arc, simulates ambient light)
      g.fillStyle(0x2e2e2e, 0.65);
      g.fillCircle(wx - 2, wheelY - 3, wheelR * 0.55);

      // Alloy rim
      g.fillStyle(0x4e4e4e, 1);
      g.fillCircle(wx, wheelY, wheelR - 3);

      // Rim spokes (3 lines)
      g.lineStyle(1, 0x666666, 0.7);
      for (let angle = 0; angle < Math.PI; angle += Math.PI / 3) {
        g.beginPath();
        g.moveTo(wx + Math.cos(angle) * 2, wheelY + Math.sin(angle) * 2);
        g.lineTo(wx + Math.cos(angle) * (wheelR - 4), wheelY + Math.sin(angle) * (wheelR - 4));
        g.strokePath();
        g.beginPath();
        g.moveTo(wx - Math.cos(angle) * 2, wheelY - Math.sin(angle) * 2);
        g.lineTo(wx - Math.cos(angle) * (wheelR - 4), wheelY - Math.sin(angle) * (wheelR - 4));
        g.strokePath();
      }

      // Hub cap
      g.fillStyle(0x888888, 1);
      g.fillCircle(wx, wheelY, 3);
      g.fillStyle(0xaaaaaa, 0.8);
      g.fillCircle(wx, wheelY, 1.5);
    }
  }

  _drawMissiles(time = 0) {
    for (const m of this._missiles) {
      MissileRenderer.draw(this._gfx, m, time);
    }
  }

  _drawInterceptors() {
    for (const ic of this._interceptors) {
      InterceptorRenderer.draw(this._gfx, ic);
    }
  }

  _drawExplosions() {
    const g = this._gfx;

    for (const exp of this._explosions) {
      const { x, y, radius: r, alpha: a } = exp;

      // Outermost translucent orange glow
      g.fillStyle(0xff4400, a * 0.18);
      g.fillCircle(x, y, r * 1.45);

      // Outer orange ring
      g.fillStyle(0xff6600, a * 0.42);
      g.fillCircle(x, y, r);

      // Mid yellow
      g.fillStyle(0xffcc00, a * 0.68);
      g.fillCircle(x, y, r * 0.58);

      // Inner bright yellow-white
      g.fillStyle(0xffee88, a * 0.85);
      g.fillCircle(x, y, r * 0.32);

      // Core white flash
      g.fillStyle(0xffffff, a * 0.95);
      g.fillCircle(x, y, r * 0.14);

      // Shockwave ring — expanding transparent circle
      g.lineStyle(1.5, 0xffaa00, a * 0.5);
      g.strokeCircle(x, y, r * 1.65);
    }
  }

  // ─── HUD ─────────────────────────────────────────────────────────────────────

  _updateHUD() {
    this._ui.updateScore(this._score.getScore());
    this._ui.updateHealth(this._health.getHealthPercent(), this._health.getHealth());
    this._ui.updateLevel(this._difficulty.getLevel());
  }
}
