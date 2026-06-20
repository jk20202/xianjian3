import type { Element } from '../types';

/** 五灵相克:水→火→雷→风→土→水 循环 */
const COUNTER: Record<Element, Element> = {
  water: 'fire',
  fire: 'thunder',
  thunder: 'wind',
  wind: 'earth',
  earth: 'water',
};

export const ELEMENT_LABEL: Record<Element, string> = {
  wind: '风',
  thunder: '雷',
  water: '水',
  fire: '火',
  earth: '土',
};

export const ELEMENT_COLOR: Record<Element, number> = {
  wind: 0x7fd87f,
  thunder: 0xb07fff,
  water: 0x5fb8ff,
  fire: 0xff7a4d,
  earth: 0xd9a85a,
};

/** 攻击属性对防御属性的伤害倍率 */
export function elementMultiplier(atk: Element, def: Element): number {
  if (COUNTER[atk] === def) return 1.5; // 克制 +50%
  if (COUNTER[def] === atk) return 0.6; // 被克 -40%
  return 1.0;
}

export function counterOf(e: Element): Element {
  return COUNTER[e];
}
