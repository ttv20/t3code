import {
  TurnItemId,
  NodeId,
  MessageId,
  ProviderInstanceId,
  ProviderThreadId,
  ProviderSessionId,
  ProviderDriverKind,
  ProviderTurnId,
  RunAttemptId,
  RunId,
  ThreadId,
  type OrchestrationV2ExecutionNode,
  type OrchestrationV2RunStatus,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { usageLimitBlockedRun } from "@t3tools/shared/orchestrationV2ThreadError";
import { describe, expect, it } from "vite-plus/test";

import { v2Projection } from "./orchestrationV2TestFixtures.ts";
import {
  formatModelSelectionEffort,
  presentPendingBackgroundWork,
  presentProviderGoal,
  deriveReportedModelSelection,
  deriveLatestThreadRun,
  deriveProviderSubagentStatus,
  deriveRunlessWorkStartedAt,
  deriveThreadActivityRun,
  deriveThreadRuntime,
  threadRuntimeHasInterruptibleRun,
} from "./threadExecution.ts";

const now = DateTime.makeUnsafe("2026-07-28T10:00:00.000Z");

function run(id: string, ordinal: number, status: OrchestrationV2RunStatus) {
  return {
    id: RunId.make(id),
    threadId: v2Projection.thread.id,
    ordinal,
    providerInstanceId: v2Projection.thread.providerInstanceId,
    modelSelection: v2Projection.thread.modelSelection,
    providerThreadId: null,
    userMessageId: MessageId.make(`message-${id}`),
    rootNodeId: null,
    activeAttemptId: null,
    status,
    requestedAt: now,
    startedAt: status === "queued" ? null : now,
    completedAt: null,
    checkpointId: null,
    contextHandoffId: null,
  };
}

describe("thread execution presentation", () => {
  it("derives the current root failure without inheriting errors from children or previous runs", () => {
    const failed = { ...run("limited", 1, "failed"), rootNodeId: NodeId.make("root") };
    const item = {
      id: TurnItemId.make("limit-error"),
      threadId: v2Projection.thread.id,
      runId: failed.id,
      nodeId: failed.rootNodeId,
      providerThreadId: null,
      providerTurnId: null,
      nativeItemRef: null,
      parentItemId: null,
      ordinal: 1,
      type: "error" as const,
      status: "failed" as const,
      title: "Usage limit reached",
      startedAt: now,
      completedAt: now,
      updatedAt: now,
      failure: {
        class: "usage_limit" as const,
        message: "Plan limit reached",
        code: "usageLimitExceeded",
        retryable: null,
      },
    };
    const projection = { ...v2Projection, runs: [failed], turnItems: [item] };
    expect(deriveThreadRuntime(projection)).toMatchObject({
      lastError: "Plan limit reached",
      lastErrorClass: "usage_limit",
    });
    expect(
      deriveThreadRuntime({
        ...projection,
        turnItems: [{ ...item, nodeId: NodeId.make("child") }],
      }),
    ).toMatchObject({ lastError: null, lastErrorClass: null });
    expect(
      deriveThreadRuntime({
        ...projection,
        runs: [{ ...failed, rootNodeId: NodeId.make("new-root") }],
      }),
    ).toMatchObject({ lastError: null, lastErrorClass: null });
    expect(
      deriveThreadRuntime({ ...projection, runs: [failed, run("new", 2, "running")] }),
    ).toMatchObject({ status: "running", lastError: null, lastErrorClass: null });
  });

  // regression: #15029 working timers no longer reset on every background wake
  it("counts a wake run's activity from the start of the work it continues", () => {
    const workStartedAt = DateTime.makeUnsafe("2026-07-28T09:20:00.000Z");
    const wake = { ...run("wake", 2, "running"), workStartedAt };
    expect(
      deriveThreadRuntime({ ...v2Projection, runs: [run("prompt", 1, "completed"), wake] })
        ?.activityStartedAt,
    ).toBe("2026-07-28T09:20:00.000Z");
    expect(
      deriveThreadRuntime({ ...v2Projection, runs: [run("prompt", 1, "running")] })
        ?.activityStartedAt,
    ).toBe("2026-07-28T10:00:00.000Z");
  });

  it("keeps a subscription limit visible while later messages stay queued", () => {
    const failed = {
      ...run("limited", 1, "failed"),
      rootNodeId: NodeId.make("root"),
      completedAt: now,
    };
    const queued = run("queued", 2, "queued");
    const item = {
      id: TurnItemId.make("limit-error"),
      threadId: v2Projection.thread.id,
      runId: failed.id,
      nodeId: failed.rootNodeId,
      providerThreadId: null,
      providerTurnId: null,
      nativeItemRef: null,
      parentItemId: null,
      ordinal: 1,
      type: "error" as const,
      status: "failed" as const,
      title: "Usage limit reached",
      startedAt: now,
      completedAt: now,
      updatedAt: now,
      failure: {
        class: "usage_limit" as const,
        message: "Plan limit reached",
        code: "usageLimitExceeded",
        retryable: null,
      },
    };
    const projection = { ...v2Projection, runs: [failed, queued], turnItems: [item] };

    expect(deriveLatestThreadRun(projection)?.runId).toBe(failed.id);
    expect(deriveThreadActivityRun(projection)?.runId).toBe(failed.id);
    expect(deriveThreadRuntime(projection)).toMatchObject({
      status: "failed",
      lastError: "Plan limit reached",
      lastErrorClass: "usage_limit",
    });
    const cancelledQueued = {
      ...run("cancelled-queued", 3, "cancelled"),
      startedAt: null,
      completedAt: now,
    };
    expect(
      usageLimitBlockedRun([failed, queued, cancelledQueued], projection.turnItems, null)?.id,
    ).toBe(failed.id);
    expect(
      deriveThreadRuntime({ ...projection, runs: [failed, queued, cancelledQueued] }),
    ).toMatchObject({ status: "failed", lastErrorClass: "usage_limit" });
    expect(
      deriveThreadRuntime({
        ...projection,
        turnItems: [{ ...item, failure: { ...item.failure, class: "provider_error" as const } }],
      }),
    ).toMatchObject({ status: "queued", lastErrorClass: null });
  });

  it("keeps live activity attached to an executing run when a newer run is queued", () => {
    const runningRun = run("run-running", 1, "running");
    const queuedRun = run("run-queued", 2, "queued");
    const projection = { ...v2Projection, runs: [queuedRun, runningRun], updatedAt: now };

    expect(deriveLatestThreadRun(projection)?.runId).toBe(queuedRun.id);
    expect(deriveThreadActivityRun(projection)).toMatchObject({
      runId: runningRun.id,
      status: "running",
    });

    const runtime = deriveThreadRuntime(projection);
    expect(runtime).toMatchObject({
      status: "running",
      activeRunId: runningRun.id,
    });
    expect(threadRuntimeHasInterruptibleRun(runtime)).toBe(true);
  });

  it("marks an open run whose provider turn already ended", () => {
    const attemptId = RunAttemptId.make("attempt-open");
    const openRun = { ...run("run-open", 1, "running"), activeAttemptId: attemptId };
    const providerTurn = (status: "running" | "failed") => ({
      id: ProviderTurnId.make("provider-turn-open"),
      providerThreadId: ProviderThreadId.make("provider-thread-open"),
      nodeId: NodeId.make("node-open"),
      runAttemptId: attemptId,
      nativeTurnRef: null,
      ordinal: 1,
      status,
      startedAt: now,
      completedAt: status === "running" ? null : now,
    });
    const projection = (status: "running" | "failed") => ({
      ...v2Projection,
      runs: [openRun],
      providerTurns: [providerTurn(status)],
      updatedAt: now,
    });

    expect(deriveThreadActivityRun(projection("running"))?.turnEnded).toBeUndefined();
    expect(deriveThreadActivityRun(projection("failed"))).toMatchObject({
      status: "running",
      turnEnded: true,
    });
  });

  it("presents a held queue as the stopped run instead of queued work", () => {
    const interrupted = { ...run("run-interrupted", 1, "interrupted"), completedAt: now };
    const held = { ...run("run-held", 2, "queued"), queueHeld: true };
    const projection = { ...v2Projection, runs: [interrupted, held], updatedAt: now };

    expect(deriveLatestThreadRun(projection)?.runId).toBe(interrupted.id);
    expect(deriveThreadActivityRun(projection)?.runId).toBe(interrupted.id);
    expect(deriveThreadRuntime(projection)).toMatchObject({
      status: "interrupted",
      activeRunId: null,
    });

    const resumed = { ...projection, runs: [interrupted, { ...held, queueHeld: false }] };
    expect(deriveThreadRuntime(resumed)).toMatchObject({ status: "queued" });

    const onlyHeld = {
      ...projection,
      runs: [held],
      thread: { ...projection.thread, activeProviderThreadId: null },
    };
    expect(deriveLatestThreadRun(onlyHeld)).toBeNull();
    expect(deriveThreadRuntime(onlyHeld)).toBeNull();
  });

  it("does not expose a queued-only run as interruptible", () => {
    const queuedRun = run("run-queued", 1, "queued");
    const projection = { ...v2Projection, runs: [queuedRun], updatedAt: now };

    expect(deriveThreadActivityRun(projection)).toMatchObject({
      runId: queuedRun.id,
      status: "queued",
    });

    const runtime = deriveThreadRuntime(projection);
    expect(runtime).toMatchObject({
      status: "queued",
      activeRunId: null,
    });
    expect(threadRuntimeHasInterruptibleRun(runtime)).toBe(false);
  });
});

describe("deriveRunlessWorkStartedAt", () => {
  const later = DateTime.makeUnsafe("2026-07-28T10:05:00.000Z");
  const rootTurn = (
    status: OrchestrationV2ExecutionNode["status"],
    startedAt = now,
  ): OrchestrationV2ExecutionNode => ({
    id: NodeId.make("child-root"),
    threadId: v2Projection.thread.id,
    runId: null,
    parentNodeId: null,
    rootNodeId: NodeId.make("child-root"),
    kind: "root_turn",
    status,
    countsForRun: false,
    providerThreadId: null,
    providerTurnId: null,
    nativeItemRef: null,
    runtimeRequestId: null,
    checkpointScopeId: null,
    startedAt,
    completedAt: null,
  });

  const nativeChild = {
    ...v2Projection,
    thread: {
      ...v2Projection.thread,
      creationSource: "provider" as const,
      lineage: {
        parentThreadId: ThreadId.make("parent"),
        relationshipToParent: "subagent" as const,
        rootThreadId: ThreadId.make("parent"),
      },
    },
  };

  it("times a provider-native subagent from its runless root turn while it works", () => {
    const projection = { ...nativeChild, nodes: [rootTurn("running", later)] };
    expect(deriveRunlessWorkStartedAt(projection)).toBe("2026-07-28T10:05:00.000Z");
    expect(deriveThreadRuntime(projection)).toBeNull();
  });

  it("ignores root turns that belong to a run, and threads the provider does not run", () => {
    const owned = { ...rootTurn("running"), runId: RunId.make("run-1") };
    expect(deriveRunlessWorkStartedAt({ ...nativeChild, nodes: [owned] })).toBeNull();
    expect(
      deriveRunlessWorkStartedAt({ ...v2Projection, nodes: [rootTurn("running")] }),
    ).toBeNull();
  });
});

describe("deriveProviderSubagentStatus", () => {
  const root = {
    id: NodeId.make("child-root"),
    threadId: v2Projection.thread.id,
    runId: null,
    parentNodeId: null,
    rootNodeId: NodeId.make("child-root"),
    kind: "root_turn" as const,
    status: "completed" as const,
    countsForRun: false,
    providerThreadId: null,
    providerTurnId: null,
    nativeItemRef: null,
    runtimeRequestId: null,
    checkpointScopeId: null,
    startedAt: now,
    completedAt: now,
  };
  const child = (creationSource: "provider" | "mcp") => ({
    ...v2Projection,
    thread: {
      ...v2Projection.thread,
      creationSource,
      lineage: {
        parentThreadId: ThreadId.make("parent"),
        relationshipToParent: "subagent" as const,
        rootThreadId: ThreadId.make("parent"),
      },
    },
    nodes: [root],
  });

  it("leaves T3 delegated tasks and ordinary threads alone", () => {
    expect(deriveProviderSubagentStatus(child("mcp"))).toBeNull();
    expect(deriveProviderSubagentStatus({ ...v2Projection, nodes: [root] })).toBeNull();
  });
});

describe("formatModelSelectionEffort", () => {
  const instanceId = ProviderInstanceId.make("claudeAgent");
  const selection = (options?: ReadonlyArray<{ id: string; value: string }>) => ({
    instanceId,
    model: "claude-sonnet-5",
    ...(options === undefined ? {} : { options }),
  });
  const catalog = (descriptor: { currentValue?: string }) => [
    {
      slug: "claude-sonnet-5",
      name: "Claude Sonnet 5",
      isCustom: false,
      capabilities: {
        optionDescriptors: [
          {
            id: "effort",
            label: "Reasoning",
            type: "select" as const,
            options: [
              { id: "medium", label: "Medium" },
              { id: "high", label: "High", isDefault: true },
              { id: "xhigh", label: "Extra High" },
            ],
            ...descriptor,
          },
        ],
      },
    },
  ];

  it("does not guess effort from the model default", () => {
    expect(formatModelSelectionEffort(selection(), catalog({}))).toBeNull();
  });

  it("names a stored effort the way the catalog does", () => {
    expect(
      formatModelSelectionEffort(selection([{ id: "effort", value: "xhigh" }]), catalog({})),
    ).toBe("Extra High");
  });

  it("does not guess effort from descriptor current value", () => {
    expect(formatModelSelectionEffort(selection(), catalog({ currentValue: "medium" }))).toBeNull();
  });

  it("shows nothing for a model the catalog does not describe", () => {
    expect(formatModelSelectionEffort(selection([{ id: "effort", value: "high" }]))).toBeNull();
    expect(
      formatModelSelectionEffort(
        { ...selection(), model: "claude-haiku-4-5" },
        catalog({ currentValue: "medium" }),
      ),
    ).toBeNull();
  });
});

describe("presentPendingBackgroundWork", () => {
  it("translates running and waiting rosters while preserving task descriptions", () => {
    const commands = [
      { taskId: "dev", kind: "command" as const, description: "npm run dev" },
      { taskId: "test", kind: "command" as const, description: "npm test" },
    ];
    expect(presentPendingBackgroundWork(commands, "he")?.title).toBe("מריץ 2 פקודות");
    expect(presentPendingBackgroundWork(commands, "he")?.items.map((item) => item.label)).toEqual([
      "npm run dev",
      "npm test",
    ]);
    expect(presentPendingBackgroundWork([commands[0]!], "he")?.title).toBe("מריץ: npm run dev");
    expect(
      presentPendingBackgroundWork(
        [{ taskId: "named", kind: "command", description: "Settings" }],
        "he",
      )?.title,
    ).toBe("מריץ: Settings");
    expect(presentPendingBackgroundWork([{ taskId: "a", kind: "command" }], "he")?.title).toBe(
      "מריץ פקודה",
    );
    expect(
      presentPendingBackgroundWork([...commands, { taskId: "review", kind: "subagent" }], "he")
        ?.title,
    ).toBe("ממתין ל־1 סוכן משנה ו־2 פקודות");
    expect(
      presentPendingBackgroundWork([{ taskId: "monitor", kind: "monitor", awaited: true }], "he")
        ?.title,
    ).toBe("ממתין ל־ניטור");
  });

  it.each(["ar", "fa"] as const)("translates unnamed background work in %s", (locale) => {
    const presentation = presentPendingBackgroundWork(
      [
        { taskId: "command", kind: "command" },
        { taskId: "task", kind: "background_task" },
      ],
      locale,
    );
    expect(presentation?.title).not.toMatch(/[a-z]/i);
    expect(presentation?.items[0]?.label).not.toBe("command");
  });

  it.each(["Subagent:", "Subagent:   "])(
    "falls back to the subagent noun when %s has no display name",
    (description) => {
      const presentation = presentPendingBackgroundWork([
        { taskId: "unnamed", kind: "subagent", description },
      ]);

      expect(presentation?.title).toBe("Waiting on a subagent");
      expect(presentation?.items[0]?.label).toBe("subagent");
    },
  );

  it.each([
    "/root/luna_window_properties",
    "Subagent: /root/luna_window_properties",
    "/root/parent/luna_window_properties",
  ])("uses the subagent display name for %s", (description) => {
    const childThreadId = ThreadId.make("thread:luna");
    const presentation = presentPendingBackgroundWork([
      { taskId: "luna", kind: "subagent", description, childThreadId },
    ]);

    expect(presentation).toEqual({
      title: "Waiting on subagent Luna Window Properties",
      items: [{ taskId: "luna", kind: "subagent", label: "Luna Window Properties", childThreadId }],
      waiting: true,
    });
  });

  it("formats subagent names in a mixed roster and preserves command descriptions", () => {
    const presentation = presentPendingBackgroundWork([
      { taskId: "cmd", kind: "command", description: "/root/run_tests" },
      { taskId: "luna", kind: "subagent", description: "/root/luna_window_properties" },
      { taskId: "review", kind: "subagent", description: "Review src/math.ts" },
    ]);

    expect(presentation?.title).toBe("Waiting on 2 subagents and 1 command");
    expect(presentation?.items.map((item) => item.label)).toEqual([
      "Luna Window Properties",
      "Review src/math.ts",
      "/root/run_tests",
    ]);
  });

  it("names a single piece of work by kind", () => {
    expect(
      presentPendingBackgroundWork([
        { taskId: "a", kind: "subagent", description: "Review src/math.ts" },
      ])?.title,
    ).toBe("Waiting on subagent Review src/math.ts");
    expect(
      presentPendingBackgroundWork([{ taskId: "a", kind: "monitor", awaited: true }])?.title,
    ).toBe("Waiting on a monitor");
    expect(presentPendingBackgroundWork([])).toBeNull();
  });

  it("keeps unawaited commands and monitors running without holding completion", () => {
    expect(
      presentPendingBackgroundWork([
        { taskId: "dev", kind: "command", description: "Start the shared dev server" },
      ]),
    ).toMatchObject({ title: "Running: Start the shared dev server", waiting: false });
    expect(presentPendingBackgroundWork([{ taskId: "a", kind: "command" }])).toMatchObject({
      title: "Running a command",
      waiting: false,
    });
    expect(
      presentPendingBackgroundWork([
        { taskId: "a", kind: "command", description: "vp run dev" },
        { taskId: "b", kind: "command", description: "tailscale serve" },
      ]),
    ).toMatchObject({ title: "Running 2 commands", waiting: false });
    expect(
      presentPendingBackgroundWork([
        { taskId: "a", kind: "command", description: "vp run dev" },
        { taskId: "b", kind: "monitor", description: "Watch PR checks" },
      ]),
    ).toMatchObject({ title: "Running 1 command and 1 monitor", waiting: false });
    expect(
      presentPendingBackgroundWork([
        { taskId: "a", kind: "command", description: "vp run dev" },
        { taskId: "b", kind: "monitor", description: "Watch PR checks", awaited: true },
      ]),
    ).toMatchObject({ title: "Waiting on 1 command and 1 monitor", waiting: true });
  });

  it("groups work by kind, subagents first, and keeps each name", () => {
    const presentation = presentPendingBackgroundWork([
      { taskId: "cmd", kind: "command", description: "npm test" },
      {
        taskId: "b",
        kind: "subagent",
        description: "Write tests",
        childThreadId: ThreadId.make("thread:b"),
      },
      { taskId: "a", kind: "subagent", description: "Review src/math.ts" },
    ]);
    expect(presentation?.title).toBe("Waiting on 2 subagents and 1 command");
    expect(presentation?.items.map((item) => [item.kind, item.label, item.childThreadId])).toEqual([
      ["subagent", "Write tests", "thread:b"],
      ["subagent", "Review src/math.ts", undefined],
      ["command", "npm test", undefined],
    ]);
  });

  it("names generic work, including rosters from servers that predate kinds", () => {
    expect(
      presentPendingBackgroundWork([
        { taskId: "bash", kind: "command", description: "Background sleep" },
        { taskId: "watch", kind: "monitor" },
        { taskId: "other", kind: "background_task" },
      ])?.title,
    ).toBe("Waiting on 1 command, 1 monitor and 1 background task");
    expect(presentPendingBackgroundWork([{ taskId: "old", kind: "background_task" }])?.title).toBe(
      "Waiting on a background task",
    );
  });
});

describe("provider-reported model selection", () => {
  const selected = v2Projection.thread.modelSelection;
  const reported = { ...selected, options: [{ id: "reasoningEffort", value: "default" }] };
  const providerThread = {
    id: ProviderThreadId.make("active"),
    driver: ProviderDriverKind.make("codex"),
    providerInstanceId: selected.instanceId,
    providerSessionId: ProviderSessionId.make("session"),
    appThreadId: v2Projection.thread.id,
    ownerNodeId: null,
    nativeThreadRef: null,
    nativeConversationHeadRef: null,
    status: "idle" as const,
    firstRunOrdinal: null,
    lastRunOrdinal: null,
    handoffIds: [],
    forkedFrom: null,
    createdAt: now,
    updatedAt: now,
    nativeMetadata: { modelSelection: reported },
  };
  const projection = {
    ...v2Projection,
    thread: { ...v2Projection.thread, activeProviderThreadId: providerThread.id },
    providerThreads: [providerThread],
  };

  it("reads only the active provider thread's reported selection", () => {
    expect(deriveReportedModelSelection(projection)).toBe(reported);
    expect(
      deriveReportedModelSelection({
        ...projection,
        thread: { ...projection.thread, activeProviderThreadId: null },
      }),
    ).toBeNull();
    expect(
      deriveReportedModelSelection({
        ...projection,
        providerThreads: [
          { ...providerThread, providerInstanceId: ProviderInstanceId.make("other") },
        ],
      }),
    ).toBeNull();
  });

  it("shows the reported default in a subagent's effort label", () => {
    const models = [
      {
        slug: selected.model,
        name: selected.model,
        isCustom: false,
        capabilities: {
          optionDescriptors: [
            {
              id: "variant",
              label: "Reasoning",
              type: "select" as const,
              options: [{ id: "high", label: "High" }],
            },
          ],
        },
      },
    ];
    const variantReport = { ...selected, options: [{ id: "variant", value: "default" }] };
    expect(formatModelSelectionEffort(selected, models, variantReport)).toBe("Default");
    expect(formatModelSelectionEffort(selected, models)).toBe("Unknown");
  });
});

describe("presentProviderGoal", () => {
  it("translates goals and usage without translating the objective", () => {
    const presentation = presentProviderGoal(
      {
        objective: "Review README.md",
        status: "active",
        tokensUsed: 12_000,
        tokenBudget: 50_000,
        checks: 2,
      },
      true,
      "he",
    );
    expect(presentation).toMatchObject({
      title: "פועל להשגת המטרה",
      objective: "Review README.md",
      usage: "12k / 50k טוקנים · 2 בדיקות",
    });
    expect(
      presentProviderGoal({ objective: "Review README.md", status: "paused" }, false, "he").title,
    ).toBe("המטרה הושהתה");
  });
  it("summarizes Codex accounting and offers resume once the goal stops short", () => {
    expect(
      presentProviderGoal(
        {
          objective: "Ship the feature",
          status: "paused",
          tokensUsed: 12_400,
          tokenBudget: 50_000,
          timeUsedSeconds: 245,
        },
        false,
      ),
    ).toEqual({
      title: "Goal paused",
      objective: "Ship the feature",
      usage: "12k / 50k tokens · 4m 5s",
      canResume: true,
    });
  });

  it("counts Claude evaluator checks and never offers resume", () => {
    expect(
      presentProviderGoal({ objective: "All tests pass", status: "active", checks: 1 }, true),
    ).toEqual({
      title: "Pursuing goal",
      objective: "All tests pass",
      usage: "1 check",
      canResume: false,
    });
    expect(
      presentProviderGoal({ objective: "All tests pass", status: "complete", checks: 0 }, false)
        .usage,
    ).toBeNull();
    expect(
      presentProviderGoal({ objective: "All tests pass", status: "active" }, false).title,
    ).toBe("Goal set");
  });
});
