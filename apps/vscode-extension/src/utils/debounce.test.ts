import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { debounce } from "./debounce.js";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes the callback only after the delay elapses", () => {
    const calls: number[] = [];
    const debounced = debounce((value: number) => calls.push(value), 150);

    debounced(1);
    expect(calls).toEqual([]);

    vi.advanceTimersByTime(149);
    expect(calls).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(calls).toEqual([1]);
  });

  it("collapses rapid calls into a single trailing invocation", () => {
    const calls: number[] = [];
    const debounced = debounce((value: number) => calls.push(value), 100);

    debounced(1);
    vi.advanceTimersByTime(50);
    debounced(2);
    vi.advanceTimersByTime(50);
    debounced(3);

    expect(calls).toEqual([]);
    vi.advanceTimersByTime(100);
    expect(calls).toEqual([3]);
  });

  it("forwards the latest arguments to the callback", () => {
    const received: Array<[string, number]> = [];
    const debounced = debounce((name: string, count: number) => {
      received.push([name, count]);
    }, 10);

    debounced("first", 1);
    debounced("second", 2);
    vi.advanceTimersByTime(10);

    expect(received).toEqual([["second", 2]]);
  });

  it("allows a fresh invocation after the timer fires", () => {
    const calls: number[] = [];
    const debounced = debounce((value: number) => calls.push(value), 20);

    debounced(1);
    vi.advanceTimersByTime(20);
    debounced(2);
    vi.advanceTimersByTime(20);

    expect(calls).toEqual([1, 2]);
  });
});
