import { Missile, MISSILE_TYPES } from '../src/entities/Missile.js';

describe('MISSILE_TYPES constants', () => {
  // Speeds tuned for ~4-5s / 5-6s / 6-7s travel time across ~572px drop
  test('small missile has speed 125, damage 5, radius 6', () => {
    expect(MISSILE_TYPES.small.speed).toBe(125);
    expect(MISSILE_TYPES.small.damage).toBe(5);
    expect(MISSILE_TYPES.small.radius).toBe(6);
  });

  test('medium missile has speed 100, damage 10, radius 10', () => {
    expect(MISSILE_TYPES.medium.speed).toBe(100);
    expect(MISSILE_TYPES.medium.damage).toBe(10);
    expect(MISSILE_TYPES.medium.radius).toBe(10);
  });

  test('large missile has speed 82, damage 20, radius 16', () => {
    expect(MISSILE_TYPES.large.speed).toBe(82);
    expect(MISSILE_TYPES.large.damage).toBe(20);
    expect(MISSILE_TYPES.large.radius).toBe(16);
  });
});

describe('Missile constructor', () => {
  test('assigns type, radius, and damage from MISSILE_TYPES', () => {
    const m = new Missile({ type: 'medium', x: 100, y: 0, targetX: 100, targetY: 600 });
    expect(m.type).toBe('medium');
    expect(m.radius).toBe(10);
    expect(m.damage).toBe(10);
  });

  test('starts active', () => {
    const m = new Missile({ type: 'small', x: 0, y: 0, targetX: 0, targetY: 100 });
    expect(m.active).toBe(true);
  });

  test('starts with empty trail', () => {
    const m = new Missile({ type: 'small', x: 0, y: 0, targetX: 0, targetY: 100 });
    expect(m.trail).toEqual([]);
  });

  test('vertical fall: vx ≈ 0, vy = speed when target is directly below', () => {
    const m = new Missile({ type: 'small', x: 400, y: 0, targetX: 400, targetY: 600 });
    expect(m.vx).toBeCloseTo(0, 5);
    expect(m.vy).toBeCloseTo(MISSILE_TYPES.small.speed, 5);
  });

  test('speedMultiplier scales velocity proportionally', () => {
    const m1 = new Missile({ type: 'small', x: 0, y: 0, targetX: 0, targetY: 100 });
    const m2 = new Missile({ type: 'small', x: 0, y: 0, targetX: 0, targetY: 100, speedMultiplier: 2 });
    expect(m2.vy).toBeCloseTo(m1.vy * 2, 5);
  });

  test('diagonal direction is correctly normalised', () => {
    // 45° angle: dx = dy = 300
    const m = new Missile({ type: 'large', x: 100, y: 0, targetX: 400, targetY: 300 });
    const expectedSpeed = MISSILE_TYPES.large.speed;
    const totalSpeed = Math.sqrt(m.vx ** 2 + m.vy ** 2);
    expect(totalSpeed).toBeCloseTo(expectedSpeed, 4);
  });
});

describe('Missile.update()', () => {
  test('moves position by velocity × dt', () => {
    const m = new Missile({ type: 'small', x: 100, y: 0, targetX: 100, targetY: 600 });
    // vy = MISSILE_TYPES.small.speed (straight down)
    m.update(0.5);
    expect(m.x).toBeCloseTo(100, 3);
    expect(m.y).toBeCloseTo(MISSILE_TYPES.small.speed * 0.5, 3);
  });

  test('appends position to trail on each update', () => {
    const m = new Missile({ type: 'small', x: 0, y: 0, targetX: 0, targetY: 600 });
    m.update(0.1);
    expect(m.trail.length).toBe(1);
    m.update(0.1);
    expect(m.trail.length).toBe(2);
  });

  test('most recent trail entry is current position', () => {
    const m = new Missile({ type: 'small', x: 0, y: 0, targetX: 0, targetY: 600 });
    m.update(0.5);
    expect(m.trail[0].x).toBeCloseTo(m.x, 3);
    expect(m.trail[0].y).toBeCloseTo(m.y, 3);
  });

  test('trail is capped at 12 entries', () => {
    const m = new Missile({ type: 'small', x: 0, y: 0, targetX: 0, targetY: 600 });
    for (let i = 0; i < 20; i++) m.update(0.05);
    expect(m.trail.length).toBe(12);
  });
});
