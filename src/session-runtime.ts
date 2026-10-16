/** Session-only work, started after Pi has finished loading extensions. */
import {
  type ExtensionAPI,
  type ExtensionContext,
  type SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import { clearReloadRequired } from "./utils/reload-state.js";
import { getAutoUpdateConfig, hydrateAutoUpdateConfig } from "./utils/settings.js";
import { isProjectTrusted } from "./utils/mode.js";
import { logWarning } from "./utils/log.js";

type IsCurrentSession = () => boolean;

let sessionGeneration = 0;
let activeAutoUpdateStop: (() => void) | undefined;

export async function bootstrapSession(
  event: SessionStartEvent,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  isCurrent: IsCurrentSession
): Promise<(() => void) | undefined> {
  if (!isCurrent()) return undefined;
  activeAutoUpdateStop?.();
  activeAutoUpdateStop = undefined;
  const generation = ++sessionGeneration;

  if (event.reason === "reload") {
    // A stale marker is harmless; an unwritable cache dir must not prevent the
    // rest of session initialization.
    await clearReloadRequired().catch((error) => {
      logWarning("Failed to clear the reload-required marker:", error);
    });
  }
  if (!isCurrent() || generation !== sessionGeneration) return undefined;

  // Restore persisted auto-update config into session entries so sync lookups are valid.
  await hydrateAutoUpdateConfig(pi, ctx);
  if (!isCurrent() || generation !== sessionGeneration) return undefined;

  const { refreshLocalCompletionIndex } = await import("./commands/completion.js");
  if (!isCurrent() || generation !== sessionGeneration) return undefined;
  await refreshLocalCompletionIndex(ctx.cwd, isProjectTrusted(ctx)).catch((error) => {
    logWarning("Failed to load local completions:", error);
  });
  if (!isCurrent() || generation !== sessionGeneration) return undefined;

  let stopAutoUpdateTimer: (() => void) | undefined;
  if (ctx.hasUI) {
    const config = getAutoUpdateConfig(ctx);
    if (config.enabled && config.intervalMs > 0) {
      const [autoUpdate, commands] = await Promise.all([
        import("./utils/auto-update.js"),
        import("./commands/auto-update.js"),
      ]);
      if (!isCurrent() || generation !== sessionGeneration) return undefined;

      const getCtx = () => (isCurrent() ? ctx : undefined);
      autoUpdate.startAutoUpdateTimer(
        pi,
        getCtx,
        commands.createAutoUpdateNotificationHandler(ctx)
      );
      activeAutoUpdateStop = autoUpdate.stopAutoUpdateTimer;
      stopAutoUpdateTimer = () => {
        if (activeAutoUpdateStop === autoUpdate.stopAutoUpdateTimer) {
          activeAutoUpdateStop();
          activeAutoUpdateStop = undefined;
        }
      };
    }
  }

  setImmediate(() => {
    if (!isCurrent() || generation !== sessionGeneration || !ctx.hasUI) return;
    void import("./utils/status.js")
      .then(({ updateExtmgrStatus }) => {
        if (!isCurrent() || generation !== sessionGeneration) return;
        return updateExtmgrStatus(ctx, pi);
      })
      .catch((error) => {
        logWarning("Status update failed:", error);
      });
  });

  return () => {
    if (generation !== sessionGeneration) return;
    sessionGeneration += 1;
    stopAutoUpdateTimer?.();
  };
}
