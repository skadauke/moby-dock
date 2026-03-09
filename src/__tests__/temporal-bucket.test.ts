import { describe, expect, it } from "vitest";
import { getTemporalBucket, groupByTemporalBucket } from "@/lib/temporal-bucket";

describe("getTemporalBucket", () => {
  const now = new Date("2026-03-09T12:00:00");

  it("returns 'Today' for same calendar day", () => {
    expect(getTemporalBucket(new Date("2026-03-09T08:00:00"), now)).toBe("Today");
    expect(getTemporalBucket(new Date("2026-03-09T23:59:59"), now)).toBe("Today");
  });

  it("returns 'Yesterday' for previous calendar day", () => {
    expect(getTemporalBucket(new Date("2026-03-08T15:00:00"), now)).toBe("Yesterday");
  });

  it("returns 'Last 7 days' for 2-6 days ago", () => {
    expect(getTemporalBucket(new Date("2026-03-06T12:00:00"), now)).toBe("Last 7 days");
    expect(getTemporalBucket(new Date("2026-03-04T12:00:00"), now)).toBe("Last 7 days");
  });

  it("returns 'Last 30 days' for 7-29 days ago", () => {
    expect(getTemporalBucket(new Date("2026-02-28T12:00:00"), now)).toBe("Last 30 days");
    expect(getTemporalBucket(new Date("2026-02-15T12:00:00"), now)).toBe("Last 30 days");
  });

  it("returns month + year for older same-year dates", () => {
    expect(getTemporalBucket(new Date("2026-01-15T12:00:00"), now)).toBe("January 2026");
  });

  it("returns just year for previous years", () => {
    expect(getTemporalBucket(new Date("2025-12-25T12:00:00"), now)).toBe("2025");
    expect(getTemporalBucket(new Date("2024-06-15T12:00:00"), now)).toBe("2024");
  });
});

describe("groupByTemporalBucket", () => {
  const now = new Date("2026-03-09T12:00:00");

  it("groups items into temporal buckets preserving order", () => {
    const items = [
      { name: "a", date: new Date("2026-03-09T10:00:00") },
      { name: "b", date: new Date("2026-03-09T08:00:00") },
      { name: "c", date: new Date("2026-03-08T12:00:00") },
      { name: "d", date: new Date("2026-03-05T12:00:00") },
      { name: "e", date: new Date("2026-01-15T12:00:00") },
    ];

    const groups = groupByTemporalBucket(items, (i) => i.date, now);

    expect(groups).toHaveLength(4);
    expect(groups[0].bucket).toBe("Today");
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].bucket).toBe("Yesterday");
    expect(groups[1].items).toHaveLength(1);
    expect(groups[2].bucket).toBe("Last 7 days");
    expect(groups[2].items).toHaveLength(1);
    expect(groups[3].bucket).toBe("January 2026");
    expect(groups[3].items).toHaveLength(1);
  });

  it("handles items with undefined dates", () => {
    const items = [
      { name: "a", date: undefined },
    ];
    const groups = groupByTemporalBucket(items, (i) => i.date, now);
    expect(groups[0].bucket).toBe("Unknown");
  });

  it("returns empty array for empty input", () => {
    const groups = groupByTemporalBucket([], () => undefined, now);
    expect(groups).toHaveLength(0);
  });
});
