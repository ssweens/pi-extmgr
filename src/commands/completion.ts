import { getAgentDir, SettingsManager } from "@earendil-works/pi-coding-agent";
import { getProfileStorePath, readProfileStore } from "../profiles/store.js";
import { packageSourceString } from "../utils/package-source.js";
import { type LocalCompletionIndex, setLocalCompletionIndex } from "./completion-state.js";

export type { LocalCompletionIndex } from "./completion-state.js";

export async function refreshLocalCompletionIndex(
  cwd: string,
  projectTrusted = false
): Promise<LocalCompletionIndex> {
  const settings = SettingsManager.create(cwd, getAgentDir(), { projectTrusted });
  const installedPackages = [
    ...(settings.getGlobalSettings().packages ?? []),
    ...(settings.getProjectSettings().packages ?? []),
  ].map(packageSourceString);
  const savedProfiles = Object.keys((await readProfileStore(getProfileStorePath())).profiles);
  return setLocalCompletionIndex({
    installedPackages: [...new Set(installedPackages)].sort(),
    savedProfiles: [...new Set(savedProfiles)].sort(),
  });
}
