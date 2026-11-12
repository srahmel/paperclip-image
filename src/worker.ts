import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
const plugin = definePlugin({
  async setup() {},
  async onHealth() {
    return { status: "ok", message: "Image review is ready" };
  },
});
export default plugin;
runWorker(plugin, import.meta.url);
