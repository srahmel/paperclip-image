import type { Mark } from "./model.js";
export function drawMarks(ctx: CanvasRenderingContext2D, marks: Mark[]) {
  for (const [index, mark] of marks.entries()) {
    if (!mark.points.length) continue;
    ctx.save();
    ctx.strokeStyle = mark.color;
    ctx.fillStyle = mark.color;
    ctx.lineWidth = mark.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const first = mark.points[0],
      last = mark.points.at(-1)!;
    ctx.beginPath();
    if (mark.tool === "pin") {
      const radius = Math.max(mark.width * 3.5, 12);
      ctx.arc(first.x, first.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, radius / 8);
      ctx.strokeStyle = "white";
      ctx.stroke();
      ctx.fillStyle = "white";
      ctx.font = `bold ${radius * 1.15}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), first.x, first.y + 1);
    } else if (mark.tool === "rect") {
      ctx.strokeRect(first.x, first.y, last.x - first.x, last.y - first.y);
    } else {
      ctx.moveTo(first.x, first.y);
      if (mark.tool === "pen") {
        for (const point of mark.points.slice(1)) ctx.lineTo(point.x, point.y);
        if (mark.points.length === 1) ctx.lineTo(first.x + 0.01, first.y);
      } else ctx.lineTo(last.x, last.y);
      ctx.stroke();
      if (mark.tool === "arrow") {
        const angle = Math.atan2(last.y - first.y, last.x - first.x),
          head = Math.max(mark.width * 4, 14);
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(
          last.x - head * Math.cos(angle - Math.PI / 6),
          last.y - head * Math.sin(angle - Math.PI / 6),
        );
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(
          last.x - head * Math.cos(angle + Math.PI / 6),
          last.y - head * Math.sin(angle + Math.PI / 6),
        );
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
export async function renderPng(
  image: HTMLImageElement,
  marks: Mark[],
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.drawImage(image, 0, 0);
  drawMarks(ctx, marks);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("PNG export failed.")),
      "image/png",
    ),
  );
}
