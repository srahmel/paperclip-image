# Paperclip Image Review

A Paperclip plugin for inspecting images and giving precise visual feedback to the agent assigned to a task.

## Features

- An **Image review** sidebar page and a **Review images** link on task pages.
- Optional host patch: zoom/pan directly in Paperclip's existing gallery, plus **Annotate image** for its selected image.
- Load native task image attachments, or open a local image.
- Wheel zoom, pan, fit-to-window, actual size, and two-finger touch zoom.
- Freehand pen, arrows, rectangles, numbered pins, five ink colors, and stroke widths.
- Undo/redo, per-mark notes, and an original/annotated toggle.
- Download a full-resolution annotated PNG and an inspectable JSON record of the review.
- Send a PNG and change description to the original task using native attachment and comment APIs. Local images include an original upload too.
- Follow Paperclip's theme and declared language (English/German, English fallback).

## Install from source

Use Node.js 24.11+ and pnpm 9.15.4:

```sh
git clone https://github.com/srahmel/paperclip-image.git
cd paperclip-image
pnpm install --frozen-lockfile
pnpm build
```

Install with an already authorized instance-admin CLI:

```sh
paperclipai plugin install /absolute/path/to/paperclip-image
```

The npm-name dialog in the verified Paperclip version does not expose local-path installation. Use the CLI for this source checkout. If CLI access is not already authorized, an instance administrator must approve its normal login flow before installing.

Plugin ID: `srahmel.image-review`. Company route: `/<company-prefix>/image-review`. The source checkout must remain available for a local installation. The repository is not an npm release; do not try to install its package name from npm yet.

## Use

Open **Review images** on a task, select an image, and zoom to the area you want to discuss. Choose **Pen**, **Arrow**, **Rectangle**, or **Numbered pin**. Add mark notes and a short overall change description, then select **Send feedback to task**. Review the task title before sending. Paperclip may notify or wake its assigned agent under its normal comment behavior; this plugin does not reassign, reopen, interrupt, or separately invoke agents.

The original is preserved. The comment links both the original and marked copy and includes coordinates in the original image's pixel space, with the origin at the top left. Existing images are reused; a local image is also uploaded as an original. Publishing only happens on an explicit button click.

### Open directly from the normal image gallery

The plugin alone provides its dedicated review page. To enhance the existing click-to-open viewer, apply the companion [Paperclip UI patch](patches/paperclip-image-gallery.patch). It adds wheel zoom, pan, fit, actual size, and a contextual plugin toolbar. **Annotate image** opens the exact selected native attachment in this plugin, even if several revisions share the same filename. There is no image re-selection step.

The patch targets the local Paperclip source based on `9a9643ba5951c91abe05bda2a623a50e340a0f84`. Inspect repository status and check applicability before applying it:

```sh
git -C /path/to/paperclip status --short
git -C /path/to/paperclip apply --check /path/to/paperclip-image/patches/paperclip-image-gallery.patch
git -C /path/to/paperclip apply /path/to/paperclip-image/patches/paperclip-image-gallery.patch
pnpm --dir /path/to/paperclip/ui exec vite build --emptyOutDir false
```

Rebuild/reload the host UI using its normal deployment procedure. Keeping existing assets during a local static-UI rebuild lets already open clients finish using their current chunks. Reload the browser after the new UI is available. The host patch is UI-only: it does not add server routes, database tables, or plugin permissions. Native viewing and zoom also work without the plugin; the annotation action appears when the plugin's existing issue toolbar contribution is installed.

The narrow extension contract is the optional `imageGallery` component prop on an issue `toolbarButton` contribution: `{ id, contentPath, contentType, originalFilename }`. The plugin still receives ordinary company/issue scope through the public SDK bridge. Gallery deep links only select an image from the current task's authorized attachment list; query parameters never authorize a separate fetch.

Shortcuts: **V** pan, **P** pen, **A** arrow, **R** rectangle, **N** pin, **F** fit, **+ / −** zoom, **Ctrl/Cmd+Z** undo, **Ctrl/Cmd+Shift+Z** redo. Typing in text fields does not trigger these shortcuts.

## Privacy and reliability

- No external image service, AI API, telemetry, or separate account. Images are decoded and drawn in your browser; publishing uses the active user's same-origin Paperclip session and native authorization checks.
- Worker capabilities are limited to UI registration. Paperclip plugin UI is trusted same-origin code, not a security sandbox; review plugins before installing them.
- Only native raster attachments (PNG, JPEG, WebP, GIF, BMP) and explicitly selected local raster files are supported. Arbitrary URLs and SVG are excluded. Maximum input size: 20 MB, 24 megapixels, 16384 pixels on either side. Animated input produces a still PNG.
- Legacy agent uploads with a generic binary MIME type are recognized by their raster filename. File signatures are checked before decoding; an SVG or HTML file renamed to `.png` is rejected.
- Drafts remain in page memory. Download the PNG/JSON before closing, reloading, or navigating away; there is no persistent draft restore or JSON import in v0.1.
- Upload receipts and the comment's client request ID are retained for retries. If a response is lost, retry from the same draft. A failed comment can leave an uploaded image on the task; the plugin reports this and does not delete attachments. Closing the page loses the retry receipt; check the task before submitting a new draft.
- Native task attachments are supported; workspace file paths, remote links, documents' embedded images, and standalone agent-chat conversations are not indexed in v0.1. An image from those sources can be opened as a local file and attached to a selected task.

## Development and verification

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

The preview listens only on `127.0.0.1:3108` with synthetic task/image data and an in-memory native-API simulator. It never talks to a live Paperclip instance. Open the URL printed by the preview command. `scripts/fixtures/design.png` is a generated example, not customer work. CI runs type checking, tests, and build. Browser verification should cover zoom, drawing after pan/zoom, undo/redo, export dimensions, publication, lost-response retries, narrow layouts, theme, and locale.

## Further ideas

- A before/after comparison slider tied to image revisions.
- Resolve/reopen individual change requests across review rounds.
- Autosaved drafts with explicit retention controls.
- Crop a marked region and send both the crop and full-image context.

## License

Free and open source under the [MIT license](LICENSE), including commercial use, modification, and redistribution. Dependency licenses apply to their respective packages. There is no paid image-processing service required by this plugin.
