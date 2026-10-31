import { describe, expect, it } from "vite-plus/test";
import { createUiTranslator } from "@t3tools/client-runtime/i18n";

import { buildThreadActionMenuItems, type ThreadActionMenuState } from "./threadActionMenu.logic";

const baseState: ThreadActionMenuState = {
  canOperate: true,
  branch: null,
  projectFilter: null,
  isPinned: false,
  isSettled: false,
  autoSettleEnabled: true,
  isSnoozed: false,
  canSnoozeNow: true,
  isRegeneratingTitle: false,
  isRunning: false,
  supports: {
    settlement: true,
    autoSettleOptOut: true,
    snooze: true,
    pinning: true,
    titleRegeneration: true,
  },
  snoozePresets: [
    { id: "hour", label: "In 1 hour", whenLabel: "3:00 PM", snoozedUntil: "2026-08-07T15:00:00Z" },
  ],
};

describe("buildThreadActionMenuItems", () => {
  it("localizes nested labels while preserving branch and project names", () => {
    const t = createUiTranslator("he");
    const items = buildThreadActionMenuItems(
      {
        ...baseState,
        branch: "feature/עברית-English-123",
        projectFilter: { label: "Settings", isActive: false },
      },
      t,
    );
    expect(items.find((item) => item.id === "new-thread-on-branch")?.label).toBe(
      "שיחה חדשה על feature/עברית-English-123",
    );
    expect(items.find((item) => item.id === "filter-by-project")?.label).toBe("סינון לפי Settings");
    expect(items.find((item) => item.id === "snooze")?.children?.[0]?.label).toBe(
      "בעוד שעה (3:00 PM)",
    );
    expect(items.find((item) => item.id === "copy")?.children?.[0]?.label).toBe(t("Path"));
    expect(items.map((item) => item.id)).toEqual(
      buildThreadActionMenuItems({
        ...baseState,
        branch: "feature/עברית-English-123",
        projectFilter: { label: "Settings", isActive: false },
      }).map((item) => item.id),
    );
  });

  it.each([false, true])(
    "disables both lifecycle directions without permission (reversed: %s)",
    (reversed) => {
      const items = buildThreadActionMenuItems({
        ...baseState,
        canOperate: false,
        isPinned: reversed,
        isSettled: reversed,
        isSnoozed: reversed,
      });
      const expected = reversed
        ? [
            "unpin",
            "unsettle",
            "unsnooze",
            "rename",
            "regenerate-title",
            "auto-settle",
            "archive",
            "delete",
          ]
        : [
            "pin",
            "settle",
            "snooze",
            "rename",
            "regenerate-title",
            "auto-settle",
            "archive",
            "delete",
          ];
      expect(items.filter((item) => item.disabled).map((item) => item.id)).toEqual(expected);
      expect(
        items.find((item) => item.id === "snooze")?.children?.every((child) => child.disabled) ??
          true,
      ).toBe(true);
    },
  );

  it("disables archive and turning into a project while the thread is running", () => {
    const items = buildThreadActionMenuItems({
      ...baseState,
      isRunning: true,
      canTurnIntoProject: true,
    });
    expect(items.find((item) => item.id === "archive")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "turn-into-project")?.disabled).toBe(true);
  });
});
