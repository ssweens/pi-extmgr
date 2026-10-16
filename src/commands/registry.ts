import {
  type ExtensionAPI,
  type ExtensionCommandContext,
  VERSION,
} from "@earendil-works/pi-coding-agent";
import { inspectInstalledPackageCompatibility } from "../doctor/compatibility.js";
import { findRuntimeConflicts } from "../doctor/conflicts.js";
import { getRuntimeOwners } from "../doctor/runtime.js";
import { getInstalledPackagesAllScopes } from "../packages/discovery.js";
import { promptRemove, removePackage, showInstalledPackagesList } from "../packages/management.js";
import { showRemote } from "../ui/remote.js";
import { showReport } from "../ui/report.js";
import { showInstalledPackagesLegacy, showInteractive, showListOnly } from "../ui/unified.js";
import { notify } from "../utils/notify.js";
import { handleAutoUpdateSubcommand } from "./auto-update.js";
import { clearMetadataCacheCommand } from "./cache.js";
import { handleHistorySubcommand } from "./history.js";
import { COMMAND_METADATA } from "./metadata.js";
import { handleInstallSubcommand, INSTALL_USAGE } from "./install.js";
import { handleProfileSubcommand } from "./profile.js";
import { handleTrashSubcommand } from "./trash.js";
import { type CommandDefinition, type CommandId } from "./types.js";
import { handleUpdateSubcommand } from "./update.js";

const REMOVE_USAGE = "Usage: /extensions remove <npm:package|git:url|path>";

async function showDoctor(ctx: ExtensionCommandContext, pi: ExtensionAPI): Promise<void> {
  const owners = getRuntimeOwners(pi);
  const conflicts = findRuntimeConflicts(owners);
  const packages = await getInstalledPackagesAllScopes(ctx);
  const compatibility = await inspectInstalledPackageCompatibility(packages, {
    piVersion: VERSION,
  });
  const lines = [`Runtime ownership: ${owners.length} command/tool entries`];
  lines.push("Installed package compatibility:");
  if (compatibility.length === 0) {
    lines.push("- none installed");
  } else {
    for (const diagnostic of compatibility) {
      lines.push(
        `- ${diagnostic.source} (${diagnostic.scope}): Node ${diagnostic.node}, Pi ${diagnostic.pi}`
      );
      for (const reason of diagnostic.reasons) lines.push(`  ${reason}`);
    }
  }
  if (conflicts.length === 0) {
    lines.push("No command conflicts detected.");
  } else {
    lines.push(`Conflicts detected: ${conflicts.length}`);
    for (const conflict of conflicts) {
      lines.push(`- ${conflict.kind} ${conflict.name}:`);
      for (const owner of conflict.owners) {
        lines.push(`  ${owner.source} (${owner.scope}) ${owner.path}`);
      }
    }
  }
  await showReport(ctx, {
    title: "Doctor",
    size: "wide",
    level: conflicts.length > 0 ? "warning" : "info",
    lines,
  });
}

function requireInteractiveCommand(ctx: ExtensionCommandContext, feature: string): void {
  notify(ctx, `${feature} requires interactive mode.`, "warning");
}

export function showNonInteractiveHelp(ctx: ExtensionCommandContext): void {
  const lines = [
    "Extensions Manager (non-interactive mode)",
    "Remote package browsing requires interactive mode.",
    "",
    "Available commands:",
    "  /extensions list      - List local extensions",
    "  /extensions installed - List installed packages",
    `  ${INSTALL_USAGE} - Install a package`,
    "  /extensions remove <source>  - Remove a package",
    "  /extensions update [source]  - Update one package or all packages",
    "  /extensions history [opts]   - Show history (supports filters)",
    "  /extensions doctor           - Inspect runtime ownership/conflicts",
    "  /extensions profile <action> - Save, import, check, review, or apply a profile",
    "  /extensions auto-update <d>  - Configure scheduled update checks (e.g. 1d, 1w, 1mo, never)",
    "",
    "History examples:",
    "  /extensions history --failed --limit 50",
    "  /extensions history --action package_update --since 7d",
    "  /extensions history --global --package extmgr --since 24h",
  ];

  notify(ctx, lines.join("\n"), "info");
}

