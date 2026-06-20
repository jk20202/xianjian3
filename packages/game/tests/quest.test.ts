// tests/quest.test.ts
// 任务系统单元测试

import { describe, it, expect, beforeEach } from 'vitest';
import { questManager } from '../src/quest/QuestManager';

describe('任务系统', () => {
  beforeEach(() => {
    // 重置状态
    questManager.active = [];
    questManager.done = [];
    questManager.progress = {};
  });

  it('应该能接取没有前置任务的任务', () => {
    const ok = questManager.accept('q_main_pawnshop');
    expect(ok).toBe(true);
    expect(questManager.active).toContain('q_main_pawnshop');
  });

  it('不能接取有前置任务未完成的任务', () => {
    // q_main_track 需要 q_main_pawnshop 完成
    const ok = questManager.accept('q_main_track');
    expect(ok).toBe(false);
  });

  it('完成前置任务后可以接取后续任务', () => {
    questManager.accept('q_main_pawnshop');
    questManager.done.push('q_main_pawnshop');
    questManager.active = questManager.active.filter((id) => id !== 'q_main_pawnshop');
    const ok = questManager.accept('q_main_track');
    expect(ok).toBe(true);
  });

  it('击杀怪物应该更新任务进度', () => {
    questManager.accept('q_main_pawnshop');
    // q_main_pawnshop 需要杀 1 个 slime_green
    questManager.onKill('slime_green');
    const tracked = questManager.getTrackedQuests();
    expect(tracked).toHaveLength(1);
    // 检查击杀目标是否完成
    const killObj = tracked[0].objectives.find((o) => o.desc.includes('slime_green'));
    expect(killObj).toBeDefined();
    expect(killObj!.current).toBe(1);
    expect(killObj!.done).toBe(true);
  });

  it('不能重复接取已完成的任务', () => {
    questManager.accept('q_main_pawnshop');
    questManager.done.push('q_main_pawnshop');
    questManager.active = questManager.active.filter((id) => id !== 'q_main_pawnshop');
    const ok = questManager.accept('q_main_pawnshop');
    expect(ok).toBe(false);
  });

  it('序列化和反序列化应该保持状态', () => {
    questManager.accept('q_main_pawnshop');
    questManager.onKill('slime_green');
    const data = questManager.serialize();
    
    // 重置后恢复
    questManager.active = [];
    questManager.done = [];
    questManager.progress = {};
    
    questManager.deserialize(data);
    expect(questManager.active).toContain('q_main_pawnshop');
  });
});
