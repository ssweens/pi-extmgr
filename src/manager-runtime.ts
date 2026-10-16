/** Manager command implementation, loaded only when a command or shortcut is used. */
import { type ExtensionAPI, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { refreshLocalCompletionIndex } from "./commands/completion.js";
import {
  resolveCommand,
  runResolvedCommand,
  showNonInteractiveHelp,
  showUnknownCommandMessage,
} from "./commands/registry.js";
import { installPackage } from "./packages/install.js";
import { restorePiTitle } from "./ui/workspace/title.js";
import { tokenizeArgs } from "./utils/command.js";
import { isPackageSource } from "./utils/format.js";
import { logWarning } from "./utils/log.js";
import { isProjectTrusted } from "./utils/mode.js";
import { wasContextReloaded } from "./utils/ui-helpers.js";

export async function executeExtensionsCommand(
  args: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI
): Promise<void> {
  try {
    const tokens = tokenizeArgs(args);
    const resolved = resolveCommand(tokens);

    if (resolved) {
      await runResolvedCommand(resolved, ctx, pi);
      return;
    }

    const rawSubcommand = tokens[0];
    if (rawSubcommand && isPackageSource(rawSubcommand)) {
      await installPackage(args.trim(), ctx, pi);
      return;
    }

    if (ctx.hasUI) {
      showUnknownCommandMessage(rawSubcommand, ctx);
    } else {
      showNonInteractiveHelp(ctx);
    }
  } finally {
    // Workspace screens set the terminal title while open; hand it back to
    // pi's format on the way out. After an in-process reload pi re-asserts
    // its own title, so skip touching the stale context.
    if (!wasContextReloaded(ctx)) {
      restorePiTitle(ctx);
    }
  }
}

export async function handleExtensionsCommand(
  args: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI
): Promise<void> {
  await executeExtensionsCommand(args, ctx, pi);
  if (wasContextReloaded(ctx)) return;
  await refreshLocalCompletionIndex(ctx.cwd, isProjectTrusted(ctx)).catch((error) => {
    logWarning("Failed to refresh local completions:", error);
  });
}
