/**
 * CollisionService — pure JS, stateless.
 * Circle-based collision detection between interceptors and missiles.
 */
export class CollisionService {
  /**
   * Returns true when two circles overlap.
   * Uses squared-distance comparison to avoid unnecessary sqrt.
   * @param {{x:number, y:number, radius:number}} a
   * @param {{x:number, y:number, radius:number}} b
   * @returns {boolean}
   */
  check(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const combinedRadius = a.radius + b.radius;
    return dx * dx + dy * dy < combinedRadius * combinedRadius;
  }

  /**
   * Find all colliding interceptor–missile pairs.
   * Skips objects where active === false.
   * @param {import('../entities/Interceptor.js').Interceptor[]} interceptors
   * @param {import('../entities/Missile.js').Missile[]} missiles
   * @returns {Array<{interceptor: object, missile: object}>}
   */
  checkInterceptorMissile(interceptors, missiles) {
    const hits = [];
    for (const interceptor of interceptors) {
      if (!interceptor.active) continue;
      for (const missile of missiles) {
        if (!missile.active) continue;
        if (this.check(interceptor, missile)) {
          hits.push({ interceptor, missile });
        }
      }
    }
    return hits;
  }

  /**
   * Return all active missiles whose centre falls within `radius` of point (cx, cy).
   * Used for area-shot explosions.
   * @param {number} cx
   * @param {number} cy
   * @param {number} radius  blast radius
   * @param {import('../entities/Missile.js').Missile[]} missiles
   * @returns {import('../entities/Missile.js').Missile[]}
   */
  checkAreaDamage(cx, cy, radius, missiles) {
    return missiles.filter((m) => {
      if (!m.active) return false;
      const dx = m.x - cx;
      const dy = m.y - cy;
      return dx * dx + dy * dy < (radius + m.radius) ** 2;
    });
  }
}
