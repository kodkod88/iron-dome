/**
 * InterceptorRenderer — Phaser-aware renderer, zero game logic.
 *
 * Draws a Tamir-style interceptor:
 *   • Light-grey cylindrical body with a pointed dark nose
 *   • Swept rear fins  + small canard fins near nose (dark grey)
 *   • Blue identification stripe
 *   • Bright engine flame: white core → yellow → orange
 *
 * Usage
 * ─────
 *   InterceptorRenderer.draw(gfx, interceptor);
 *
 * Smoke trail is NOT drawn here — feed the entity's smoke[] positions to
 * SmokeTrailEmitter (the caller's responsibility).
 * The interceptor.smoke[] array is still read here to derive the travel angle.
 */

/**
 * Rotate local point (lx, ly) around world origin (ox, oy).
 * @returns {{x:number, y:number}}
 */
function rot(ox, oy, cos, sin, lx, ly) {
  return { x: ox + cos * lx - sin * ly, y: oy + sin * lx + cos * ly };
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const BODY_LIT   = 0xd0d8e0;   // light grey (lit side)
const BODY_SHADE = 0x8898a8;   // mid grey   (shaded side)
const FIN_COLOR  = 0x4a5a6a;   // dark blue-grey fins
const NOSE_COLOR = 0x2e3540;   // dark charcoal nose tip
const STRIPE     = 0x0055bb;   // blue identification band

export class InterceptorRenderer {

  // ── Smoke emission config (pass to SmokeTrailEmitter.emit) ───────────────
  static SMOKE_OPTS = { life: 0.75, radius: 1.8, maxRadius: 9, alpha: 0.28, color: 0xccccdd };

  // ── Public entry point ────────────────────────────────────────────────────

  /**
   * @param {Phaser.GameObjects.Graphics} gfx
   * @param {object} interceptor  Interceptor entity  { x, y, smoke[] }
   */
  static draw(gfx, interceptor) {
    if (!interceptor.active) return;

    const { x, y, smoke } = interceptor;

    // Derive travel angle from smoke history (1-frame-old position → current)
    let angle = -Math.PI / 2;           // default: straight up
    if (smoke.length > 0) {
      angle = Math.atan2(y - smoke[0].y, x - smoke[0].x);
    }

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const r   = (lx, ly) => rot(x, y, cos, sin, lx, ly);

    const L  = 11;    // half-length px
    const Rr = 3.2;   // half-width  px

    // ── Engine flame (behind body) ──────────────────────────────────────────
    const fx = x + Math.cos(angle + Math.PI) * L * 0.62;
    const fy = y + Math.sin(angle + Math.PI) * L * 0.62;
    gfx.fillStyle(0xff5500, 0.20); gfx.fillCircle(fx, fy, 9.5);
    gfx.fillStyle(0xffcc00, 0.55); gfx.fillCircle(fx, fy, 5.8);
    gfx.fillStyle(0xffffff, 0.92); gfx.fillCircle(fx, fy, 2.8);

    // ── Swept rear fins ─────────────────────────────────────────────────────
    gfx.fillStyle(FIN_COLOR, 0.92);
    gfx.fillPoints([r(-L * 0.55, -Rr), r(-L * 0.94, -Rr * 2.7), r(-L * 0.28, -Rr)], true);
    gfx.fillPoints([r(-L * 0.55,  Rr), r(-L * 0.94,  Rr * 2.7), r(-L * 0.28,  Rr)], true);

    // ── Body — shaded half ──────────────────────────────────────────────────
    gfx.fillStyle(BODY_SHADE, 1);
    gfx.fillPoints([r(-L * 0.55, 0), r(-L * 0.55, Rr), r(L * 0.38, Rr), r(L * 0.38, 0)], true);

    // ── Body — lit half ─────────────────────────────────────────────────────
    gfx.fillStyle(BODY_LIT, 1);
    gfx.fillPoints([r(-L * 0.55, -Rr), r(-L * 0.55, 0), r(L * 0.38, 0), r(L * 0.38, -Rr)], true);

    // ── Blue identification stripe ──────────────────────────────────────────
    gfx.fillStyle(STRIPE, 0.75);
    gfx.fillPoints([r(-L * 0.10, -Rr), r(-L * 0.10, Rr), r(L * 0.05, Rr), r(L * 0.05, -Rr)], true);

    // ── Small canard fins near nose ─────────────────────────────────────────
    gfx.fillStyle(FIN_COLOR, 0.80);
    gfx.fillPoints([r(L * 0.20, -Rr), r(L * 0.36, -Rr * 2.0), r(L * 0.38, -Rr)], true);
    gfx.fillPoints([r(L * 0.20,  Rr), r(L * 0.36,  Rr * 2.0), r(L * 0.38,  Rr)], true);

    // ── Pointed nose cone ───────────────────────────────────────────────────
    gfx.fillStyle(NOSE_COLOR, 1);
    gfx.fillPoints([r(L * 0.38, -Rr), r(L * 0.72, 0), r(L * 0.38, Rr)], true);

    // ── Specular highlight ──────────────────────────────────────────────────
    gfx.fillStyle(0xffffff, 0.32);
    gfx.fillPoints([r(-L * 0.53, -Rr * 0.75), r(L * 0.36, -Rr * 0.75),
                    r(L * 0.36,  -Rr * 0.28), r(-L * 0.53, -Rr * 0.28)], true);
  }
}
