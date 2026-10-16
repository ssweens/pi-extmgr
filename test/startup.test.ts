import assert from "node:assert/strict";
import test from "node:test";
import {
  type ExtensionAPI,
  type ExtensionContext,
  type RegisteredCommand,
  type SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import extensionsManager from "../src/index.js";

void test("session startup returns without awaiting extmgr bootstrap", () => {
  let sessionStart: ((event: SessionStartEvent, ctx: ExtensionContext) => unknown) | undefined;
  let sessionShutdown: (() => unknown) | undefined;
  let command: Omit<RegisteredCommand, "name" | "sourceInfo"> | undefined;

  const pi = {
    registerCommand: (
      _name: string,
      registration: Omit<RegisteredCommand, "name" | "sourceInfo">
    ) => {
      command = registration;
    },
    registerShortcut: () => undefined,
    on: (event: string, handler: (...args: never[]) => unknown) => {
      if (event === "session_start") sessionStart = handler as typeof sessionStart;
      if (event === "session_shutdown") sessionShutdown = handler as typeof sessionShutdown;
      return () => undefined;
    },
  } as unknown as ExtensionAPI;

  extensionsManager(pi);
  assert.ok(command);
  assert.equal(typeof command.getArgumentCompletions, "function");
  assert.ok(sessionStart);

  const ctx = { mode: "tui" } as ExtensionContext;
  const result = sessionStart({ type: "session_start", reason: "startup" }, ctx);
  assert.equal(result, undefined);

  // Cancel the queued bootstrap before it imports session-only modules.
  sessionShutdown?.();
});

void test("command autocomplete loads asynchronously and retains manager suggestions", async () => {
  let command: Omit<RegisteredCommand, "name" | "sourceInfo"> | undefined;
  const pi = {
    registerCommand: (
      _name: string,
      registration: Omit<RegisteredCommand, "name" | "sourceInfo">
    ) => {
      command = registration;
    },
    registerShortcut: () => undefined,
    on: () => () => undefined,
  } as unknown as ExtensionAPI;

  extensionsManager(pi);
  assert.ok(command?.getArgumentCompletions);
  const completions = await command.getArgumentCompletions("pack");
  assert.ok(completions?.some((item) => item.value === "packages"));
});
