import { type CommandDefinition, type CommandId } from "./types.js";

export const COMMAND_METADATA: Record<
  CommandId,
  Omit<CommandDefinition, "runInteractive" | "runNonInteractive">
> = {
  local: { id: "local", description: "Open interactive manager (default)" },
  list: { id: "list", description: "List local extensions" },
  remote: { id: "remote", description: "Browse community packages", aliases: ["packages"] },
  installed: { id: "installed", description: "List installed packages" },
  search: { id: "search", description: "Search npm for packages" },
  install: { id: "install", description: "Install a package" },
  remove: {
    id: "remove",
    description: "Remove an installed package",
    aliases: ["uninstall"],
  },
  update: { id: "update", description: "Preview or update selected packages" },
  history: { id: "history", description: "View extension change history" },
  "clear-cache": { id: "clear-cache", description: "Clear metadata cache" },
  trash: { id: "trash", description: "List, restore, or purge local extension trash" },
  "auto-update": { id: "auto-update", description: "Configure scheduled update checks" },
  doctor: { id: "doctor", description: "Inspect runtime command/tool ownership and conflicts" },
  profile: { id: "profile", description: "Save, import, check, review, or apply a profile" },
};
