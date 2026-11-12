import esbuild from "esbuild";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";
const presets = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx" });
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
