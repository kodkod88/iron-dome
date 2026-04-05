import { ScoreService } from '../src/services/ScoreService.js';

describe('ScoreService', () => {
  let svc;

  beforeEach(() => {
    svc = new ScoreService();
  });

  test('score starts at 0', () => {
    expect(svc.getScore()).toBe(0);
  });

  test('addInterceptScore("small") adds 10 points', () => {
    svc.addInterceptScore('small');
    expect(svc.getScore()).toBe(10);
  });

  test('addInterceptScore("medium") adds 20 points', () => {
    svc.addInterceptScore('medium');
    expect(svc.getScore()).toBe(20);
  });

  test('addInterceptScore("large") adds 40 points', () => {
    svc.addInterceptScore('large');
    expect(svc.getScore()).toBe(40);
  });

  test('multiple intercepts accumulate correctly', () => {
    svc.addInterceptScore('small');   // 10
    svc.addInterceptScore('medium');  // 20
    svc.addInterceptScore('large');   // 40
    expect(svc.getScore()).toBe(70);
  });

  test('three small intercepts sum to 30', () => {
    svc.addInterceptScore('small');
    svc.addInterceptScore('small');
    svc.addInterceptScore('small');
    expect(svc.getScore()).toBe(30);
  });

  test('reset() sets score back to 0', () => {
    svc.addInterceptScore('large');
    svc.addInterceptScore('large');
    svc.reset();
    expect(svc.getScore()).toBe(0);
  });

  test('can accumulate score again after reset', () => {
    svc.addInterceptScore('small');
    svc.reset();
    svc.addInterceptScore('medium');
    expect(svc.getScore()).toBe(20);
  });

  test('unknown type adds 0 points', () => {
    svc.addInterceptScore('unknown');
    expect(svc.getScore()).toBe(0);
  });
});