const COMMAND_DEFINITIONS: Record<CommandId, CommandDefinition> = {
  local: {
    ...COMMAND_METADATA.local,
    runInteractive: (_tokens, ctx, pi) => showInteractive(ctx, pi),
    runNonInteractive: (_tokens, ctx) => showListOnly(ctx),
  },
  list: {
    ...COMMAND_METADATA.list,
    runInteractive: (_tokens, ctx) => showListOnly(ctx),
    runNonInteractive: (_tokens, ctx) => showListOnly(ctx),
  },
  remote: {
    ...COMMAND_METADATA.remote,
    runInteractive: async (tokens, ctx, pi) => {
      await showRemote(tokens.join(" "), ctx, pi);
    },
    runNonInteractive: (_tokens, ctx) => {
      requireInteractiveCommand(ctx, "Remote package browsing");
      showNonInteractiveHelp(ctx);
    },
  },
  installed: {
    ...COMMAND_METADATA.installed,
    runInteractive: (_tokens, ctx, pi) => showInstalledPackagesLegacy(ctx, pi),
    runNonInteractive: (_tokens, ctx, pi) => showInstalledPackagesList(ctx, pi),
  },
  search: {
    ...COMMAND_METADATA.search,
    runInteractive: async (tokens, ctx, pi) => {
      await showRemote(`search ${tokens.join(" ")}`, ctx, pi);
    },
    runNonInteractive: (_tokens, ctx) => {
      requireInteractiveCommand(ctx, "Search");
      showNonInteractiveHelp(ctx);
    },
  },
  install: {
    ...COMMAND_METADATA.install,
    runInteractive: async (tokens, ctx, pi) => {
      if (tokens.length > 0) await handleInstallSubcommand(tokens, ctx, pi);
      else await showRemote("install", ctx, pi);
    },
    runNonInteractive: (tokens, ctx, pi) =>
      tokens.length > 0
        ? handleInstallSubcommand(tokens, ctx, pi)
        : notify(ctx, INSTALL_USAGE, "info"),
  },
  remove: {
    ...COMMAND_METADATA.remove,
    runInteractive: (tokens, ctx, pi) =>
      tokens.length > 0 ? removePackage(tokens.join(" "), ctx, pi) : promptRemove(ctx, pi),
    runNonInteractive: (tokens, ctx, pi) =>
      tokens.length > 0
        ? removePackage(tokens.join(" "), ctx, pi)
        : notify(ctx, REMOVE_USAGE, "info"),
  },
  update: {
    ...COMMAND_METADATA.update,
    runInteractive: (tokens, ctx, pi) => handleUpdateSubcommand(tokens, ctx, pi),
    runNonInteractive: (tokens, ctx, pi) => handleUpdateSubcommand(tokens, ctx, pi),
  },
  history: {
    ...COMMAND_METADATA.history,
    runInteractive: (tokens, ctx, pi) => handleHistorySubcommand(ctx, pi, tokens, false),
    runNonInteractive: (tokens, ctx, pi) => handleHistorySubcommand(ctx, pi, tokens, true),
  },
  "clear-cache": {
    ...COMMAND_METADATA["clear-cache"],
    runInteractive: (_tokens, ctx, pi) => clearMetadataCacheCommand(ctx, pi),
    runNonInteractive: (_tokens, ctx, pi) => clearMetadataCacheCommand(ctx, pi),
  },
  trash: {
    ...COMMAND_METADATA.trash,
    runInteractive: async (tokens, ctx, pi) => {
      await handleTrashSubcommand(tokens, ctx, pi);
    },
    runNonInteractive: async (tokens, ctx, pi) => {
      await handleTrashSubcommand(tokens, ctx, pi);
    },
  },
  "auto-update": {
    ...COMMAND_METADATA["auto-update"],
    runInteractive: (tokens, ctx, pi) => handleAutoUpdateSubcommand(tokens, ctx, pi),
    runNonInteractive: (tokens, ctx, pi) => handleAutoUpdateSubcommand(tokens, ctx, pi),
  },
  doctor: {
    ...COMMAND_METADATA.doctor,
    runInteractive: (_tokens, ctx, pi) => showDoctor(ctx, pi),
    runNonInteractive: (_tokens, ctx, pi) => showDoctor(ctx, pi),
  },
  profile: {
    ...COMMAND_METADATA.profile,
    runInteractive: (tokens, ctx, pi) => handleProfileSubcommand(tokens, ctx, pi),
    runNonInteractive: (tokens, ctx, pi) => handleProfileSubcommand(tokens, ctx, pi),
  },
};

function buildCommandAliasMap(
  definitions: Record<CommandId, CommandDefinition>
): Record<string, CommandId> {
  const map: Record<string, CommandId> = {};
  for (const def of Object.values(definitions)) {
    map[def.id] = def.id;
    for (const alias of def.aliases ?? []) {
      map[alias] = def.id;
    }
  }
  return map;
}

const COMMAND_ALIAS_TO_ID: Record<string, CommandId> = buildCommandAliasMap(COMMAND_DEFINITIONS);

export function resolveCommand(tokens: string[]): { id: CommandId; args: string[] } | undefined {
  if (tokens.length === 0) {
    return { id: "local", args: [] };
  }

  const normalized = tokens[0]?.toLowerCase() ?? "";
  const id = COMMAND_ALIAS_TO_ID[normalized];
  if (!id) return undefined;

  return { id, args: tokens.slice(1) };
}

export function runResolvedCommand(
  resolved: { id: CommandId; args: string[] },
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI
): Promise<void> | void {
  const definition = COMMAND_DEFINITIONS[resolved.id];
  const runner = ctx.hasUI ? definition.runInteractive : definition.runNonInteractive;
  return runner(resolved.args, ctx, pi);
}

export function showUnknownCommandMessage(
  rawSubcommand: string | undefined,
  ctx: ExtensionCommandContext
): void {
  const known = Object.keys(COMMAND_ALIAS_TO_ID)
    .filter((key) => key === COMMAND_ALIAS_TO_ID[key])
    .sort()
    .join(", ");

  notify(ctx, `Unknown command: ${rawSubcommand ?? "(empty)"}. Try: ${known}`, "warning");
}
