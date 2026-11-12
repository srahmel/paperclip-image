import { describe, expect, it } from "vitest";
import {
  feedbackBody,
  fitView,
  reviewFilename,
  toImage,
  validImageSize,
  zoomAt,
  type Mark,
} from "../src/model.js";
import { locale, translate } from "../src/i18n.js";
describe("image coordinates", () => {
  it("keeps the exact image point under the cursor while zooming", () => {
    const view = { x: -320, y: 75, zoom: 2.5 },
      point = { x: 125, y: 210 };
    const before = toImage(point, view),
      after = toImage(point, zoomAt(view, point, 5));
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
  it("clamps zoom without moving its anchor", () => {
    const view = { x: 20, y: 30, zoom: 1 },
      point = { x: 200, y: 100 };
    const next = zoomAt(view, point, 1000);
    expect(next.zoom).toBe(16);
    expect(toImage(point, next)).toEqual(toImage(point, view));
  });
  it("fits a portrait image in a landscape viewport", () => {
    const view = fitView(800, 1600, 1000, 600);
    expect(view.zoom * 1600).toBeLessThanOrEqual(552);
    expect(view.x + 400 * view.zoom).toBeCloseTo(500);
    expect(view.y + 800 * view.zoom).toBeCloseTo(300);
  });
  it("does not upscale small images when fitting", () => {
    expect(fitView(100, 50, 1000, 800).zoom).toBe(1);
  });
  it("rejects unreasonable decoded sizes before allocating a canvas", () => {
    expect(validImageSize(6000, 4000)).toBe(true);
    expect(validImageSize(6001, 4000)).toBe(false);
    expect(validImageSize(20_000, 1)).toBe(false);
    expect(validImageSize(0, 100)).toBe(false);
  });
});
describe("feedback", () => {
  it("reports original coordinates and a linked original", () => {
    const mark: Mark = {
      id: "m",
      tool: "rect",
      points: [
        { x: 42, y: 50 },
        { x: 12, y: 20 },
      ],
      width: 4,
      color: "red",
      note: "Move the logo",
    };
    const body = feedbackBody(
      { note: "Please fix the header", marks: [mark] },
      "header.png",
      "/api/attachments/a/content",
      "/api/attachments/b/content",
      { width: 1200, height: 800 },
    );
    expect(body).toContain("(12, 20)–(42, 50): Move the logo");
    expect(body).toContain("[header.png](/api/attachments/a/content)");
    expect(body).toContain("1200 × 800");
  });
  it("neutralizes markdown control characters in source filenames", () => {
    const body = feedbackBody(
      { note: "Fix", marks: [] },
      "a](https://host/x).png",
      "/api/attachments/a/content",
      "/api/attachments/b/content",
      { width: 1, height: 1 },
    );
    expect(body).not.toContain("](https://host");
  });
  it("makes distinct, safe filenames for recoverable submissions", () => {
    expect(reviewFilename("../../one image.png", "request-1")).toBe(
      "..-..-one-image-review-request-1.png",
    );
    expect(reviewFilename("logo.png", "request-1")).not.toEqual(
      reviewFilename("logo.png", "request-2"),
    );
  });
  it("follows the host language and falls back to English", () => {
    expect(locale("de-DE")).toBe("de");
    expect(locale("fr")).toBe("en");
    expect(translate("de", "Pen")).toBe("Stift");
    expect(translate("en", "Pen")).toBe("Pen");
  });
});
