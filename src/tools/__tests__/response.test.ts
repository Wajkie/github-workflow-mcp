import { describe, it, expect } from "vitest";
import { ok, toErrorContent } from "../response.js";

describe("ok", () => {
  it("wraps data in a text content array", () => {
    const result = ok({ foo: "bar" });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ foo: "bar" });
  });

  it("pretty-prints with 2-space indent", () => {
    const result = ok({ a: 1 });
    expect(result.content[0].text).toBe(JSON.stringify({ a: 1 }, null, 2));
  });
});

describe("toErrorContent", () => {
  it("returns rate-limit message when status 403 and x-ratelimit-remaining is 0", () => {
    const err = {
      status: 403,
      response: { headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1700000000" } },
    };
    const result = toErrorContent(err);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe("GitHub rate limit exceeded");
    expect(typeof body.ratelimit_reset).toBe("string");
  });

  it("returns rate-limit message when status 429 and x-ratelimit-remaining is 0", () => {
    const err = {
      status: 429,
      response: { headers: { "x-ratelimit-remaining": "0" } },
    };
    const result = toErrorContent(err);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe("GitHub rate limit exceeded");
    expect(body.ratelimit_reset).toBe("unknown");
  });

  it("returns the GitHub error message for other status codes", () => {
    const err = { status: 404, message: "Not Found" };
    const result = toErrorContent(err);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe("Not Found");
  });

  it("falls back to status string when message is absent", () => {
    const err = { status: 500 };
    const result = toErrorContent(err);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe("500");
  });

  it("returns message from a plain Error", () => {
    const result = toErrorContent(new Error("something broke"));
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe("something broke");
  });

  it("coerces a non-Error unknown to string", () => {
    const result = toErrorContent("unexpected string");
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe("unexpected string");
  });

  it("does not include isError in the return value", () => {
    const result = toErrorContent(new Error("x"));
    expect(result).not.toHaveProperty("isError");
  });
});
