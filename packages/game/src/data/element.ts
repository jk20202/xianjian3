// data/element.ts
// 五灵属性系统：风雷水火土循环相克

import type { Element } from '../core/types';

/** 克制表：key 克制 value（风克雷、雷克水、水克火、火克土、土克风） */
export const COUNTERS: Record<Element, Element> = {
  wind: 'thunder',
  thunder: 'water',
  water: 'fire',
  fire: 'earth',
  earth: 'wind',
};

export const ELEMENT_LABEL: Record<Element, string> = {
  wind: '风',
  thunder: '雷',
  water: '水',
  fire: '火',
  earth: '土',
};

export const ELEMENT_COLOR: Record<Element, number> = {
  wind: 0x66cc99,
  thunder: 0xcc99ff,
  water: 0x6699ff,
  fire: 0xff6666,
  earth: 0xcc9966,
};

/**
 * 属性修正倍率：
 * - 攻击方克制防守方 → 1.5
 * - 攻击方被防守方克制 → 0.75
 * - 无关 → 1.0
 */
export function elementModifier(atk: Element | undefined, def: Element | undefined): number {
  if (!atk || !def) return 1;
  if (COUNTERS[atk] === def) return 1.5;
  if (COUNTERS[def] === atk) return 0.75;
  return 1;
}
