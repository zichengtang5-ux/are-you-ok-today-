import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportError } from './errorReporter';
import { API_BASE_URL } from './config';

export type RealtimeEventType =
  | 'status_changed'
  | 'alert_triggered'
  | 'alert_resolved'
  | 'reply_confirmed';

export interface RealtimeEvent {
  userId: string;
  type: RealtimeEventType;
  payload?: Record<string, unknown>;
  at: string;
}

type Handler = (event: RealtimeEvent) => void;

/**
 * 解析 SSE 缓冲区，返回完整帧里的事件 + 剩余不完整片段。纯函数，便于测试。
 * SSE 帧以空行(\n\n)分隔，data: 行携带 JSON。
 */
export function parseSseBuffer(buffer: string): { events: RealtimeEvent[]; rest: string } {
  const frames = buffer.split('\n\n');
  const rest = frames.pop() ?? '';
  const events: RealtimeEvent[] = [];
  for (const frame of frames) {
    const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
    if (!dataLine) continue;
    const json = dataLine.slice('data:'.length).trim();
    if (!json) continue;
    try {
      events.push(JSON.parse(json) as RealtimeEvent);
    } catch {
      // 忽略无法解析的帧
    }
  }
  return { events, rest };
}

/**
 * 轻量 SSE 客户端（替代 30 秒轮询）。
 *
 * RN 没有内置 EventSource，这里用 XMLHttpRequest 的增量 responseText 解析 SSE 帧
 * （text/event-stream）。连接断开时自动重连（指数退避），保证守护状态实时性。
 *
 * 后端端点：GET /api/events/stream（见 server EventsController），
 * 用 Redis pub/sub 跨实例广播，无论客户端连在哪个实例都能收到自己的事件。
 */
export class RealtimeClient {
  private xhr: XMLHttpRequest | null = null;
  private handlers = new Set<Handler>();
  private buffer = '';
  private lastIndex = 0;
  private retryMs = 1000;
  private closed = false;

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async connect(): Promise<void> {
    this.closed = false;
    const token = await AsyncStorage.getItem('access_token');
    if (!token) return;

    const xhr = new XMLHttpRequest();
    this.xhr = xhr;
    this.buffer = '';
    this.lastIndex = 0;

    xhr.open('GET', `${API_BASE_URL}/events/stream`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Accept', 'text/event-stream');

    xhr.onprogress = () => {
      // 增量读取新到达的文本
      const full = xhr.responseText;
      const chunk = full.slice(this.lastIndex);
      this.lastIndex = full.length;
      this.buffer += chunk;
      this.flushFrames();
    };

    xhr.onerror = () => this.scheduleReconnect();
    xhr.onload = () => this.scheduleReconnect(); // 服务端关闭连接 → 重连

    try {
      xhr.send();
      this.retryMs = 1000; // 连接成功，重置退避
    } catch (e) {
      reportError(e, { scope: 'realtime.connect' });
      this.scheduleReconnect();
    }
  }

  /** 解析 SSE 帧并分发（复用纯函数 parseSseBuffer） */
  private flushFrames(): void {
    const { events, rest } = parseSseBuffer(this.buffer);
    this.buffer = rest;
    for (const event of events) {
      this.handlers.forEach((h) => h(event));
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    const delay = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, 30_000); // 指数退避，上限 30s
    setTimeout(() => {
      if (!this.closed) void this.connect();
    }, delay);
  }

  close(): void {
    this.closed = true;
    this.xhr?.abort();
    this.xhr = null;
    this.handlers.clear();
  }
}

export const realtime = new RealtimeClient();
