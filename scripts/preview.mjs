import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
const base = fileURLToPath(new URL("../", import.meta.url));
const compiled = await esbuild.build({
  entryPoints: [base + "scripts/preview-entry.tsx"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  loader: { ".css": "text" },
  alias: { "@paperclipai/plugin-sdk/ui": base + "scripts/preview-sdk.ts" },
});
const companyId = "11111111-1111-4111-8111-111111111111",
  issueId = "22222222-2222-4222-8222-222222222222";
const issue = {
  id: issueId,
  companyId,
  identifier: "DEMO-1",
  title: "Review the Atlas Coffee landing page",
  status: "in_progress",
  assigneeAgentId: null,
};
const sampleId = "33333333-3333-4333-8333-333333333333";
const sample = await readFile(base + "scripts/fixtures/design.png");
const attachments = [
  {
    id: sampleId,
    companyId,
    issueId,
    originalFilename: "atlas-coffee.png",
    contentType: "image/png",
    byteSize: sample.length,
    contentPath: `/api/attachments/${sampleId}/content`,
  },
];
const files = new Map([[sampleId, sample]]),
  comments = new Map();
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paperclip Image Review · Preview</title><style>:root{--background:#fff;--foreground:#242424;--muted:#f4f4f5;--muted-foreground:#71717a;--border:#e4e4e7;--card:#fff;--accent:#f4f4f5;--primary:#242424;--primary-foreground:#fff;--ring:#71717a}body{margin:0;background:var(--background);color:var(--foreground);font:14px system-ui,sans-serif}html.dark{color-scheme:dark;--background:#141416;--foreground:#ededee;--muted:#242428;--muted-foreground:#a1a1aa;--border:#36363b;--card:#1b1b1e;--accent:#2b2b30;--primary:#ededee;--primary-foreground:#17171a}</style><div id="root"></div><script type="module" src="/preview.js"></script></html>`;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  function json(value, status = 200) {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  }
  const buffers = [];
  for await (const part of req) buffers.push(part);
  const bytes = Buffer.concat(buffers);
  if (url.pathname === "/preview.js") {
    res.writeHead(200, { "Content-Type": "text/javascript" });
    res.end(compiled.outputFiles[0].contents);
  } else if (url.pathname === "/__qa/state")
    json({ attachments, comments: [...comments.values()] });
  else if (req.method === "GET" && url.pathname === `/api/issues/${issueId}`)
    json(issue);
  else if (
    req.method === "GET" &&
    url.pathname === `/api/companies/${companyId}/issues`
  ) {
    if (!["updated", "id"].includes(url.searchParams.get("sortField")))
      return json(
        { error: "sortField must be 'updated' or 'id' when provided" },
        400,
      );
    json([issue]);
  } else if (
    req.method === "GET" &&
    url.pathname === `/api/issues/${issueId}/attachments`
  )
    json(attachments);
  else if (
    req.method === "GET" &&
    url.pathname.startsWith("/api/attachments/")
  ) {
    const id = url.pathname.split("/")[3];
    if (!files.has(id)) return json({ error: "Not found" }, 404);
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(files.get(id));
  } else if (
    req.method === "POST" &&
    url.pathname === `/api/companies/${companyId}/issues/${issueId}/attachments`
  ) {
    const boundary = /boundary=(.+)/.exec(
      req.headers["content-type"] || "",
    )?.[1];
    const headerEnd = bytes.indexOf("\r\n\r\n"),
      end = boundary ? bytes.lastIndexOf(`\r\n--${boundary}`) : -1;
    if (headerEnd < 0 || end < 0)
      return json({ error: "Invalid multipart" }, 400);
    const name =
      /filename="([^"]+)"/.exec(bytes.subarray(0, headerEnd).toString())?.[1] ||
      "review.png";
    const image = bytes.subarray(headerEnd + 4, end),
      id = crypto.randomUUID();
    files.set(id, image);
    const a = {
      id,
      companyId,
      issueId,
      contentPath: `/api/attachments/${id}/content`,
      contentType: "image/png",
      originalFilename: name,
      byteSize: image.length,
    };
    attachments.push(a);
    json(a);
  } else if (
    req.method === "POST" &&
    url.pathname === `/api/issues/${issueId}/comments`
  ) {
    const body = JSON.parse(bytes.toString());
    if (comments.has(body.clientRequestId))
      return json(comments.get(body.clientRequestId));
    if (
      !body.clientRequestId ||
      !body.attachmentIds?.every((id) => files.has(id))
    )
      return json({ error: "Missing receipt or image" }, 422);
    const comment = { ...body, id: crypto.randomUUID(), issueId };
    comments.set(body.clientRequestId, comment);
    json(comment);
  } else if (url.pathname.startsWith("/api/"))
    json({ error: "Not found" }, 404);
  else {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  }
});
server.listen(3108, "127.0.0.1", () =>
  console.log(
    `Synthetic preview: http://127.0.0.1:3108/image-review?issue=${issueId}`,
  ),
);
