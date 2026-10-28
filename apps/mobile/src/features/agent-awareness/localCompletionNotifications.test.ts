import { EnvironmentId, RunId, type OrchestrationV2ThreadShell } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { makeRawThreadShell } from "../../test-fixtures";
import { expect, it, vi } from "vite-plus/test";
import { WORKING_EXIT_GRACE_MS } from "@t3tools/client-runtime/state/thread-inbox";
import {
  createLocalCompletionNotifications,
  localCompletionAllowed,
  localCompletionThread,
  presentLocalCompletionNotification,
  type LocalCompletionThread,
  type LocalCompletionCurrent,
} from "./localCompletionNotifications";

function setup() {
  vi.useFakeTimers();
  const notifications: Array<{ environmentId: string; thread: LocalCompletionThread }> = [];
  const state = { background: true, enabled: true, push: false };
  const tracker = createLocalCompletionNotifications({
    canNotify: () =>
      localCompletionAllowed({
        appState: state.background ? "background" : "active",
        enabled: state.enabled,
        connected: true,
        pushRegistered: state.push,
        publishesActivity: true,
      }),
    notify: (environmentId, thread) => notifications.push({ environmentId, thread }),
  });
  const thread = (completed: boolean, runId = "run-1", quiet = false): LocalCompletionThread => ({
    id: "thread-1",
    runId,
    completed,
    quiet,
    title: "Original title שלום",
  });
  const observe = (
    environmentId: string,
    threads: LocalCompletionThread[],
    generation = 1,
    live = true,
  ) => tracker.observe(environmentId, { threads, generation, live });
  return {
    notifications,
    state,
    tracker,
    thread,
    observe,
    [Symbol.dispose]() {
      tracker.dispose();
      vi.useRealTimers();
    },
  };
}

it("notifies once for a live completion after the continuation grace, scoped by environment and run", () => {
  using h = setup();
  for (const env of ["machine-a", "machine-b"]) h.observe(env, [h.thread(false)]);
  h.observe("machine-a", [h.thread(true)]);
  h.observe("machine-a", [h.thread(true)]);
  vi.advanceTimersByTime(WORKING_EXIT_GRACE_MS - 1);
  expect(h.notifications).toEqual([]);
  vi.advanceTimersByTime(1);
  expect(h.notifications.map((n) => [n.environmentId, n.thread.runId, n.thread.title])).toEqual([
    ["machine-a", "run-1", "Original title שלום"],
  ]);
  h.observe("machine-a", [h.thread(false)]);
  h.observe("machine-a", [h.thread(true)]);
  vi.advanceTimersByTime(WORKING_EXIT_GRACE_MS);
  expect(h.notifications).toHaveLength(1);
  h.observe("machine-a", [h.thread(false, "run-2")]);
  h.observe("machine-a", [h.thread(true, "run-2")]);
  h.observe("machine-b", [h.thread(true)]);
  vi.advanceTimersByTime(WORKING_EXIT_GRACE_MS);
  expect(h.notifications.map((n) => [n.environmentId, n.thread.runId])).toEqual([
    ["machine-a", "run-1"],
    ["machine-a", "run-2"],
    ["machine-b", "run-1"],
  ]);
});

it("does not replay snapshots, reconnects, newly discovered threads, or a disabled-period completion", () => {
  using h = setup();
  h.observe("env", [h.thread(true)]);
  h.observe("env", [h.thread(false, "run-2")]);
  h.observe("env", [h.thread(true, "run-2")], 2);
  h.observe("env", [h.thread(false, "run-3")], 2);
  h.observe("env", [], 2, false);
  h.observe("env", [h.thread(true, "run-3")], 2);
  h.state.enabled = false;
  h.observe("env", [h.thread(false, "run-4")], 2);
  h.observe("env", [h.thread(true, "run-4")], 2);
  h.state.enabled = true;
  h.observe("env", [h.thread(true, "run-4")], 2);
  h.observe("env", [h.thread(true, "run-4"), { ...h.thread(true), id: "new-thread" }], 2);
  vi.runAllTimers();
  expect(h.notifications).toEqual([]);
  h.observe("env", [h.thread(false, "run-5")], 2);
  h.observe("env", [h.thread(true, "run-5")], 2);
  vi.advanceTimersByTime(WORKING_EXIT_GRACE_MS);
  expect(h.notifications).toHaveLength(1);
});

it.each(["foreground", "disabled", "push"] as const)(
  "suppresses a completion while %s, including changes during grace",
  (mode) => {
    using h = setup();
    const suppress = () => {
      if (mode === "foreground") h.state.background = false;
      else if (mode === "disabled") h.state.enabled = false;
      else h.state.push = true;
    };
    h.observe("env", [h.thread(false)]);
    suppress();
    h.observe("env", [h.thread(true)]);
    h.state.background = true;
    h.state.enabled = true;
    h.state.push = false;
    vi.advanceTimersByTime(WORKING_EXIT_GRACE_MS);
    expect(h.notifications).toEqual([]);
    h.observe("env", [h.thread(false, "run-2")]);
    h.observe("env", [h.thread(true, "run-2")]);
    suppress();
    vi.advanceTimersByTime(WORKING_EXIT_GRACE_MS);
    expect(h.notifications).toEqual([]);
  },
);

