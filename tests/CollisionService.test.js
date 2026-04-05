import { CollisionService } from '../src/services/CollisionService.js';

const makeCircle = (x, y, radius, active = true) => ({ x, y, radius, active });

describe('CollisionService.check()', () => {
  const svc = new CollisionService();

  test('returns true when circles overlap', () => {
    const a = makeCircle(0, 0, 10);
    const b = makeCircle(15, 0, 10); // distance=15, combined radii=20 → overlap
    expect(svc.check(a, b)).toBe(true);
  });

  test('returns false when circles do not overlap', () => {
    const a = makeCircle(0, 0, 5);
    const b = makeCircle(20, 0, 5); // distance=20, combined radii=10 → no overlap
    expect(svc.check(a, b)).toBe(false);
  });

  test('returns false when circles are exactly touching (boundary excluded)', () => {
    // distance === sum of radii → not strictly less than, so false
    const a = makeCircle(0, 0, 5);
    const b = makeCircle(10, 0, 5); // distance=10, combined=10 → boundary
    expect(svc.check(a, b)).toBe(false);
  });

  test('returns true when one circle contains the other', () => {
    const a = makeCircle(0, 0, 50);
    const b = makeCircle(1, 1, 5);
    expect(svc.check(a, b)).toBe(true);
  });

  test('works correctly in two dimensions', () => {
    const a = makeCircle(0, 0, 10);
    const b = makeCircle(6, 8, 5); // distance=10, combined=15 → overlap
    expect(svc.check(a, b)).toBe(true);
  });
});

describe('CollisionService.checkInterceptorMissile()', () => {
  const svc = new CollisionService();

  test('returns empty array when no entities exist', () => {
    expect(svc.checkInterceptorMissile([], [])).toEqual([]);
  });

  test('returns empty array when circles do not overlap', () => {
    const interceptors = [makeCircle(0, 0, 5)];
    const missiles = [makeCircle(100, 100, 5)];
    expect(svc.checkInterceptorMissile(interceptors, missiles)).toHaveLength(0);
  });

  test('returns one hit pair when circles overlap', () => {
    const interceptors = [makeCircle(0, 0, 10)];
    const missiles = [makeCircle(5, 0, 10)];
    const hits = svc.checkInterceptorMissile(interceptors, missiles);
    expect(hits).toHaveLength(1);
    expect(hits[0].interceptor).toBe(interceptors[0]);
    expect(hits[0].missile).toBe(missiles[0]);
  });

  test('skips inactive interceptors', () => {
    const interceptors = [makeCircle(0, 0, 10, false)]; // inactive
    const missiles = [makeCircle(0, 0, 10)];
    expect(svc.checkInterceptorMissile(interceptors, missiles)).toHaveLength(0);
  });

  test('skips inactive missiles', () => {
    const interceptors = [makeCircle(0, 0, 10)];
    const missiles = [makeCircle(0, 0, 10, false)]; // inactive
    expect(svc.checkInterceptorMissile(interceptors, missiles)).toHaveLength(0);
  });

  test('returns all pairs when multiple overlaps exist', () => {
    const interceptors = [makeCircle(0, 0, 10), makeCircle(50, 0, 10)];
    const missiles = [makeCircle(0, 0, 10), makeCircle(50, 0, 10)];
    // interceptor[0] ↔ missile[0], interceptor[1] ↔ missile[1]
    const hits = svc.checkInterceptorMissile(interceptors, missiles);
    expect(hits).toHaveLength(2);
  });

  test('one interceptor can collide with multiple missiles', () => {
    const interceptors = [makeCircle(0, 0, 30)];
    const missiles = [makeCircle(5, 0, 5), makeCircle(-5, 0, 5)];
    const hits = svc.checkInterceptorMissile(interceptors, missiles);
    expect(hits).toHaveLength(2);
  });
});
