import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter, gameEvents } from '../../src/utils/event-emitter.js';

describe('EventEmitter', () => {
  /** @type {EventEmitter} */
  let emitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  // ─── on / emit ─────────────────────────────────

  it('calls listener when event is emitted', () => {
    const calls = [];
    emitter.on('test', (v) => calls.push(v));
    emitter.emit('test', 42);
    expect(calls).toEqual([42]);
  });

  it('passes multiple arguments to listener', () => {
    const calls = [];
    emitter.on('multi', (a, b, c) => calls.push([a, b, c]));
    emitter.emit('multi', 1, 'two', true);
    expect(calls).toEqual([[1, 'two', true]]);
  });

  it('supports multiple listeners on the same event', () => {
    const a = [],
      b = [];
    emitter.on('ev', (v) => a.push(v));
    emitter.on('ev', (v) => b.push(v));
    emitter.emit('ev', 'x');
    expect(a).toEqual(['x']);
    expect(b).toEqual(['x']);
  });

  it('does not call listeners for other events', () => {
    const calls = [];
    emitter.on('a', () => calls.push('a'));
    emitter.emit('b');
    expect(calls).toEqual([]);
  });

  it('does nothing when emitting an event with no listeners', () => {
    expect(() => emitter.emit('noop')).not.toThrow();
  });

  // ─── on returns unsubscribe ────────────────────

  it('returns an unsubscribe function from on()', () => {
    const calls = [];
    const unsub = emitter.on('ev', (v) => calls.push(v));
    emitter.emit('ev', 1);
    unsub();
    emitter.emit('ev', 2);
    expect(calls).toEqual([1]);
  });

  // ─── off ───────────────────────────────────────

  it('removes a specific listener with off()', () => {
    const calls = [];
    const fn = (v) => calls.push(v);
    emitter.on('ev', fn);
    emitter.emit('ev', 1);
    emitter.off('ev', fn);
    emitter.emit('ev', 2);
    expect(calls).toEqual([1]);
  });

  it('removes all listeners for an event when callback is omitted', () => {
    const a = [],
      b = [];
    emitter.on('ev', (v) => a.push(v));
    emitter.on('ev', (v) => b.push(v));
    emitter.off('ev');
    emitter.emit('ev', 'x');
    expect(a).toEqual([]);
    expect(b).toEqual([]);
  });

  it('off() is a no-op for unknown events', () => {
    expect(() => emitter.off('unknown', () => {})).not.toThrow();
  });

  // ─── once ──────────────────────────────────────

  it('calls a once listener only once', () => {
    const calls = [];
    emitter.once('ev', (v) => calls.push(v));
    emitter.emit('ev', 1);
    emitter.emit('ev', 2);
    expect(calls).toEqual([1]);
  });

  it('once returns an unsubscribe function', () => {
    const calls = [];
    const unsub = emitter.once('ev', (v) => calls.push(v));
    unsub();
    emitter.emit('ev', 1);
    expect(calls).toEqual([]);
  });

  it('off() can remove a once listener by original callback', () => {
    const calls = [];
    const fn = (v) => calls.push(v);
    emitter.once('ev', fn);
    emitter.off('ev', fn);
    emitter.emit('ev', 1);
    expect(calls).toEqual([]);
  });

  // ─── clear ─────────────────────────────────────

  it('clear() removes all listeners for all events', () => {
    const a = [],
      b = [];
    emitter.on('x', (v) => a.push(v));
    emitter.on('y', (v) => b.push(v));
    emitter.clear();
    emitter.emit('x', 1);
    emitter.emit('y', 2);
    expect(a).toEqual([]);
    expect(b).toEqual([]);
  });

  // ─── listener mutation during emit ─────────────

  it('handles listener that removes itself during emit', () => {
    const calls = [];
    const selfRemove = () => {
      calls.push('self');
      emitter.off('ev', selfRemove);
    };
    emitter.on('ev', selfRemove);
    emitter.on('ev', () => calls.push('other'));
    emitter.emit('ev');
    expect(calls).toEqual(['self', 'other']);
    // second emit — selfRemove should be gone
    calls.length = 0;
    emitter.emit('ev');
    expect(calls).toEqual(['other']);
  });

  // ─── singleton ─────────────────────────────────

  it('exports a gameEvents singleton', () => {
    expect(gameEvents).toBeInstanceOf(EventEmitter);
  });
});
