import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCache, withCache } from "../cache.js";

const mockGet = vi.hoisted(() => vi.fn());
const mockSet = vi.hoisted(() => vi.fn().mockResolvedValue("OK"));
const mockQuit = vi.hoisted(() => vi.fn().mockResolvedValue("OK"));

vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(function () {
    return { get: mockGet, set: mockSet, quit: mockQuit };
  }),
}));

describe("createCache", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
    mockQuit.mockReset();
    mockSet.mockResolvedValue("OK");
    mockQuit.mockResolvedValue("OK");
  });

  it("returns a no-op cache when redisUrl is undefined", async () => {
    const cache = createCache(undefined);
    const result = await cache.get("key");
    expect(result).toBeNull();
    await cache.set("key", { x: 1 }, 60);
    await cache.quit();
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("returns null on cache miss", async () => {
    mockGet.mockResolvedValue(null);
    const cache = createCache("redis://localhost:6379");
    expect(await cache.get("missing")).toBeNull();
  });

  it("returns parsed value on cache hit", async () => {
    mockGet.mockResolvedValue(JSON.stringify({ name: "repo-a" }));
    const cache = createCache("redis://localhost:6379");
    const result = await cache.get<{ name: string }>("hit-key");
    expect(result).toEqual({ name: "repo-a" });
  });

  it("stores value as JSON with TTL", async () => {
    mockGet.mockResolvedValue(null);
    const cache = createCache("redis://localhost:6379");
    await cache.set("key", { data: 42 }, 300);
    expect(mockSet).toHaveBeenCalledWith("key", JSON.stringify({ data: 42 }), "EX", 300);
  });
});

describe("withCache", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
    mockSet.mockResolvedValue("OK");
  });

  it("calls fn and stores result on cache miss", async () => {
    mockGet.mockResolvedValue(null);
    const cache = createCache("redis://localhost:6379");
    const fn = vi.fn().mockResolvedValue({ items: [1, 2] });

    const result = await withCache(cache, "my-key", 60, fn);

    expect(fn).toHaveBeenCalledOnce();
    expect(result).toEqual({ items: [1, 2] });
    expect(mockSet).toHaveBeenCalledWith("my-key", JSON.stringify({ items: [1, 2] }), "EX", 60);
  });

  it("returns cached value without calling fn on cache hit", async () => {
    mockGet.mockResolvedValue(JSON.stringify({ items: [3, 4] }));
    const cache = createCache("redis://localhost:6379");
    const fn = vi.fn();

    const result = await withCache(cache, "my-key", 60, fn);

    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [3, 4] });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("uses no-op cache transparently — fn always called", async () => {
    const cache = createCache(undefined);
    const fn = vi.fn().mockResolvedValue({ x: 1 });

    const r1 = await withCache(cache, "key", 60, fn);
    const r2 = await withCache(cache, "key", 60, fn);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(r1).toEqual({ x: 1 });
    expect(r2).toEqual({ x: 1 });
  });
});
