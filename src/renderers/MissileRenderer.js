/**
 * MissileRenderer — Phaser-aware renderer, zero game logic.
 *
 * Draws each missile type with a distinct silhouette, colour scheme, and flame:
 *
 *   small  ("Gaza rocket")  — short, olive-green, unguided wobble, small dim flame
 *   medium                  — mid-length, military green, moderate flame
 *   large  ("Iran missile") — long, dark green + white stripes, canard fins,
 *                             bright layered flame
 *
 * Usage
 * ─────
 *   MissileRenderer.draw(gfx, missile, timeSeconds);
 *
 * Smoke is NOT drawn here — feed positions to SmokeTrailEmitter instead.
 * SMOKE_OPTS provides per-type options for the caller to pass to that emitter.
 */

/**
 * Rotate local point (lx, ly) around world origin (ox, oy) by precomputed cos/sin.
 * @returns {{x:number, y:number}}
 */
function rot(ox, oy, cos, sin, lx, ly) {
  return { x: ox + cos * lx - sin * ly, y: oy + sin * lx + cos * ly };
}

// ─── Per-type palettes ────────────────────────────────────────────────────────

const COLORS = {
  small: {
    base:  0x4e5e28,  // olive green
    shade: 0x323e18,  // dark olive
    nose:  0x1c1c1c,  // near-black tip
    fin:   0x28320e,  // very dark fin
  },
  medium: {
    base:  0x3d6b3d,  // military green
    shade: 0x274427,  // dark military
    nose:  0x222222,
    fin:   0x1e3c1e,
  },
  large: {
    base:  0x2d5a2d,  // deep military green
    shade: 0x1e3d1e,
    nose:  0x303030,
    fin:   0x1a351a,
    stripe: 0xddeedd, // white/pale stripe bands
  },
};

export class MissileRenderer {

  // ── Smoke emission config (pass these opts to SmokeTrailEmitter.emit) ──────

  static SMOKE_OPTS = {
    small:  { life: 0.65, radius: 1.8, maxRadius: 8,  alpha: 0.32, color: 0xaaaaaa },
    medium: { life: 0.85, radius: 2.5, maxRadius: 12, alpha: 0.38, color: 0x999999 },
    large:  { life: 1.1,  radius: 4.0, maxRadius: 20, alpha: 0.48, color: 0x777777 },
  };

  // ── Public entry point ─────────────────────────────────────────────────────

  /**
   * @param {Phaser.GameObjects.Graphics} gfx
   * @param {object}  missile   Missile entity  { x, y, vx, vy, type, radius, trail }
   * @param {number}  [time=0]  elapsed seconds — used for small-rocket wobble
   */
  static draw(gfx, missile, time = 0) {
    if (!missile.active) return;

    const { type, radius, trail } = missile;
    let { x, y, vx, vy } = missile;

    // Small rockets are unguided — add a slight visual wobble
    if (type === 'small') {
      x += Math.sin(time * 18 + missile.x * 0.05) * 0.9;
      y += Math.cos(time * 15 + missile.y * 0.05) * 0.6;
    }

    const angle = Math.atan2(vy, vx);
    const cos   = Math.cos(angle);
    const sin   = Math.sin(angle);
    const r     = (lx, ly) => rot(x, y, cos, sin, lx, ly);

    const L  = radius * 3.2;    // half body length (natural scale from radius)
    const Rr = radius * 0.72;   // body half-width

    // Fire exhaust — drawn first so it sits behind the body
    MissileRenderer._drawFlame(gfx, trail, L, Rr, type);

    const c = COLORS[type];
    if (type === 'large') {
      MissileRenderer._drawLarge(gfx, r, L, Rr, c);
    } else {
      MissileRenderer._drawStandard(gfx, r, L, Rr, c);
    }
  }

  // ─── Flame / exhaust ────────────────────────────────────────────────────────

  static _drawFlame(gfx, trail, L, Rr, type) {
    const len = trail.length;
    for (let i = 0; i < len; i++) {
      const p  = trail[i];
      const t  = 1 - i / len;   // 1 = most recent (hottest), 0 = oldest

      if (type === 'large') {
        gfx.fillStyle(0xffffff, t * 0.60); gfx.fillCircle(p.x, p.y, Rr * 0.45 * t);
        gfx.fillStyle(0xffee44, t * 0.70); gfx.fillCircle(p.x, p.y, Rr * 0.75 * t);
        gfx.fillStyle(0xff6600, t * 0.48); gfx.fillCircle(p.x, p.y, Rr * 1.10 * t);
      } else if (type === 'medium') {
        gfx.fillStyle(0xffcc00, t * 0.52); gfx.fillCircle(p.x, p.y, Rr * 0.65 * t);
        gfx.fillStyle(0xff5500, t * 0.38); gfx.fillCircle(p.x, p.y, Rr * 0.90 * t);
      } else {
        // small — dim, short
        gfx.fillStyle(0xffaa00, t * 0.38); gfx.fillCircle(p.x, p.y, Rr * 0.55 * t);
      }
    }
  }

