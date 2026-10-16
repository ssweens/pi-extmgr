import { type ChangeAction } from "../utils/history.js";

export const HISTORY_ACTIONS: readonly ChangeAction[] = [
  "extension_toggle",
  "extension_delete",
  "package_install",
  "package_update",
  "package_remove",
  "cache_clear",
  "auto_update_config",
];
