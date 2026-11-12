import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
export const PLUGIN_ID = "srahmel.image-review";
const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Image review",
  description:
    "Zoom into task images, draw precise feedback, and attach annotated copies to the task.",
  author: "srahmel",
  categories: ["ui"],
  capabilities: [
    "ui.page.register",
    "ui.sidebar.register",
    "ui.action.register",
  ],
  entrypoints: { worker: "./dist/worker.js", ui: "./dist/ui" },
  ui: {
    slots: [
      {
        type: "page",
        id: "review",
        displayName: "Image review",
        exportName: "ImageReviewPage",
        routePath: "image-review",
      },
      {
        type: "sidebar",
        id: "review-link",
        displayName: "Image review",
        exportName: "ImageReviewSidebar",
      },
      {
        type: "toolbarButton",
        id: "review-task",
        displayName: "Review images",
        exportName: "ImageReviewButton",
        entityTypes: ["issue"],
      },
    ],
  },
};
export default manifest;
