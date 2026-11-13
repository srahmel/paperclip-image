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
/** Task toolbar slots in older hosts omit companyPrefix from their SDK context. */
export function taskReviewHref(
  companyPrefix: string | null,
  pathname: string,
  issueId: string,
): string | null {
  const prefix =
    companyPrefix || /^\/([^/]+)\/issues(?:\/|$)/.exec(pathname)?.[1];
  if (!prefix) return null;
  return `/${encodeURIComponent(prefix)}/image-review?issue=${encodeURIComponent(issueId)}`;
}
/** randomUUID is unavailable on plain-HTTP LAN origins; getRandomValues still works. */
export function newId(): string {
  if (typeof globalThis.crypto.randomUUID === "function")
    return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const RASTER_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
]);
/** Older agent uploads use a generic binary MIME type even for PNG/JPEG files. */
export function rasterContentType(
  contentType: string,
  filename?: string | null,
): string | null {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (RASTER_TYPES.has(type)) return type;
  if (
    type &&
    ![
      "application/octet-stream",
      "binary/octet-stream",
      "application/x-binary",
    ].includes(type)
  )
    return null;
  const extension = filename?.match(/\.([^.]+)$/)?.[1].toLowerCase();
  return extension
    ? ((
        {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          webp: "image/webp",
          gif: "image/gif",
          bmp: "image/bmp",
        } as Record<string, string>
      )[extension] ?? null)
    : null;
}
/** Confirm raster file signatures before decoding a legacy binary attachment. */
export function rasterBytesType(bytes: Uint8Array): string | null {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  const text = String.fromCharCode(...bytes);
  if (text.startsWith("GIF87a") || text.startsWith("GIF89a"))
    return "image/gif";
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP")
    return "image/webp";
  if (text.startsWith("BM")) return "image/bmp";
  return null;
}
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
