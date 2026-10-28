import { presentThreadShell } from "@t3tools/client-runtime/state/models";
import type { EnvironmentId, OrchestrationV2ThreadShell } from "@t3tools/contracts";
import { resolveThreadListV2Status } from "../threads/threadListV2";
import { WORKING_EXIT_GRACE_MS } from "@t3tools/client-runtime/state/thread-inbox";

export interface LocalCompletionThread {
  readonly id: string;
  readonly runId: string | null;
  readonly completed: boolean;
  readonly quiet: boolean;
  readonly title: string;
}
export interface LocalCompletionSnapshot {
  readonly generation: number;
  readonly live: boolean;
  readonly threads: ReadonlyArray<LocalCompletionThread>;
}
export function createLocalCompletionNotifications(options: {
  readonly canNotify: (environmentId: string) => boolean;
  readonly notify: (environmentId: string, thread: LocalCompletionThread) => void;
}) {
  const environments = new Map<
    string,
    {
      generation: number;
      previous: ReadonlyMap<string, LocalCompletionThread>;
      readonly handled: Map<string, string>;
      readonly pending: Map<string, ReturnType<typeof setTimeout>>;
    }
  >();
  const cancel = (environmentId: string, threadId?: string) => {
    const state = environments.get(environmentId);
    if (!state) return;
    for (const [id, timer] of state.pending) {
      if (threadId !== undefined && threadId !== id) continue;
      clearTimeout(timer);
      state.pending.delete(id);
    }
  };
  return {
    observe(environmentId: string, snapshot: LocalCompletionSnapshot) {
      const previous = environments.get(environmentId);
      if (!snapshot.live) {
        cancel(environmentId);
        environments.delete(environmentId);
        return;
      }
      const next = new Map(snapshot.threads.map((thread) => [thread.id, thread]));
      if (!previous || previous.generation !== snapshot.generation) {
        cancel(environmentId);
        environments.set(environmentId, {
          generation: snapshot.generation,
          previous: next,
          handled: new Map(
            snapshot.threads.flatMap((thread) =>
              thread.completed && thread.runId !== null ? [[thread.id, thread.runId]] : [],
            ),
          ),
          pending: new Map(),
        });
        return;
      }
      for (const id of previous.previous.keys()) {
        if (!next.has(id)) {
          cancel(environmentId, id);
          previous.handled.delete(id);
        }
      }
      for (const thread of snapshot.threads) {
        const prior = previous.previous.get(thread.id);
        if (!thread.completed || thread.quiet || thread.runId !== prior?.runId)
          cancel(environmentId, thread.id);
        if (!thread.completed || thread.runId === null) continue;
        if (!prior || thread.quiet || !options.canNotify(environmentId)) {
          previous.handled.set(thread.id, thread.runId);
          cancel(environmentId, thread.id);
          continue;
        }
        if (previous.handled.get(thread.id) === thread.runId || previous.pending.has(thread.id))
          continue;
        const runId = thread.runId;
        previous.pending.set(
          thread.id,
          setTimeout(() => {
            previous.pending.delete(thread.id);
            previous.handled.set(thread.id, runId);
            const latest = previous.previous.get(thread.id);
            if (
              latest?.completed &&
              !latest.quiet &&
              latest.runId === thread.runId &&
              options.canNotify(environmentId)
            )
              options.notify(environmentId, latest);
          }, WORKING_EXIT_GRACE_MS),
        );
      }
      previous.previous = next;
    },
    forget(environmentId: string) {
      cancel(environmentId);
      environments.delete(environmentId);
    },
    dispose() {
      for (const environmentId of environments.keys()) cancel(environmentId);
      environments.clear();
    },
  };
}

export interface LocalCompletionCurrent {
  readonly generation: number;
  readonly live: boolean;
  readonly thread: LocalCompletionThread | undefined;
}

export async function presentLocalCompletionNotification(options: {
  readonly thread: LocalCompletionThread;
  readonly current: () => LocalCompletionCurrent;
  readonly canNotify: () => boolean;
  readonly permitted: () => Promise<boolean>;
  readonly configureChannel: () => Promise<void>;
  readonly schedule: (thread: LocalCompletionThread) => Promise<void>;
}) {
  const generation = options.current().generation;
  if (!(await options.permitted()) || !options.canNotify()) return;
  const current = options.current();
  if (
    !current.live ||
    current.generation !== generation ||
    current.thread?.runId !== options.thread.runId ||
    !current.thread.completed ||
    current.thread.quiet
  )
    return;
  await options.configureChannel();
  const latest = options.current();
  if (
    !options.canNotify() ||
    !latest.live ||
    latest.generation !== generation ||
    latest.thread?.runId !== options.thread.runId ||
    !latest.thread.completed ||
    latest.thread.quiet
  )
    return;
  await options.schedule(latest.thread);
}

export function localCompletionThread(
  environmentId: EnvironmentId,
  raw: OrchestrationV2ThreadShell,
): LocalCompletionThread {
  const thread = presentThreadShell(environmentId, raw);
  return {
    id: raw.id,
    runId: raw.latestRunId,
    title: raw.title,
    completed:
      thread.latestRun?.status === "completed" &&
      thread.latestRun.completedAt !== null &&
      resolveThreadListV2Status(thread) === "ready",
    quiet: raw.latestRunStopRequested === true || raw.archivedAt !== null || raw.deletedAt !== null,
  };
}

export function localCompletionAllowed(input: {
  readonly appState: string | null | undefined;
  readonly enabled: boolean;
  readonly connected: boolean;
  readonly pushRegistered: boolean;
  readonly publishesActivity: boolean | undefined;
}): boolean {
  return (
    input.appState === "background" &&
    input.enabled &&
    input.connected &&
    !(input.pushRegistered && input.publishesActivity !== false)
  );
}
