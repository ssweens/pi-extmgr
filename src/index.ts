/**
 * Extensions Manager - Enhanced UI/UX for managing Pi extensions and packages
 *
 * Keep this entrypoint small: manager UI and session-only work are loaded on demand.
 */
import {
  type ExtensionAPI,
  type ExtensionCommandContext,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import { logWarning, setConsoleDiagnosticsEnabled } from "./utils/log.js";

export default function extensionsManager(pi: ExtensionAPI) {
  let activeCtx: ExtensionContext | undefined;
  let stopSessionRuntime: (() => void) | undefined;

  pi.registerCommand("extensions", {
    description: "Manage local extensions and browse/install community packages",
    getArgumentCompletions: async (prefix) => {
      const { getExtensionsAutocompleteItems } = await import("./commands/autocomplete.js");
      return getExtensionsAutocompleteItems(prefix);
    },
    handler: async (args, ctx) => {
      const { handleExtensionsCommand } = await import("./manager-runtime.js");
      await handleExtensionsCommand(args, ctx, pi);
    },
  });

  pi.registerShortcut(Key.ctrlAlt("e"), {
    description: "Open the extensions manager",
    handler: async (ctx) => {
      // Shortcut contexts satisfy everything the manager uses at runtime
      // (ui, cwd, trust); command-only members like reload() are guarded.
      const { executeExtensionsCommand } = await import("./manager-runtime.js");
      await executeExtensionsCommand("", ctx as ExtensionCommandContext, pi);
    },
  });

  pi.on("session_start", (event, ctx) => {
    stopSessionRuntime?.();
    stopSessionRuntime = undefined;
    activeCtx = ctx;
    setConsoleDiagnosticsEnabled(ctx.mode !== "tui");

    // Don't hold extension loading open for config hydration, completion indexing,
    // scheduled update setup, or status discovery.
    setImmediate(() => {
      if (activeCtx !== ctx) return;
      void import("./session-runtime.js")
        .then(({ bootstrapSession }) => bootstrapSession(event, ctx, pi, () => activeCtx === ctx))
        .then((stopRuntime) => {
          if (!stopRuntime) return;
          if (activeCtx === ctx) {
            stopSessionRuntime = stopRuntime;
          } else {
            stopRuntime();
          }
        })
        .catch((error) => {
          logWarning("Failed to initialize extmgr session state:", error);
        });
    });
  });

  pi.on("session_shutdown", () => {
    activeCtx = undefined;
    stopSessionRuntime?.();
    stopSessionRuntime = undefined;
  });
}
