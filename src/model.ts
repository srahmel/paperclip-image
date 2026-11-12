export type Point = { x: number; y: number };
export type View = { x: number; y: number; zoom: number };
export type Tool = "pan" | "pen" | "arrow" | "rect" | "pin";
export type Mark = {
  id: string;
  tool: Exclude<Tool, "pan">;
  points: Point[];
  color: string;
  width: number;
  note: string;
};
export type Review = { marks: Mark[]; note: string };
export const MAX_BYTES = 20 * 1024 * 1024;
export const MAX_PIXELS = 24_000_000;
export const RASTER_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
]);
export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
export function toImage(point: Point, view: View): Point {
  return {
    x: (point.x - view.x) / view.zoom,
    y: (point.y - view.y) / view.zoom,
  };
}
export function zoomAt(view: View, point: Point, zoom: number): View {
  const next = clamp(zoom, 0.02, 16);
  const image = toImage(point, view);
  return {
    zoom: next,
    x: point.x - image.x * next,
    y: point.y - image.y * next,
  };
}
export function fitView(
  width: number,
  height: number,
  areaWidth: number,
  areaHeight: number,
): View {
  const zoom = clamp(
    Math.min((areaWidth - 48) / width, (areaHeight - 48) / height, 1),
    0.02,
    16,
  );
  return {
    zoom,
    x: (areaWidth - width * zoom) / 2,
    y: (areaHeight - height * zoom) / 2,
  };
}
export function validImageSize(width: number, height: number) {
  return (
    width > 0 &&
    height > 0 &&
    width <= 16_384 &&
    height <= 16_384 &&
    width * height <= MAX_PIXELS
  );
}
export function reviewFilename(name: string, requestId: string) {
  const base =
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[^\p{L}\p{N}._-]/gu, "-")
      .slice(0, 85) || "image";
  return `${base}-review-${requestId}.png`;
}
function inline(text: string) {
  return text.replace(/[\[\]()*`<>\\\r\n]/g, " ").trim();
}
export function feedbackBody(
  review: Review,
  sourceName: string,
  sourcePath: string | null,
  copyPath: string,
  dimensions: { width: number; height: number },
) {
  const lines = [
    "## Image feedback",
    "",
    review.note.trim(),
    "",
    `![Annotated image](${copyPath})`,
    "",
    sourcePath
      ? `Original: [${inline(sourceName)}](${sourcePath})`
      : `Original filename: ${inline(sourceName)}`,
    `Image coordinates: ${dimensions.width} × ${dimensions.height} pixels; origin at top left.`,
    "Annotations indicate requested changes; preserve the original image.",
  ];
  review.marks.forEach((mark, index) => {
    const xs = mark.points.map((p) => p.x),
      ys = mark.points.map((p) => p.y);
    lines.push(
      `- ${index + 1}. ${mark.tool} at (${Math.round(Math.min(...xs))}, ${Math.round(Math.min(...ys))})–(${Math.round(Math.max(...xs))}, ${Math.round(Math.max(...ys))})${mark.note.trim() ? `: ${mark.note.trim()}` : ""}`,
    );
  });
  return lines.filter((line, i) => line || lines[i - 1] !== "").join("\n");
}
