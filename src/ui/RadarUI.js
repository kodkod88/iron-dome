/**
 * RadarUI — Phaser-aware.
 *
 * Semi-circular radar scope: flat edge at the bottom, dome curving upward.
 * Represents the truck's sky-scanning sensor — the truck sits at the
 * centre of the flat base, and only objects above truck level are shown.
 *
 * ── Coordinate conversion ──────────────────────────────────────────────────
 * All world objects are converted to radar screen coords via polar projection
 * relative to the truck's world position (truckWorldX, truckWorldY):
 *
 *   dx    = worldX − truckWorldX        (horizontal; +ve = right)
 *   dy    = truckWorldY − worldY        (vertical;   +ve = ABOVE truck)
 *   dist  = sqrt(dx² + dy²)
 *   scale = clamp(dist / maxDist, 0, 1) (far objects clamp to radar rim)
 *   nx    = dx / dist,   ny = dy / dist  (unit direction)
 *
 *   bx    = cx + nx · scale · r          (radar screen x)
 *   by    = cy − ny · scale · r          (radar screen y; minus: screen-y inverts)
 *
 * Objects with dy ≤ 0 (at or below the truck) are not displayed.
 *
 * ── Sweep ──────────────────────────────────────────────────────────────────
 * The sweep line rotates from angle π (left horizon) to 2π (right horizon),
 * covering exactly 180 ° in 2 seconds, then resets to π.
 *
 * In JS Math convention (y-down screen):
 *   angle = π   → cos = −1, sin = 0 → left edge (cx−r, cy)
 *   angle = 3π/2 → cos = 0, sin = −1 → top centre (cx, cy−r)
 *   angle = 2π   → cos = 1, sin = 0  → right edge (cx+r, cy)
 */

const SWEEP_PERIOD  = 2.0;        // seconds for one full left→right sweep
const RADAR_DEPTH   = 9;          // behind HUD (10) but above city (1)
const UPDATE_HZ     = 10;         // blip redraw rate (fps)
const FAN_WIDTH     = 0.6;        // radians — trailing glow arc behind sweep line

