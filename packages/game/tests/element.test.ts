// tests/element.test.ts
// 五灵属性系统单元测试

import { describe, it, expect } from 'vitest';
import { elementModifier, COUNTERS } from '../src/data/element';
import type { Element } from '../src/core/types';

describe('五灵属性系统', () => {
  it('风克雷', () => {
    expect(COUNTERS.wind).toBe('thunder');
    expect(elementModifier('wind', 'thunder')).toBe(1.5);
  });

  it('雷克水', () => {
    expect(COUNTERS.thunder).toBe('water');
    expect(elementModifier('thunder', 'water')).toBe(1.5);
  });

  it('水克火', () => {
    expect(COUNTERS.water).toBe('fire');
    expect(elementModifier('water', 'fire')).toBe(1.5);
  });

  it('火克土', () => {
    expect(COUNTERS.fire).toBe('earth');
    expect(elementModifier('fire', 'earth')).toBe(1.5);
  });

  it('土克风', () => {
    expect(COUNTERS.earth).toBe('wind');
    expect(elementModifier('earth', 'wind')).toBe(1.5);
  });

  it('被克方伤害减少', () => {
    // 雷被风克，所以雷攻击风是被克
    expect(elementModifier('thunder', 'wind')).toBe(0.75);
  });

  it('无关属性正常伤害', () => {
    expect(elementModifier('fire', 'thunder')).toBe(1);
    expect(elementModifier('water', 'earth')).toBe(1);
  });

  it('无属性攻击正常伤害', () => {
    expect(elementModifier(undefined, 'fire')).toBe(1);
    expect(elementModifier('fire', undefined)).toBe(1);
  });
});
