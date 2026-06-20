// core/math.ts
// 游戏用数学工具：向量、距离、角度、范围判定、随机。纯函数无副作用，便于单测。

import type { Vec2 } from './types';

export const TAU = Math.PI * 2;

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** 目标是否在以 from 为圆心、radius 为半径的圆内 */
export function inRange(from: Vec2, to: Vec2, radius: number): boolean {
  return dist2(from, to) <= radius * radius;
}

/**
 * 目标是否在扇形攻击区内。
 * @param from 攻击者位置
 * @param facing 攻击者朝向（弧度）
 * @param target 目标位置
 * @param range 攻击半径
 * @param halfAngle 半张角（弧度），如 45° 传 Math.PI/4
 */
export function inCone(
  from: Vec2, facing: number, target: Vec2, range: number, halfAngle: number,
): boolean {
  if (!inRange(from, target, range)) return false;
  const a = angleTo(from, target);
  let delta = Math.abs(a - facing);
  if (delta > Math.PI) delta = TAU - delta;
  return delta <= halfAngle;
}

/** 整数随机 [min, max] 含两端 */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 浮点随机 [min, max) */
export function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** 按概率返回 true，p ∈ [0,1] */
export function chance(p: number): boolean {
  return Math.random() < p;
}

/** 按权重随机选一项 */
export function weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
