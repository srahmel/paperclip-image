import {
  MAX_BYTES,
  RASTER_TYPES,
  feedbackBody,
  reviewFilename,
  type Review,
} from "./model.js";
export type Task = {
  id: string;
  companyId: string;
  identifier: string;
  title: string;
  status: string;
  assigneeAgentId?: string | null;
  conversationAgentId?: string | null;
};
export type Attachment = {
  id: string;
  companyId: string;
  issueId: string;
  contentPath: string;
  originalFilename: string | null;
  contentType: string;
  byteSize: number;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (!path.startsWith("/api/"))
    throw new Error("Only native Paperclip APIs are supported.");
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      typeof body?.error === "string"
        ? body.error
        : `Paperclip returned ${response.status}.`,
      response.status,
    );
  if (body === null)
    throw new Error(
      "Paperclip returned an invalid response. Check the task before retrying.",
    );
  return body as T;
}
export function nativePath(path: string): string {
  if (
    !/^\/api\/(?:attachments\/[\da-f-]+\/(?:content|download)|assets\/[\da-f-]+\/(?:content|download))(?:\?[^#]*)?$/i.test(
      path,
    )
  ) {
    throw new Error(
      "This image does not have a supported native Paperclip attachment URL.",
    );
  }
  return path;
}
export async function task(
  companyId: string,
  id: string,
  signal?: AbortSignal,
) {
  const result = await api<Task>(`/api/issues/${encodeURIComponent(id)}`, {
    signal,
  });
  if (result.companyId !== companyId)
    throw new Error("This task belongs to another organization.");
  return result;
}
export function listTasks(
  companyId: string,
  search: string,
  signal?: AbortSignal,
) {
  return api<Task[]>(
    `/api/companies/${encodeURIComponent(companyId)}/issues?limit=50&q=${encodeURIComponent(search)}&sortField=updatedAt&sortDir=desc`,
    { signal },
  );
}
export async function listImages(
  companyId: string,
  issueId: string,
  signal?: AbortSignal,
) {
  await task(companyId, issueId, signal);
  const attachments = await api<Attachment[]>(
    `/api/issues/${encodeURIComponent(issueId)}/attachments`,
    { signal },
  );
  return attachments.filter(
    (a) =>
      a.companyId === companyId &&
      a.issueId === issueId &&
      RASTER_TYPES.has(a.contentType),
  );
}
export async function imageBlob(attachment: Attachment, signal?: AbortSignal) {
  if (attachment.byteSize > MAX_BYTES)
    throw new Error("Images must be 20 MB or smaller.");
  const response = await fetch(nativePath(attachment.contentPath), {
    credentials: "same-origin",
    signal,
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(`Unable to load image (${response.status}).`);
  const declaredSize = Number(response.headers.get("content-length"));
  if (declaredSize > MAX_BYTES)
    throw new Error("Images must be 20 MB or smaller.");
  const blob = await response.blob();
  if (blob.size > MAX_BYTES)
    throw new Error("Images must be 20 MB or smaller.");
  return blob;
}
export type Submission = {
  requestId: string;
  companyId: string;
  issueId: string;
  filename: string;
  blob: Blob;
  review: Review;
  sourceName: string;
  sourcePath: string | null;
  dimensions: { width: number; height: number };
  originalBlob?: Blob;
  originalFilename?: string;
  originalUploaded?: Attachment;
  uploaded?: Attachment;
  body?: string;
  commentId?: string;
};
export function submission(
  input: Omit<Submission, "requestId" | "filename">,
): Submission {
  const requestId = crypto.randomUUID();
  return {
    ...input,
    requestId,
    filename: reviewFilename(input.sourceName, requestId),
  };
}
/** Keep this object for retries: upload receipts and the comment request ID must not change. */
export async function publish(s: Submission) {
  if (s.commentId) return { id: s.commentId };
  await task(s.companyId, s.issueId);
  if (!s.sourcePath && s.originalBlob) {
    s.originalFilename ??= `original-${s.requestId}-${s.sourceName.replace(/[^\p{L}\p{N}._-]/gu, "-").slice(-100)}`;
    if (!s.originalUploaded) {
      const existing = await api<Attachment[]>(
        `/api/issues/${encodeURIComponent(s.issueId)}/attachments`,
      );
      s.originalUploaded = existing.find(
        (a) =>
          a.originalFilename === s.originalFilename &&
          a.companyId === s.companyId &&
          a.issueId === s.issueId,
      );
      if (!s.originalUploaded) {
        const form = new FormData();
        form.append("file", s.originalBlob, s.originalFilename);
        const original = await api<Attachment>(
          `/api/companies/${encodeURIComponent(s.companyId)}/issues/${encodeURIComponent(s.issueId)}/attachments`,
          { method: "POST", body: form },
        );
        if (
          !original.id ||
          original.issueId !== s.issueId ||
          original.companyId !== s.companyId
        )
          throw new Error(
            "Original upload receipt could not be verified. Retry to check the task.",
          );
        s.originalUploaded = original;
      }
    }
    s.sourcePath = nativePath(s.originalUploaded.contentPath);
  }
  if (!s.uploaded) {
    const attachments = await api<Attachment[]>(
      `/api/issues/${encodeURIComponent(s.issueId)}/attachments`,
    );
    s.uploaded = attachments.find(
      (a) =>
        a.originalFilename === s.filename &&
        a.companyId === s.companyId &&
        a.issueId === s.issueId,
    );
    if (!s.uploaded) {
      const form = new FormData();
      form.append("file", s.blob, s.filename);
      const uploaded = await api<Attachment>(
        `/api/companies/${encodeURIComponent(s.companyId)}/issues/${encodeURIComponent(s.issueId)}/attachments`,
        { method: "POST", body: form },
      );
      if (
        !uploaded.id ||
        uploaded.issueId !== s.issueId ||
        uploaded.companyId !== s.companyId
      )
        throw new Error(
          "Upload receipt could not be verified. Retry to check the task.",
        );
      s.uploaded = uploaded;
    }
  }
  s.body ??= feedbackBody(
    s.review,
    s.sourceName,
    s.sourcePath,
    nativePath(s.uploaded.contentPath),
    s.dimensions,
  );
  const comment = await api<{ id: string; issueId: string; body: string }>(
    `/api/issues/${encodeURIComponent(s.issueId)}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: s.body,
        clientRequestId: s.requestId,
        attachmentIds: [
          s.uploaded.id,
          ...(s.originalUploaded ? [s.originalUploaded.id] : []),
        ],
        reopen: false,
        interrupt: false,
      }),
    },
  );
  if (!comment.id || comment.issueId !== s.issueId || comment.body !== s.body)
    throw new Error(
      "Feedback receipt could not be verified. Retry with this draft to check the result.",
    );
  s.commentId = comment.id;
  return comment;
}