  // ─── Small + Medium body ────────────────────────────────────────────────────

  static _drawStandard(gfx, r, L, Rr, c) {
    // Rear fins
    gfx.fillStyle(c.fin, 0.92);
    gfx.fillPoints([r(-L * 0.42, -Rr), r(-L * 0.76, -Rr * 2.5), r(-L * 0.22, -Rr)], true);
    gfx.fillPoints([r(-L * 0.42,  Rr), r(-L * 0.76,  Rr * 2.5), r(-L * 0.22,  Rr)], true);

    // Body — shaded half
    gfx.fillStyle(c.shade, 1);
    gfx.fillPoints([r(-L * 0.5, 0), r(-L * 0.5, Rr), r(L * 0.35, Rr), r(L * 0.35, 0)], true);

    // Body — lit half
    gfx.fillStyle(c.base, 1);
    gfx.fillPoints([r(-L * 0.5, -Rr), r(-L * 0.5, 0), r(L * 0.35, 0), r(L * 0.35, -Rr)], true);

    // Nose cone
    gfx.fillStyle(c.nose, 1);
    gfx.fillPoints([r(L * 0.35, -Rr), r(L * 0.58, 0), r(L * 0.35, Rr)], true);

    // Specular highlight
    gfx.fillStyle(0xffffff, 0.20);
    gfx.fillPoints([r(-L * 0.48, -Rr * 0.80), r(L * 0.32, -Rr * 0.80),
                    r(L * 0.32,  -Rr * 0.28), r(-L * 0.48, -Rr * 0.28)], true);

    // Nose tip glow
    const tip = r(L * 0.58, 0);
    gfx.fillStyle(0xffffff, 0.55);
    gfx.fillCircle(tip.x, tip.y, Rr * 0.28);
  }

  // ─── Large body (Iran-style) ────────────────────────────────────────────────

  static _drawLarge(gfx, r, L, Rr, c) {
    // Swept rear fins (larger)
    gfx.fillStyle(c.fin, 0.95);
    gfx.fillPoints([r(-L * 0.48, -Rr), r(-L * 0.90, -Rr * 3.2), r(-L * 0.10, -Rr)], true);
    gfx.fillPoints([r(-L * 0.48,  Rr), r(-L * 0.90,  Rr * 3.2), r(-L * 0.10,  Rr)], true);

    // Small canard fins near nose
    gfx.fillStyle(c.fin, 0.85);
    gfx.fillPoints([r(L * 0.22, -Rr), r(L * 0.39, -Rr * 1.9), r(L * 0.39, -Rr)], true);
    gfx.fillPoints([r(L * 0.22,  Rr), r(L * 0.39,  Rr * 1.9), r(L * 0.39,  Rr)], true);

    // Body — shaded half
    gfx.fillStyle(c.shade, 1);
    gfx.fillPoints([r(-L * 0.5, 0), r(-L * 0.5, Rr), r(L * 0.32, Rr), r(L * 0.32, 0)], true);

    // Body — lit half
    gfx.fillStyle(c.base, 1);
    gfx.fillPoints([r(-L * 0.5, -Rr), r(-L * 0.5, 0), r(L * 0.32, 0), r(L * 0.32, -Rr)], true);

    // White stripe bands (identification markings)
    gfx.fillStyle(c.stripe, 0.55);
    gfx.fillPoints([r(-L * 0.27, -Rr), r(-L * 0.27, Rr), r(-L * 0.17, Rr), r(-L * 0.17, -Rr)], true);
    gfx.fillPoints([r(L * 0.06,  -Rr), r(L * 0.06,  Rr), r(L * 0.16,  Rr), r(L * 0.16,  -Rr)], true);

    // Cylindrical ogive transition
    gfx.fillStyle(c.shade, 1);
    gfx.fillPoints([r(L * 0.32, -Rr), r(L * 0.32, Rr), r(L * 0.47, Rr * 0.55), r(L * 0.47, -Rr * 0.55)], true);

    // Pointed nose cone
    gfx.fillStyle(c.nose, 1);
    gfx.fillPoints([r(L * 0.47, -Rr * 0.55), r(L * 0.66, 0), r(L * 0.47, Rr * 0.55)], true);

    // Specular highlight
    gfx.fillStyle(0xffffff, 0.22);
    gfx.fillPoints([r(-L * 0.48, -Rr * 0.78), r(L * 0.43, -Rr * 0.78),
                    r(L * 0.43,  -Rr * 0.28), r(-L * 0.48, -Rr * 0.28)], true);

    // Nose tip bright spot
    const tip = r(L * 0.66, 0);
    gfx.fillStyle(0xffffff, 0.72);
    gfx.fillCircle(tip.x, tip.y, Rr * 0.30);
  }
}
