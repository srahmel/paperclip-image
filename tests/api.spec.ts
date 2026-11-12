import { afterEach, describe, expect, it, vi } from "vitest";
import {
  imageBlob,
  listImages,
  nativePath,
  publish,
  submission,
  task,
  type Attachment,
} from "../src/api.js";
const companyId = "11111111-1111-4111-8111-111111111111",
  issueId = "22222222-2222-4222-8222-222222222222";
const original: Attachment = {
  id: "33333333-3333-4333-8333-333333333333",
  companyId,
  issueId,
  originalFilename: "design.png",
  contentType: "image/png",
  byteSize: 10,
  contentPath: "/api/attachments/33333333-3333-4333-8333-333333333333/content",
};
const uploaded: Attachment = {
  ...original,
  id: "44444444-4444-4444-8444-444444444444",
  contentPath: "/api/attachments/44444444-4444-4444-8444-444444444444/content",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const draft = () =>
  submission({
    companyId,
    issueId,
    blob: new Blob(["png"], { type: "image/png" }),
    review: { marks: [], note: "Change the logo" },
    sourceName: "design.png",
    sourcePath: original.contentPath,
    dimensions: { width: 100, height: 80 },
  });
afterEach(() => vi.unstubAllGlobals());
describe("native images", () => {
  it.each([
    "https://evil.test/image.png",
    "//evil.test/image.png",
    "/api/attachments/../auth/session",
    "data:image/png;base64,aa",
    "/api/attachments/a/content#x",
  ])("rejects a non-attachment URL: %s", (url) => {
    expect(() => nativePath(url)).toThrow();
  });
  it("accepts a native attachment URL and download query", () => {
    expect(nativePath(original.contentPath + "?download=1")).toContain(
      "?download=1",
    );
  });
  it("checks task ownership before loading attachments", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json({ id: issueId, companyId: "other" }));
    vi.stubGlobal("fetch", fetch);
    await expect(listImages(companyId, issueId)).rejects.toThrow(
      "another organization",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("filters SVG and cross-task images", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ companyId }))
      .mockResolvedValueOnce(
        json([
          original,
          { ...original, id: "svg", contentType: "image/svg+xml" },
          { ...original, id: "other", issueId: "other" },
        ]),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await listImages(companyId, issueId)).toEqual([original]);
  });
  it("refuses oversized images before downloading", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      imageBlob({ ...original, byteSize: 30_000_000 }),
    ).rejects.toThrow("20 MB");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("surfaces authentication failures without loading data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ error: "Sign in required" }, 401)),
    );
    await expect(task(companyId, issueId)).rejects.toThrow("Sign in required");
  });
});
describe("publishing receipts", () => {
  it("uploads once and keeps the exact comment request id on retry", async () => {
    const s = draft(),
      requests: { url: string; init?: RequestInit }[] = [];
    let fail = true;
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url === `/api/issues/${issueId}`)
        return json({ id: issueId, companyId });
      if (url.endsWith("/attachments") && !init?.method)
        return json([original]);
      if (url.endsWith("/attachments")) return json(uploaded);
      if (fail) {
        fail = false;
        throw new Error("Connection lost after comment commit");
      }
      const body = JSON.parse(init!.body as string);
      return json({ id: "comment", issueId, body: body.body });
    });
    vi.stubGlobal("fetch", fetch);
    await expect(publish(s)).rejects.toThrow("Connection lost");
    expect(s.uploaded?.id).toBe(uploaded.id);
    await publish(s);
    await publish(s);
    expect(
      requests.filter(
        (r) => r.url.endsWith("/attachments") && r.init?.method === "POST",
      ),
    ).toHaveLength(1);
    const comments = requests
      .filter((r) => r.url.endsWith("/comments"))
      .map((r) => JSON.parse(r.init!.body as string));
    expect(comments).toHaveLength(2);
    expect(comments[0]).toEqual(comments[1]);
    expect(comments[0]).toMatchObject({
      clientRequestId: s.requestId,
      attachmentIds: [uploaded.id],
      interrupt: false,
      reopen: false,
    });
  });
  it("recovers an upload whose HTTP response was lost", async () => {
    const s = draft();
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === `/api/issues/${issueId}`) return json({ companyId });
      if (url.endsWith("/attachments"))
        return json([{ ...uploaded, originalFilename: s.filename }]);
      return json({
        id: "comment",
        issueId,
        body: JSON.parse(init!.body as string).body,
      });
    });
    vi.stubGlobal("fetch", fetch);
    await publish(s);
    expect(
      fetch.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(1);
  });
  it("does not post if the upload receipt names another company", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ companyId }))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json({ ...uploaded, companyId: "other" }));
    vi.stubGlobal("fetch", fetch);
    await expect(publish(draft())).rejects.toThrow("receipt");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("uploads both original and annotated images for a local source", async () => {
    const s = draft();
    s.sourcePath = null;
    s.originalBlob = new Blob(["original"]);
    const posted: RequestInit[] = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (!init?.method)
        return json(url.endsWith("/attachments") ? [] : { companyId });
      posted.push(init);
      if (url.endsWith("/attachments"))
        return json(posted.length === 1 ? original : uploaded);
      return json({
        id: "comment",
        issueId,
        body: JSON.parse(init.body as string).body,
      });
    });
    vi.stubGlobal("fetch", fetch);
    await publish(s);
    expect(posted).toHaveLength(3);
    expect(JSON.parse(posted[2].body as string).attachmentIds).toEqual([
      uploaded.id,
      original.id,
    ]);
    expect(s.body).toContain(`(${original.contentPath})`);
  });
  it("does not claim success for a malformed comment receipt", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ companyId }))
      .mockResolvedValueOnce(json([{ ...uploaded, originalFilename: "saved" }]))
      .mockResolvedValueOnce(json(uploaded))
      .mockResolvedValueOnce(json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const s = draft();
    await expect(publish(s)).rejects.toThrow("receipt");
    expect(s.commentId).toBeUndefined();
  });
});