export class RadarUI {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} worldW           canvas width
   * @param {number} worldH           canvas height
   * @param {number} [truckWorldX]    truck world x (default: worldW/2)
   * @param {number} [truckWorldY]    truck world y (default: worldH * 0.9)
   * @param {number} [cx]             radar flat-edge centre x (default: bottom-left)
   * @param {number} [cy]             radar flat-edge centre y (default: worldH − 12)
   * @param {number} [r=100]          radar radius in px
   */
  constructor(
    scene, worldW, worldH,
    truckWorldX = worldW / 2,
    truckWorldY = worldH * 0.905,
    cx          = 105,
    cy          = worldH - 12,
    r           = 100
  ) {
    this._scene       = scene;
    this._worldW      = worldW;
    this._worldH      = worldH;
    this._truckWorldX = truckWorldX;
    this._truckWorldY = truckWorldY;
    this._cx          = cx;
    this._cy          = cy;
    this._r           = r;
    this._maxDist     = truckWorldY;   // top of screen is the radar's maximum range

    // Sweep: t ∈ [0, SWEEP_PERIOD) maps to angle ∈ [π, 2π)
    this._sweepT   = 0;
    this._drawT    = 0;  // accumulator for UPDATE_HZ throttle

    this._gfx = scene.add.graphics()
      .setDepth(RADAR_DEPTH)
      .setScrollFactor(0);
  }

  /**
   * Advance sweep and redraw at UPDATE_HZ.
   * Called every frame from GameScene._renderFrame() with actual dt.
   * @param {number}   dt            seconds since last frame
   * @param {object[]} missiles      active Missile array
   * @param {object[]} interceptors  active Interceptor array
   */
  update(dt, missiles, interceptors) {
    this._sweepT = (this._sweepT + dt) % SWEEP_PERIOD;
    this._drawT  += dt;

    if (this._drawT >= 1 / UPDATE_HZ) {
      this._drawT = 0;
      this._draw(missiles, interceptors);
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  /** Current sweep angle in radians (π = left, 2π = right). */
  get _sweepAngle() {
    return Math.PI + (this._sweepT / SWEEP_PERIOD) * Math.PI;
  }

  /**
   * Convert a world position to radar screen coordinates.
   * Returns null if the object is below or at truck level.
   * @param {number} wx
   * @param {number} wy
   * @returns {{x:number, y:number}|null}
   */
  _worldToRadar(wx, wy) {
    const dx = wx - this._truckWorldX;
    const dy = this._truckWorldY - wy; // +ve = above truck
    if (dy <= 0) return null;

    const dist  = Math.sqrt(dx * dx + dy * dy) || 1;
    const scale = Math.min(dist / this._maxDist, 1);
    const nx    = dx / dist;
    const ny    = dy / dist;

    return {
      x: this._cx + nx * scale * this._r,
      y: this._cy - ny * scale * this._r,
    };
  }

  _draw(missiles, interceptors) {
    const g   = this._gfx;
    const cx  = this._cx;
    const cy  = this._cy;
    const r   = this._r;
    const sa  = this._sweepAngle;
    const ARC_STEPS = 40;

    g.clear();

    // ── Semi-circle background (dome up, flat base down) ─────────────────────
    // Arc from angle π → 2π using standard Math trig (passes through 3π/2 = top)
    g.fillStyle(0x001a00, 0.82);
    g.beginPath();
    g.moveTo(cx - r, cy);
    for (let i = 0; i <= ARC_STEPS; i++) {
      const a = Math.PI + (Math.PI * i / ARC_STEPS);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    g.fillPath();

    // ── Distance rings (2 arcs at 1/3 and 2/3 of max range) ─────────────────
    for (const frac of [0.33, 0.66]) {
      const rr = r * frac;
      g.lineStyle(0.6, 0x004400, 0.4);
      g.beginPath();
      g.moveTo(cx - rr, cy);
      for (let i = 0; i <= ARC_STEPS; i++) {
        const a = Math.PI + (Math.PI * i / ARC_STEPS);
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.strokePath();
    }

    // ── Vertical centre line (straight-up reference) ─────────────────────────
    g.lineStyle(0.5, 0x003300, 0.3);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx, cy - r);
    g.strokePath();

    // ── Sweep trailing fan ───────────────────────────────────────────────────
    const fanStart = Math.max(Math.PI, sa - FAN_WIDTH);
    const fanEnd   = Math.min(2 * Math.PI, sa);
    const fanSteps = 12;
    g.fillStyle(0x00ff55, 0.07);
    g.beginPath();
    g.moveTo(cx, cy);
    for (let i = 0; i <= fanSteps; i++) {
      const a = fanStart + ((fanEnd - fanStart) * i / fanSteps);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    g.fillPath();

    // ── Sweep line ───────────────────────────────────────────────────────────
    // Clamp sweep endpoint to upper semi-circle range
    if (sa >= Math.PI && sa <= 2 * Math.PI) {
      g.lineStyle(1.5, 0x00ff55, 0.88);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(sa) * r, cy + Math.sin(sa) * r);
      g.strokePath();
    }

    // ── Missile blips (red) ──────────────────────────────────────────────────
    for (const m of missiles) {
      if (!m.active) continue;
      const pt = this._worldToRadar(m.x, m.y);
      if (!pt) continue;
      // Fade near rim
      const edgeDist = Math.sqrt((pt.x - cx) ** 2 + (pt.y - cy) ** 2);
      const alpha = 0.7 + 0.25 * (1 - edgeDist / r);
      g.fillStyle(0xff3333, alpha);
      g.fillCircle(pt.x, pt.y, 3.5);
      g.fillStyle(0xff5555, alpha * 0.22);
      g.fillCircle(pt.x, pt.y, 6.5);
    }

    // ── Interceptor blips (blue) ─────────────────────────────────────────────
    for (const ic of interceptors) {
      if (!ic.active) continue;
      const pt = this._worldToRadar(ic.x, ic.y);
      if (!pt) continue;
      const edgeDist = Math.sqrt((pt.x - cx) ** 2 + (pt.y - cy) ** 2);
      const alpha = 0.7 + 0.25 * (1 - edgeDist / r);
      g.fillStyle(0x44aaff, alpha);
      g.fillCircle(pt.x, pt.y, 2.8);
    }

    // ── Flat base line ───────────────────────────────────────────────────────
    g.lineStyle(1, 0x006622, 0.5);
    g.beginPath();
    g.moveTo(cx - r, cy);
    g.lineTo(cx + r, cy);
    g.strokePath();

    // ── Truck position marker (small notch at base centre) ───────────────────
    g.fillStyle(0x00ff88, 0.8);
    g.fillTriangle(cx - 3, cy, cx + 3, cy, cx, cy - 6);

    // ── Rim ──────────────────────────────────────────────────────────────────
    g.lineStyle(1.2, 0x00bb44, 0.65);
    g.beginPath();
    g.moveTo(cx - r, cy);
    for (let i = 0; i <= ARC_STEPS; i++) {
      const a = Math.PI + (Math.PI * i / ARC_STEPS);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.lineTo(cx + r, cy);
    g.strokePath();
  }

  /** Release the graphics object. */
  destroy() {
    this._gfx.destroy();
  }
}
