import esbuild from "esbuild";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";
import { resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL(".", import.meta.url));
const outdir = resolve(root, process.env.PAPERCLIP_PLUGIN_OUTDIR || "dist");
const outputPath = relative(root, outdir);
if (!outputPath || outputPath.startsWith("..") || isAbsolute(outputPath)) {
  throw new Error("Plugin output must be inside the project directory");
}
const presets = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx", outdir });
const builds = await Promise.all(
  Object.values(presets.esbuild).map((config) =>
    esbuild.context({ ...config, loader: { ".css": "text" } }),
  ),
);
if (process.argv.includes("--watch")) {
  await Promise.all(builds.map((build) => build.watch()));
  console.log("Watching plugin sources");
} else {
  await Promise.all(builds.map((build) => build.rebuild()));
  await Promise.all(builds.map((build) => build.dispose()));
}
