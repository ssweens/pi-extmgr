import { type AutocompleteItem } from "@earendil-works/pi-tui";
import { getLocalCompletionIndex, getProfileCompletionOptions } from "./completion-state.js";
import { HISTORY_ACTIONS } from "./history-actions.js";
import { COMMAND_METADATA } from "./metadata.js";

function completionItems(options: string[], prefix: string): AutocompleteItem[] | null {
  const matches = options.filter((option) => option.toLowerCase().startsWith(prefix.toLowerCase()));
  return matches.length > 0 ? matches.map((value) => ({ value, label: value })) : null;
}

export function getExtensionsAutocompleteItems(prefix: string): AutocompleteItem[] | null {
  const commandPrefix = (prefix ?? "").trimStart();
  if (commandPrefix.includes(" ")) {
    const trailingSpace = /\s$/.test(commandPrefix);
    const tokens = commandPrefix.replace(/^\//, "").split(/\s+/).filter(Boolean);
    const command = tokens.shift()?.toLowerCase() ?? "";
    const activePrefix = trailingSpace ? "" : (tokens.pop() ?? "");
    const completedArgs = tokens;
    const local = getLocalCompletionIndex();

    if ((command === "remove" || command === "uninstall") && completedArgs.length === 0) {
      return completionItems(local.installedPackages, activePrefix);
    }
    if (command === "update" && completedArgs.length === 0) {
      return completionItems(["--all", "--preview", ...local.installedPackages], activePrefix);
    }
    if (command === "profile") {
      const options = getProfileCompletionOptions(completedArgs);
      return options ? completionItems(options, activePrefix) : null;
    }
    if (command === "history") {
      if (completedArgs.at(-1) === "--action") {
        return completionItems([...HISTORY_ACTIONS], activePrefix);
      }
      // Completions only run in the interactive editor, where --global is refused.
      return completionItems(
        ["--action", "--failed", "--success", "--limit", "--package", "--since"],
        activePrefix
      );
    }
    if (command === "trash") {
      if (completedArgs.length === 0) {
        return completionItems(["list", "restore", "purge"], activePrefix);
      }
      return completedArgs.length === 1 && completedArgs[0]?.toLowerCase() === "purge"
        ? completionItems(["all"], activePrefix)
        : null;
    }
    const argumentOptions: Record<string, string[]> = {
      install: ["--global", "--project"],
      "auto-update": ["daily", "weekly", "monthly", "never"],
    };
    return completionItems(argumentOptions[command] ?? [], activePrefix);
  }

  const items = Object.values(COMMAND_METADATA).flatMap((command) => {
    const base = [{ value: command.id, description: command.description }];
    const aliases = (command.aliases ?? []).map((alias) => ({
      value: alias,
      description: `${command.description} (alias)`,
    }));
    return [...base, ...aliases];
  });

  const safePrefix = (prefix ?? "").toLowerCase();
  const filtered = items.filter(
    (item) =>
      item.value.toLowerCase().startsWith(safePrefix) ||
      item.description.toLowerCase().includes(safePrefix)
  );

  return filtered.length > 0
    ? filtered.map((item) => ({ value: item.value, label: `${item.value} - ${item.description}` }))
    : null;
}