it.each([
  "continuation",
  "stopped",
  "disconnect",
  "generation",
  "removed",
  "forget",
  "dispose",
] as const)("cancels pending completion on %s", (change) => {
  using h = setup();
  h.observe("env", [h.thread(false)]);
  h.observe("env", [h.thread(true)]);
  if (change === "continuation") h.observe("env", [h.thread(false, "run-2")]);
  if (change === "stopped") h.observe("env", [h.thread(true, "run-1", true)]);
  if (change === "disconnect") h.observe("env", [h.thread(true)], 1, false);
  if (change === "generation") h.observe("env", [h.thread(true)], 2);
  if (change === "removed") h.observe("env", []);
  if (change === "forget") h.tracker.forget("env");
  if (change === "dispose") h.tracker.dispose();
  vi.runAllTimers();
  expect(h.notifications).toEqual([]);
});

it.each(["run", "generation", "disconnect", "quiet", "removed"] as const)(
  "does not present stale completion after channel setup races with %s",
  async (change) => {
    const thread: LocalCompletionThread = {
      id: "thread",
      runId: "run",
      completed: true,
      quiet: false,
      title: "Original",
    };
    let current: LocalCompletionCurrent = { generation: 1, live: true, thread };
    const entered = Promise.withResolvers<void>();
    const channel = Promise.withResolvers<void>();
    const delivered: LocalCompletionThread[] = [];
    const presenting = presentLocalCompletionNotification({
      thread,
      current: () => current,
      canNotify: () => true,
      permitted: async () => true,
      configureChannel: () => {
        entered.resolve();
        return channel.promise;
      },
      schedule: async (notification) => {
        delivered.push(notification);
      },
    });
    await entered.promise;
    if (change === "run")
      current = { ...current, thread: { ...thread, runId: "next", completed: false } };
    if (change === "generation") current = { ...current, generation: 2 };
    if (change === "disconnect") current = { ...current, live: false };
    if (change === "quiet") current = { ...current, thread: { ...thread, quiet: true } };
    if (change === "removed") current = { ...current, thread: undefined };
    channel.resolve();
    await presenting;
    expect(delivered).toEqual([]);
  },
);

it("uses the current title and requires permission and background eligibility when presenting", async () => {
  const thread: LocalCompletionThread = {
    id: "thread",
    runId: "run",
    completed: true,
    quiet: false,
    title: "Before",
  };
  let allowed = true;
  let granted = false;
  let current: LocalCompletionCurrent = { generation: 1, live: true, thread };
  const delivered: LocalCompletionThread[] = [];
  const present = () =>
    presentLocalCompletionNotification({
      thread,
      current: () => current,
      canNotify: () => allowed,
      permitted: async () => granted,
      configureChannel: async () => {
        current = { ...current, thread: { ...thread, title: "After שלום" } };
      },
      schedule: async (notification) => {
        delivered.push(notification);
      },
    });
  await present();
  granted = true;
  allowed = false;
  await present();
  expect(delivered).toEqual([]);
  allowed = true;
  await present();
  expect(delivered.map((n) => n.title)).toEqual(["After שלום"]);
});

it.each([
  [{ status: "completed" }, true, false],
  [{ status: "running" }, false, false],
  [{ status: "waiting" }, false, false],
  [{ status: "idle" }, false, false],
  [{ status: "failed" }, false, false],
  [{ status: "cancelled" }, false, false],
  [{ status: "completed", activityRunStatus: "running" }, false, false],
  [{ status: "completed", latestRunId: null }, false, false],
  [{ status: "completed", latestRunStopRequested: true }, true, true],
] satisfies Array<[Partial<OrchestrationV2ThreadShell>, boolean, boolean]>)(
  "recognizes completed runs without treating idle background work as completion: %j",
  (overrides, completed, quiet) => {
    const raw = makeRawThreadShell({
      latestRunId: RunId.make("run"),
      latestRunCompletedAt: DateTime.makeUnsafe("2026-10-28T12:00:00Z"),
      ...overrides,
    });
    expect(localCompletionThread(EnvironmentId.make("env"), raw)).toMatchObject({
      completed,
      quiet,
    });
  },
);

it("uses publication capability per machine when a device is registered for push", () => {
  const device = {
    appState: "background",
    enabled: true,
    connected: true,
    pushRegistered: true,
  } as const;
  expect(localCompletionAllowed({ ...device, publishesActivity: false })).toBe(true);
  expect(localCompletionAllowed({ ...device, publishesActivity: true })).toBe(false);
  expect(localCompletionAllowed({ ...device, publishesActivity: undefined })).toBe(false);
  expect(
    localCompletionAllowed({ ...device, pushRegistered: false, publishesActivity: undefined }),
  ).toBe(true);
  expect(
    localCompletionAllowed({
      ...device,
      pushRegistered: false,
      publishesActivity: false,
      connected: false,
    }),
  ).toBe(false);
});
