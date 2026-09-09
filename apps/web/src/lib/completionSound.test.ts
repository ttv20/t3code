import { describe, expect, it } from "vite-plus/test";

import { advanceCompletionSoundSnapshot, type CompletionSoundThread } from "./completionSound";

const turn = (
  state: "running" | "interrupted" | "completed" | "error",
  turnId = "turn-1",
): CompletionSoundThread => ({
  key: "environment:thread",
  latestTurn: {
    turnId,
    state,
    completedAt: state === "running" ? null : "2026-09-09T12:00:00.000Z",
  },
});

describe("completion sound transitions", () => {
  it("stays silent while seeding existing completed threads", () => {
    expect(advanceCompletionSoundSnapshot(null, [turn("completed")]).completed).toBe(false);
  });

  it("plays when an observed turn completes", () => {
    const seeded = advanceCompletionSoundSnapshot(null, [turn("running")]);
    expect(advanceCompletionSoundSnapshot(seeded.snapshot, [turn("completed")]).completed).toBe(
      true,
    );
  });

  it.each(["interrupted", "error"] as const)("stays silent when a turn becomes %s", (state) => {
    const seeded = advanceCompletionSoundSnapshot(null, [turn("running")]);
    expect(advanceCompletionSoundSnapshot(seeded.snapshot, [turn(state)]).completed).toBe(false);
  });

  it("does not replay a completed turn or announce an unseen one", () => {
    const completed = advanceCompletionSoundSnapshot(null, [turn("completed")]);
    expect(advanceCompletionSoundSnapshot(completed.snapshot, [turn("completed")]).completed).toBe(
      false,
    );
    expect(
      advanceCompletionSoundSnapshot(completed.snapshot, [
        { ...turn("completed", "turn-2"), key: "environment:new-thread" },
      ]).completed,
    ).toBe(false);
  });
});
