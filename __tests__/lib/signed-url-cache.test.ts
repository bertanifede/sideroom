import { describe, it, expect, beforeEach } from "vitest";
import {
  getCachedSignedUrl,
  setCachedSignedUrl,
  __clearSignedUrlCache,
} from "@/lib/signed-url-cache";

describe("signed-url-cache", () => {
  beforeEach(() => __clearSignedUrlCache());

  it("returns null for a key that was never set", () => {
    expect(getCachedSignedUrl("p1:1")).toBeNull();
  });

  it("returns the stored URL within the TTL window", () => {
    setCachedSignedUrl("p1:1", "https://signed.example/a", 1_000);
    expect(getCachedSignedUrl("p1:1", 10_000)).toBe("https://signed.example/a");
  });

  it("returns null once the TTL has expired", () => {
    setCachedSignedUrl("p1:1", "https://signed.example/a", 1_000);
    // expiry = 1_000 + 50_000 = 51_000; a query at 51_000 is expired
    expect(getCachedSignedUrl("p1:1", 51_000)).toBeNull();
  });

  it("isolates entries by key", () => {
    setCachedSignedUrl("p1:1", "https://signed.example/one", 0);
    setCachedSignedUrl("p1:2", "https://signed.example/two", 0);
    expect(getCachedSignedUrl("p1:1", 100)).toBe("https://signed.example/one");
    expect(getCachedSignedUrl("p1:2", 100)).toBe("https://signed.example/two");
  });
});
