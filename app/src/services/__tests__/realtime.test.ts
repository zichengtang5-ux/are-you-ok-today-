// realtime.ts 顶层 import 了 AsyncStorage，测试环境需 mock 其原生模块
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { parseSseBuffer } from '../realtime';

/**
 * SSE 帧解析测试 —— 实时通道的核心解析逻辑（替代轮询）。
 */
describe('parseSseBuffer', () => {
  it('parses a single complete frame', () => {
    const buf = 'data: {"userId":"u1","type":"status_changed","at":"t1"}\n\n';
    const { events, rest } = parseSseBuffer(buf);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({ userId: 'u1', type: 'status_changed' }),
    );
    expect(rest).toBe('');
  });

  it('parses multiple frames and keeps the incomplete tail as rest', () => {
    const buf =
      'data: {"userId":"u1","type":"alert_triggered","at":"t1"}\n\n' +
      'data: {"userId":"u1","type":"alert_resolved","at":"t2"}\n\n' +
      'data: {"userId":"u1","typ'; // 不完整
    const { events, rest } = parseSseBuffer(buf);
    expect(events.map((e) => e.type)).toEqual(['alert_triggered', 'alert_resolved']);
    expect(rest).toBe('data: {"userId":"u1","typ');
  });

  it('ignores frames without a data line', () => {
    const buf = ': keep-alive comment\n\ndata: {"userId":"u1","type":"reply_confirmed","at":"t"}\n\n';
    const { events } = parseSseBuffer(buf);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('reply_confirmed');
  });

  it('skips malformed JSON without throwing', () => {
    const buf = 'data: {bad json}\n\ndata: {"userId":"u1","type":"status_changed","at":"t"}\n\n';
    const { events } = parseSseBuffer(buf);
    expect(events).toHaveLength(1); // 坏帧被跳过，好帧保留
  });

  it('returns empty when buffer has no complete frame', () => {
    const { events, rest } = parseSseBuffer('data: {"partial"');
    expect(events).toHaveLength(0);
    expect(rest).toBe('data: {"partial"');
  });
});
