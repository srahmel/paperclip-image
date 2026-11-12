import { createRoot } from "react-dom/client";
import { ImageReviewPage, ImageReviewButton } from "../src/ui/index.js";
createRoot(document.getElementById("root")!).render(
  <>
    <div
      style={{
        padding: "10px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        fontSize: 12,
      }}
    >
      <strong>Paperclip · Plugin preview</strong>
      <span>Synthetic example · no live task changes</span>
      <ImageReviewButton />
      <button onClick={() => document.documentElement.classList.toggle("dark")}>
        Toggle theme
      </button>
      <button
        onClick={() => {
          document.documentElement.lang =
            document.documentElement.lang === "en" ? "de" : "en";
        }}
      >
        EN / DE
      </button>
    </div>
    <ImageReviewPage />
  </>,
);
