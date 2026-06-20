// core/eventBus.ts
// 轻量事件总线。模块间通过事件解耦，不互相直接调用。

export type Handler<T = unknown> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<Handler>>();

  on<T = unknown>(event: string, handler: Handler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as Handler);
    return () => this.off(event, handler);
  }

  off<T = unknown>(event: string, handler: Handler<T>): void {
    this.handlers.get(event)?.delete(handler as Handler);
  }

  emit<T = unknown>(event: string, payload?: T): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // 拷贝一份再遍历，避免 handler 内 off 自己导致迭代异常
    for (const h of [...set]) {
      try {
        h(payload as T);
      } catch (err) {
        console.error(`[EventBus] handler error for "${event}":`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** 全局单例事件总线 */
export const bus = new EventBus();
