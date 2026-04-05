import { DifficultyService } from '../src/services/DifficultyService.js';

describe('DifficultyService — level calculation', () => {
  test('starts at level 1', () => {
    const d = new DifficultyService();
    expect(d.getLevel()).toBe(1);
  });

  test('reaches level 2 after 30 000 ms', () => {
    const d = new DifficultyService();
    d.update(30_000);
    expect(d.getLevel()).toBe(2);
  });

  test('reaches level 3 after 60 000 ms', () => {
    const d = new DifficultyService();
    d.update(60_000);
    expect(d.getLevel()).toBe(3);
  });

  test('level does not advance between thresholds', () => {
    const d = new DifficultyService();
    d.update(29_999);
    expect(d.getLevel()).toBe(1);
  });
});

describe('DifficultyService — spawn rate', () => {
  test('spawn rate is 2000 ms at level 1', () => {
    const d = new DifficultyService();
    expect(d.getSpawnRate()).toBe(2000);
  });

  test('spawn rate is 1800 ms at level 2', () => {
    const d = new DifficultyService();
    d.update(30_000);
    expect(d.getSpawnRate()).toBe(1800);
  });

  test('spawn rate is floored at 500 ms', () => {
    const d = new DifficultyService();
    // Level 9 → 2000 - 8*200 = 400 → clamped to 500
    d.update(240_000);
    expect(d.getSpawnRate()).toBe(500);
  });
});

describe('DifficultyService — speed multiplier', () => {
  test('multiplier is 1.0 at level 1', () => {
    const d = new DifficultyService();
    expect(d.getSpeedMultiplier()).toBeCloseTo(1.0);
  });

  test('multiplier is 1.08 at level 2 (8% increase per level)', () => {
    const d = new DifficultyService();
    d.update(30_000);
    expect(d.getSpeedMultiplier()).toBeCloseTo(1.08);
  });

  test('multiplier is 1.16 at level 3', () => {
    const d = new DifficultyService();
    d.update(60_000);
    expect(d.getSpeedMultiplier()).toBeCloseTo(1.16);
  });
});

describe('DifficultyService — large missile chance', () => {
  test('large chance is 0.1 at level 1', () => {
    const d = new DifficultyService();
    expect(d.getLargeMissileChance()).toBeCloseTo(0.1);
  });

  test('large chance is 0.15 at level 2', () => {
    const d = new DifficultyService();
    d.update(30_000);
    expect(d.getLargeMissileChance()).toBeCloseTo(0.15);
  });

  test('large chance is capped at 0.5', () => {
    const d = new DifficultyService();
    d.update(10_000_000); // far future
    expect(d.getLargeMissileChance()).toBe(0.5);
  });
});

describe('DifficultyService — getMissileType()', () => {
  test('returns "large" when random is below large chance', () => {
    const d = new DifficultyService();
    jest.spyOn(Math, 'random').mockReturnValue(0); // 0 < 0.1 → large
    expect(d.getMissileType()).toBe('large');
    Math.random.mockRestore();
  });

  test('returns "medium" when random is in the medium band', () => {
    const d = new DifficultyService();
    // large chance = 0.1, medium band = 0.1–0.4
    jest.spyOn(Math, 'random').mockReturnValue(0.2);
    expect(d.getMissileType()).toBe('medium');
    Math.random.mockRestore();
  });

  test('returns "small" when random is above large+medium band', () => {
    const d = new DifficultyService();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(d.getMissileType()).toBe('small');
    Math.random.mockRestore();
  });
});

describe('DifficultyService — reset()', () => {
  test('reset brings level back to 1', () => {
    const d = new DifficultyService();
    d.update(90_000);
    expect(d.getLevel()).toBe(4);
    d.reset();
    expect(d.getLevel()).toBe(1);
  });

  test('reset restores spawn rate to 2000', () => {
    const d = new DifficultyService();
    d.update(90_000);
    d.reset();
    expect(d.getSpawnRate()).toBe(2000);
  });
});
