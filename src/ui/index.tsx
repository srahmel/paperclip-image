import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  useHostContext,
  useHostLocation,
  useHostNavigation,
} from "@paperclipai/plugin-sdk/ui";
import {
  MAX_BYTES,
  taskReviewHref,
  newId,
  rasterContentType,
  rasterBytesType,
  clamp,
  fitView,
  toImage,
  validImageSize,
  zoomAt,
  type Mark,
  type Point,
  type Review,
  type Tool,
  type View,
} from "../model.js";
import {
  imageBlob,
  listImages,
  listTasks,
  nativePath,
  publish,
  submission,
  task,
  type Attachment,
  type Submission,
  type Task,
} from "../api.js";
import { drawMarks, renderPng } from "../drawing.js";
import { locale, translate } from "../i18n.js";
import css from "./styles.css";
import { Undo2, Redo2, Minus, Plus, Scan, Eye } from "lucide-react";
import { IconButton, ToolButtons, toolLabels } from "./Toolbar.js";

function useLanguage() {
  const [language, setLanguage] = useState(() =>
    locale(document.documentElement.lang),
  );
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setLanguage(locale(document.documentElement.lang)),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    return () => observer.disconnect();
  }, []);
  return (text: string) => translate(language, text);
}
function Styles() {
  return <style>{css}</style>;
}
export function ImageReviewSidebar() {
  const navigation = useHostNavigation(),
    t = useLanguage();
  return (
    <>
      <Styles />
      <a
        className="ir-link"
        style={{
          border: 0,
          justifyContent: "start",
          width: "100%",
          fontSize: 13,
        }}
        {...navigation.linkProps("/image-review")}
      >
        <ImageIcon />
        {t("Image review")}
      </a>
    </>
  );
}
/** Optional gallery props are supplied by Paperclip's contextual toolbar mount. */
export function ImageReviewButton({
  imageGallery,
}: {
  imageGallery?: {
    id: string;
    contentPath: string;
    contentType: string;
    originalFilename: string | null;
  };
} = {}) {
  const context = useHostContext(),
    location = useHostLocation(),
    navigation = useHostNavigation(),
    t = useLanguage();
  if (context.entityType !== "issue" || !context.entityId) return null;
  const taskHref = taskReviewHref(
    context.companyPrefix,
    location.pathname,
    context.entityId,
  );
  if (!taskHref) return null;
  if (
    imageGallery &&
    !rasterContentType(imageGallery.contentType, imageGallery.originalFilename)
  )
    return null;
  const href = imageGallery
    ? `${taskHref}&image=${encodeURIComponent(imageGallery.contentPath)}`
    : taskHref;
  return (
    <>
      <Styles />
      <a className="ir-link" {...navigation.linkProps(href)}>
        <ImageIcon />
        {t(imageGallery ? "Annotate image" : "Review images")}
      </a>
    </>
  );
}
function ImageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.5" />
      <path d="m3 17 5-5 4 4 4-6 5 7" />
    </svg>
  );
}
type Source = {
  key: string;
  name: string;
  path: string | null;
  image: HTMLImageElement;
  blob: Blob;
  url: string;
  animated: boolean;
};
const colors = [
  ["Red", "#ef4444"],
  ["Orange", "#f59e0b"],
  ["Blue", "#2563eb"],
  ["Green", "#16a34a"],
  ["Purple", "#9333ea"],
];
const ink = (color: string) => ({ "--ir-ink": color }) as CSSProperties;
const emptyReview = (): Review => ({ marks: [], note: "" });
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ImageReviewPage() {
  const context = useHostContext();
  // Remount on a company change so an unfinished draft can never cross tenants.
  return (
    <ReviewPage
      key={context.companyId ?? "none"}
      companyId={context.companyId}
    />
  );
}
function ReviewPage({ companyId }: { companyId: string | null }) {
  const t = useLanguage(),
    location = useHostLocation(),
    navigation = useHostNavigation();
  const issueId = new URLSearchParams(location.search).get("issue") ?? "";
  const requestedImage = new URLSearchParams(location.search).get("image");
  const selectionAttempt = useRef("");
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]),
    [search, setSearch] = useState("");
  const [picker, setPicker] = useState(!issueId),
    [loading, setLoading] = useState(false);
  const [images, setImages] = useState<Attachment[]>([]),
    [source, setSource] = useState<Source | null>(null);
  const [review, setReview] = useState<Review>(emptyReview),
    [redo, setRedo] = useState<Mark[]>([]);
  const [tool, setTool] = useState<Tool>("pan"),
    [color, setColor] = useState(colors[0][1]),
    [width, setWidth] = useState(4);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 }),
    [original, setOriginal] = useState(false);
  const [error, setError] = useState(""),
    [sendState, setSendState] = useState<
      "idle" | "sending" | "failed" | "sent"
    >("idle");
  const [active, setActive] = useState<Mark | null>(null);
  const pending = useRef<Submission | null>(null),
    file = useRef<HTMLInputElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    viewport = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<Source | null>(null),
    generation = useRef(0),
    viewRef = useRef(view);
  const drag = useRef<{ start: Point; view: View; mark: Mark | null } | null>(
    null,
  );
  const pointers = useRef(new Map<number, Point>()),
    pinch = useRef<{ distance: number; view: View; center: Point } | null>(
      null,
    );
  const fitted = useRef(true),
    dirty =
      sendState !== "sent" &&
      (review.marks.length > 0 || review.note.trim().length > 0);
  const locked = sendState === "sending" || sendState === "failed";
  viewRef.current = view;
  useEffect(
    () => () => {
      generation.current++;
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
    },
    [],
  );
  useEffect(() => {
    if (!dirty) return;
    const before = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  const clearSource = useCallback(() => {
    generation.current++;
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
    sourceRef.current = null;
    setSource(null);
    setReview(emptyReview());
    setRedo([]);
    setActive(null);
    setSendState("idle");
    setLoading(false);
    pending.current = null;
    drag.current = null;
    pointers.current.clear();
    pinch.current = null;
  }, []);
  useEffect(() => {
    clearSource();
    setCurrentTask(null);
    setImages([]);
    setError("");
    if (!companyId || !issueId) {
      setPicker(true);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setPicker(false);
    Promise.all([
      task(companyId, issueId, controller.signal),
      listImages(companyId, issueId, controller.signal),
    ])
      .then(([next, attachments]) => {
        setCurrentTask(next);
        setImages(attachments);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [companyId, issueId, clearSource]);
  useEffect(() => {
    if (!companyId || !picker) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        listTasks(companyId, search, controller.signal)
          .then(setTasks)
          .catch((e) => {
            if (!controller.signal.aborted) setError(e.message);
          }),
      200,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [companyId, search, picker]);
  const fit = useCallback(() => {
    const image = sourceRef.current?.image,
      area = viewport.current;
    if (!image || !area) return;
    fitted.current = true;
    setView(
      fitView(
        image.naturalWidth,
        image.naturalHeight,
        area.clientWidth,
        area.clientHeight,
      ),
    );
  }, []);
  useEffect(() => {
    if (!source || !viewport.current) return;
    fit();
    const observer = new ResizeObserver(() => {
      if (fitted.current) fit();
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [source, fit]);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !source) return;
    ctx.clearRect(0, 0, source.image.naturalWidth, source.image.naturalHeight);
    ctx.drawImage(source.image, 0, 0);
    if (!original)
      drawMarks(ctx, active ? [...review.marks, active] : review.marks);
  }, [source, review.marks, active, original]);
  const zoom = useCallback((factor: number, point?: Point) => {
    const area = viewport.current;
    if (!area) return;
    fitted.current = false;
    setView((v) =>
      zoomAt(
        v,
        point ?? { x: area.clientWidth / 2, y: area.clientHeight / 2 },
        v.zoom * factor,
      ),
    );
  }, []);
  useEffect(() => {
    const area = viewport.current;
    if (!area || !source) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = area.getBoundingClientRect();
      zoom(Math.exp(-clamp(event.deltaY, -100, 100) * 0.008), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    area.addEventListener("wheel", wheel, { passive: false });
    return () => area.removeEventListener("wheel", wheel);
  }, [source, zoom]);
  const edit = (next: Review) => {
    if (locked) return;
    setReview(next);
    setSendState("idle");
    pending.current = null;
  };
  const undo = () => {
    const last = review.marks.at(-1);
    if (!last || locked) return;
    edit({ ...review, marks: review.marks.slice(0, -1) });
    setRedo((list) => [...list, last]);
  };
  const redoMark = () => {
    const last = redo.at(-1);
    if (!last || locked) return;
    edit({ ...review, marks: [...review.marks, last] });
    setRedo((list) => list.slice(0, -1));
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redoMark();
        else undo();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const tools: Record<string, Tool> = {
        v: "pan",
        p: "pen",
        a: "arrow",
        r: "rect",
        n: "pin",
      };
      if (tools[key] && !locked) setTool(tools[key]);
      if (key === "f") {
        event.preventDefault();
        fit();
      }
      if (key === "+" || key === "=") {
        event.preventDefault();
        zoom(1.25);
      }
      if (key === "-") {
        event.preventDefault();
        zoom(0.8);
      }
      if (key === "escape") {
        drag.current = null;
        setActive(null);
        pointers.current.clear();
        pinch.current = null;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  function confirmSwitch() {
    return !dirty || window.confirm(t("Discard unsent feedback and switch?"));
  }
  async function load(
    blob: Blob,
    name: string,
    key: string,
    path: string | null,
    token: number,
  ) {
    if (blob.size > MAX_BYTES)
      throw new Error("Images must be 20 MB or smaller.");
    const detectedType = rasterBytesType(
      new Uint8Array(await blob.slice(0, 12).arrayBuffer()),
    );
    if (!detectedType)
      throw new Error("Use a PNG, JPEG, WebP, GIF, or BMP image.");
    blob =
      blob.type === detectedType
        ? blob
        : new Blob([blob], { type: detectedType });
    const url = URL.createObjectURL(blob),
      image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("Unable to decode this image.");
    }
    if (!validImageSize(image.naturalWidth, image.naturalHeight)) {
      URL.revokeObjectURL(url);
      throw new Error(
        "This image is too large to edit (maximum 24 megapixels and 16384 pixels per side).",
      );
    }
    if (generation.current !== token) {
      URL.revokeObjectURL(url);
      return;
    }
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
    const next: Source = {
      key,
      name,
      path,
      image,
      blob,
      url,
      animated: blob.type === "image/gif" || blob.type === "image/webp",
    };
    sourceRef.current = next;
    setSource(next);
    setReview(emptyReview());
    setRedo([]);
    setActive(null);
    setOriginal(false);
    setSendState("idle");
    pending.current = null;
    setError("");
    setTool("pan");
  }
  async function choose(attachment: Attachment) {
    if (locked || attachment.id === source?.key || !confirmSwitch()) return;
    const token = ++generation.current;
    setLoading(true);
    setError("");
    try {
      await load(
        await imageBlob(attachment),
        attachment.originalFilename || "image",
        attachment.id,
        nativePath(attachment.contentPath),
        token,
      );
    } catch (e) {
      if (generation.current === token) setError((e as Error).message);
    } finally {
      if (generation.current === token) setLoading(false);
    }
  }
  useEffect(() => {
    if (!requestedImage || source) return;
    const selected = images.find(
      (image) =>
        image.id === requestedImage || image.contentPath === requestedImage,
    );
    const key = `${companyId}:${issueId}:${requestedImage}`;
    if (!selected || selectionAttempt.current === key) return;
    selectionAttempt.current = key;
    void choose(selected);
    // Selection is accepted only from the current task's authorized attachment list.
  }, [companyId, issueId, requestedImage, images, source]);
  function point(event: ReactPointerEvent): Point {
    const bounds = viewport.current!.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }
  function bounded(p: Point): Point {
    return {
      x: clamp(p.x, 0, source!.image.naturalWidth),
      y: clamp(p.y, 0, source!.image.naturalHeight),
    };
  }
  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (!source || locked || (event.button !== 0 && event.button !== 1)) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = point(event);
    pointers.current.set(event.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        view: viewRef.current,
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      drag.current = null;
      setActive(null);
      return;
    }
    if (pointers.current.size > 2) return;
    let mark: Mark | null = null;
    if (tool !== "pan" && event.button !== 1 && !original) {
      if (review.marks.length >= 200) {
        setError("Review limit reached (200 marks).");
        return;
      }
      const ip = toImage(p, viewRef.current);
      if (
        ip.x < 0 ||
        ip.y < 0 ||
        ip.x > source.image.naturalWidth ||
        ip.y > source.image.naturalHeight
      )
        return;
      mark = {
        id: newId(),
        tool,
        color,
        width:
          width *
          Math.max(
            1,
            Math.min(source.image.naturalWidth, source.image.naturalHeight) /
              800,
          ),
        points: [ip],
        note: "",
      };
      setActive(mark);
    }
    drag.current = { start: p, view: viewRef.current, mark };
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const p = point(event);
    pointers.current.set(event.pointerId, p);
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()],
        mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const start = pinch.current,
        scale = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, start.distance);
      const v = zoomAt(start.view, start.center, start.view.zoom * scale);
      fitted.current = false;
      setView({
        ...v,
        x: v.x + mid.x - start.center.x,
        y: v.y + mid.y - start.center.y,
      });
      return;
    }
    const d = drag.current;
    if (!d) return;
    if (!d.mark) {
      fitted.current = false;
      setView({
        ...d.view,
        x: d.view.x + p.x - d.start.x,
        y: d.view.y + p.y - d.start.y,
      });
    } else if (d.mark.tool !== "pin") {
      const ip = bounded(toImage(p, viewRef.current));
      if (d.mark.tool === "pen") {
        if (d.mark.points.length < 4000)
          d.mark = { ...d.mark, points: [...d.mark.points, ip] };
      } else d.mark = { ...d.mark, points: [d.mark.points[0], ip] };
      setActive(d.mark);
    }
  }
  function up(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      drag.current = null;
      setActive(null);
      return;
    }
    const mark = drag.current?.mark;
    drag.current = null;
    setActive(null);
    if (mark && event.type !== "pointercancel") {
      edit({ ...review, marks: [...review.marks, mark] });
      setRedo([]);
    }
  }
  async function exportPng() {
    if (!source) return;
    try {
      download(
        await renderPng(source.image, review.marks),
        source.name.replace(/\.[^.]+$/, "") + "-review.png",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function send() {
    if (!source || !currentTask || !companyId || sendState === "sending")
      return;
    if (!review.note.trim()) {
      setError("Add a description before sending.");
      return;
    }
    setSendState("sending");
    setError("");
    try {
      if (!pending.current) {
        const blob = await renderPng(source.image, review.marks);
        if (blob.size > MAX_BYTES)
          throw new Error(
            "The exported PNG is larger than 20 MB. Download it instead.",
          );
        pending.current = submission({
          companyId,
          issueId: currentTask.id,
          blob,
          review: structuredClone(review),
          sourceName: source.name,
          sourcePath: source.path,
          originalBlob: source.path ? undefined : source.blob,
          dimensions: {
            width: source.image.naturalWidth,
            height: source.image.naturalHeight,
          },
        });
      }
      await publish(pending.current);
      setSendState("sent");
      setImages(
        await listImages(companyId, currentTask.id).catch(() => images),
      );
    } catch (e) {
      setSendState(pending.current ? "failed" : "idle");
      setError((e as Error).message);
    }
  }
  if (!companyId)
    return (
      <div className="ir ir-main">
        <Styles />
        {t("Select your organization.")}
      </div>
    );
  return (
    <div className="ir ir-main">
      <Styles />
      <header className="ir-title">
        <div>
          <h1>{t("Image review")}</h1>
          <p className="ir-subtle">
            {t(
              "Zoom in, mark what needs changing, and send clear feedback to the task.",
            )}
          </p>
        </div>
        <div className="ir-heading-actions">
          <button
            disabled={locked || loading}
            onClick={() => file.current?.click()}
          >
            <ImageIcon />
            {t("Open local image")}
          </button>
          <button
            disabled={locked}
            onClick={() => {
              if (confirmSwitch()) {
                clearSource();
                setPicker((v) => !v);
              }
            }}
          >
            {t(currentTask ? "Change task" : "Select a task")}
          </button>
        </div>
      </header>
      <input
        className="ir-file"
        type="file"
        ref={file}
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
        onChange={async (event) => {
          const selected = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!selected || !confirmSwitch()) return;
          if (!rasterContentType(selected.type, selected.name)) {
            setError("Use a PNG, JPEG, WebP, GIF, or BMP image.");
            return;
          }
          const token = ++generation.current;
          setLoading(true);
          try {
            await load(selected, selected.name, newId(), null, token);
          } catch (e) {
            if (generation.current === token) setError((e as Error).message);
          } finally {
            if (generation.current === token) setLoading(false);
          }
        }}
      />
      {error && (
        <div className="ir-warning" role="alert">
          {t(error)}
          {sendState === "failed" && (
            <p>
              {t(
                "Sending may already have saved the image. Retry with this draft to safely finish the comment.",
              )}
            </p>
          )}
        </div>
      )}
      {sendState === "sent" && (
        <div className="ir-success" role="status">
          {t("Feedback saved to the task.")}{" "}
          <a {...navigation.linkProps(`/issues/${currentTask!.id}`)}>
            {t("Open task")}
          </a>
        </div>
      )}
      {picker && (
        <section className="ir-picker">
          <label htmlFor="ir-search">{t("Search tasks")}</label>
          <input
            id="ir-search"
            type="search"
            placeholder={t("Search tasks")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <p className="ir-subtle">
            {t(
              "Choose a task to attach feedback, or open a local image to annotate and download.",
            )}
          </p>
          <div className="ir-task-list" aria-label={t("Recent tasks")}>
            {tasks.length ? (
              tasks.map((item) => (
                <button
                  className="ir-task-option"
                  key={item.id}
                  onClick={() => {
                    if (confirmSwitch()) {
                      setPicker(false);
                      navigation.navigate(
                        `/image-review?issue=${encodeURIComponent(item.id)}`,
                      );
                    }
                  }}
                >
                  <code>{item.identifier}</code>
                  <span>{item.title}</span>
                </button>
              ))
            ) : (
              <p className="ir-subtle">{t("No matching tasks.")}</p>
            )}
          </div>
        </section>
      )}
      {currentTask && (
        <div className="ir-task">
          <strong>{currentTask.identifier}</strong>
          <span>{currentTask.title}</span>
          <a {...navigation.linkProps(`/issues/${currentTask.id}`)}>
            {t("Open task")}
          </a>
          <button
            disabled={locked || loading}
            onClick={async () => {
              try {
                setImages(await listImages(companyId, currentTask.id));
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {t("Refresh images")}
          </button>
        </div>
      )}
      {images.length > 0 && (
        <div className="ir-thumbs" aria-label={t("Task images")}>
          {images.map((attachment) => {
            let path: string;
            try {
              path = nativePath(attachment.contentPath);
            } catch {
              return null;
            }
            return (
              <button
                className="ir-thumb"
                key={attachment.id}
                disabled={locked || loading}
                aria-pressed={source?.key === attachment.id}
                title={attachment.originalFilename || "image"}
                onClick={() => void choose(attachment)}
              >
                <img src={path} alt="" loading="lazy" />
                <span>{attachment.originalFilename || "image"}</span>
              </button>
            );
          })}
        </div>
      )}
      {currentTask && !images.length && !loading && (
        <p className="ir-subtle">
          {t(
            "No image attachments in this task. You can open a local image instead.",
          )}
        </p>
      )}
      {loading && (
        <p className="ir-subtle" role="status">
          {t("Loading…")}
        </p>
      )}
      <div className="ir-layout">
        <section className="ir-workbench" aria-label={t("Image controls")}>
          <div className="ir-toolbar">
            <ToolButtons
              tool={tool}
              disabled={!source || locked}
              t={t}
              onSelect={(key) => {
                setTool(key);
                if (key !== "pan") setOriginal(false);
              }}
            />
            <div className="ir-spacer" />
            <IconButton
              disabled={!review.marks.length || locked}
              onClick={undo}
              label={t("Undo")}
              shortcut={t("Ctrl/Cmd+Z")}
            >
              <Undo2 size={20} aria-hidden="true" />
            </IconButton>
            <IconButton
              disabled={!redo.length || locked}
              onClick={redoMark}
              label={t("Redo")}
              shortcut={t("Ctrl/Cmd+Shift+Z")}
            >
              <Redo2 size={20} aria-hidden="true" />
            </IconButton>
          </div>
          <div className="ir-toolbar">
            <div className="ir-group" role="group" aria-label={t("Color")}>
              {colors.map(([label, value]) => (
                <button
                  className="ir-swatch"
                  key={value}
                  title={t(label)}
                  aria-label={t(label)}
                  aria-pressed={value === color}
                  disabled={locked}
                  style={ink(value)}
                  onClick={() => setColor(value)}
                >
                  <span />
                </button>
              ))}
              <select
                aria-label={t("Stroke width")}
                value={width}
                disabled={locked}
                onChange={(e) => setWidth(Number(e.target.value))}
              >
                {[2, 4, 7, 12].map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
            <IconButton
              disabled={!source}
              label={t("Zoom out")}
              shortcut="−"
              onClick={() => zoom(0.8)}
            >
              <Minus size={18} aria-hidden="true" />
            </IconButton>
            <output aria-label="Zoom">{Math.round(view.zoom * 100)}%</output>
            <IconButton
              disabled={!source}
              label={t("Zoom in")}
              shortcut="+"
              onClick={() => zoom(1.25)}
            >
              <Plus size={18} aria-hidden="true" />
            </IconButton>
            <IconButton
              disabled={!source}
              onClick={fit}
              label={t("Fit")}
              shortcut="F"
            >
              <Scan size={18} aria-hidden="true" />
            </IconButton>
            <button
              disabled={!source}
              title={t("Actual size")}
              aria-label={t("Actual size")}
              onClick={() => {
                fitted.current = false;
                const area = viewport.current!;
                setView((v) =>
                  zoomAt(
                    v,
                    { x: area.clientWidth / 2, y: area.clientHeight / 2 },
                    1,
                  ),
                );
              }}
            >
              100%
            </button>
            <div className="ir-spacer" />
            <IconButton
              disabled={!source}
              aria-pressed={original}
              label={t("Show original")}
              onClick={() => setOriginal((v) => !v)}
            >
              <Eye size={20} aria-hidden="true" />
            </IconButton>
          </div>
          <div
            className="ir-viewport"
            ref={viewport}
            role="region"
            aria-label={t("Image canvas")}
            tabIndex={0}
            style={{
              cursor: tool === "pan" || original ? "grab" : "crosshair",
            }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onLostPointerCapture={() => {
              drag.current = null;
              setActive(null);
            }}
          >
            {source ? (
              <canvas
                ref={canvas}
                width={source.image.naturalWidth}
                height={source.image.naturalHeight}
                style={{
                  width: source.image.naturalWidth,
                  height: source.image.naturalHeight,
                  transform: `translate(${view.x}px,${view.y}px) scale(${view.zoom})`,
                }}
                aria-label={source.name}
              />
            ) : (
              <div className="ir-empty ir-subtle">
                {t("Choose an image to start.")}
              </div>
            )}
          </div>
          <div className="ir-status">
            <span>
              {source
                ? `${source.name} · ${source.image.naturalWidth} × ${source.image.naturalHeight}`
                : t("Source")}
            </span>
            <span>
              {original
                ? t("Showing original")
                : sendState === "sent"
                  ? t("Saved")
                  : dirty
                    ? t("Unsaved draft")
                    : ""}
            </span>
          </div>
        </section>
        <aside className="ir-feedback">
          <div>
            <h2>{t("Feedback")}</h2>
            <label htmlFor="ir-feedback" className="ir-subtle">
              {t("What should change?")}
            </label>
            <textarea
              id="ir-feedback"
              aria-label={t("Describe the requested changes")}
              placeholder={t("Describe the requested changes")}
              value={review.note}
              maxLength={4000}
              disabled={!source || locked}
              onChange={(e) => edit({ ...review, note: e.target.value })}
            />
          </div>
          <div>
            <h2>
              {t("Mark notes")} · {review.marks.length}
            </h2>
            <div className="ir-notes">
              {review.marks.length ? (
                review.marks.map((mark, index) => (
                  <div className="ir-note" key={mark.id}>
                    <div className="ir-note-head">
                      <b>
                        <span className="ir-dot" style={ink(mark.color)} />
                        {index + 1}. {t(toolLabels[mark.tool])}
                      </b>
                      <button
                        className="ir-remove"
                        disabled={locked}
                        aria-label={`${t("Remove mark")} ${index + 1}`}
                        onClick={() => {
                          edit({
                            ...review,
                            marks: review.marks.filter((m) => m.id !== mark.id),
                          });
                          setRedo([]);
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      aria-label={`${t("Add a note for this mark")} ${index + 1}`}
                      placeholder={t("Add a note for this mark")}
                      maxLength={500}
                      value={mark.note}
                      disabled={locked}
                      onChange={(e) =>
                        edit({
                          ...review,
                          marks: review.marks.map((m) =>
                            m.id === mark.id
                              ? { ...m, note: e.target.value }
                              : m,
                          ),
                        })
                      }
                    />
                  </div>
                ))
              ) : (
                <p className="ir-subtle">{t("No marks yet.")}</p>
              )}
            </div>
          </div>
          <div className="ir-actions">
            <button
              disabled={!source || sendState === "sending"}
              onClick={() => void exportPng()}
            >
              {t("Download PNG")}
            </button>
            <button
              disabled={!source || !review.marks.length || locked}
              onClick={() => {
                if (window.confirm(t("Clear all marks?"))) {
                  edit({ ...review, marks: [] });
                  setRedo([]);
                }
              }}
            >
              {t("Clear marks")}
            </button>
            <button
              className="ir-primary"
              disabled={
                !source ||
                !currentTask ||
                !review.note.trim() ||
                sendState === "sending" ||
                sendState === "sent"
              }
              onClick={() => void send()}
            >
              {t(
                sendState === "sending"
                  ? "Sending…"
                  : sendState === "failed"
                    ? "Retry sending"
                    : "Send feedback to task",
              )}
            </button>
            <p className="ir-subtle">
              {t(
                "The original stays unchanged. An annotated PNG and your notes will be attached to this task. The assigned agent may receive Paperclip's usual comment notification.",
              )}
            </p>
            {sendState === "failed" && (
              <button
                onClick={() => {
                  if (confirmSwitch()) clearSource();
                }}
              >
                {t("Discard this draft")}
              </button>
            )}
            <button
              disabled={!source}
              onClick={() => {
                if (source)
                  download(
                    new Blob(
                      [
                        JSON.stringify(
                          {
                            schema: "paperclip-image-review/v1",
                            sourceName: source.name,
                            width: source.image.naturalWidth,
                            height: source.image.naturalHeight,
                            ...review,
                          },
                          null,
                          2,
                        ),
                      ],
                      { type: "application/json" },
                    ),
                    "image-review.json",
                  );
              }}
            >
              {t("Download review data")}
            </button>
          </div>
        </aside>
      </div>
      <footer className="ir-footer ir-subtle">
        <p>
          {t(
            "Use the wheel to zoom. Drag with Move to pan; touch supports two-finger zoom. Shortcuts: V move, P pen, A arrow, R rectangle, N pin, +/− zoom, F fit, Ctrl/Cmd+Z undo.",
          )}
        </p>
        <p>
          {t("Drafts stay in this page until sent or downloaded.")}
          {source?.animated
            ? ` ${t("Animated images are exported as a still frame.")}`
            : ""}
        </p>
      </footer>
    </div>
  );
}
