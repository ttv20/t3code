import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { createUiTranslator } from "@t3tools/client-runtime/i18n";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "../../../test/render";
import "../../index.css";

const harness = vi.hoisted(() => ({ locale: "en" as "en" | "he", calls: [] as unknown[] }));
vi.mock("../../hooks/useSettings", () => ({ usePrimarySettings: () => "24-hour" }));
vi.mock("../../i18n", () => ({
  useUiLanguage: () => ({
    locale: harness.locale,
    direction: harness.locale === "he" ? "rtl" : "ltr",
    t: createUiTranslator(harness.locale),
  }),
}));
vi.mock("../../state/session", () => ({
  useEnvironmentScope: () => true,
  readEnvironmentScope: () => true,
}));
vi.mock("../../state/server", () => ({
  serverEnvironment: { consumeResetCredit: {}, refreshProviders: {} },
}));
vi.mock("../../state/use-atom-command", () => ({
  useAtomCommand: () => async (input: unknown) => {
    harness.calls.push(input);
    return { _tag: "Success", value: { outcome: "reset" } };
  },
}));

import { ComposerUsageIndicator } from "./ComposerWeeklyUsageIndicator";

it.each(["en", "he"] as const)("redeems only the confirmed footer choice in %s", async (locale) => {
  harness.locale = locale;
  harness.calls = [];
  const t = createUiTranslator(locale);
  const environmentId = EnvironmentId.make("desk");
  const instanceId = ProviderInstanceId.make("claude-work");
  const provider: ServerProvider = {
    instanceId,
    driver: ProviderDriverKind.make("claudeAgent"),
    displayName: "Claude Work",
    enabled: true,
    installed: true,
    version: "1",
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-11-11T10:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
    usageLimits: {
      checkedAt: "2026-11-11T10:00:00.000Z",
      windows: [
        {
          id: "five_hour",
          kind: "session",
          label: "Session",
          usedPercent: 40,
          windowDurationMins: 300,
        },
      ],
      resetCredits: {
        availableCount: 3,
        nextCreditId: "weekly",
        options: [
          {
            creditId: "weekly",
            label: "Weekly reset",
            description: "Refills your weekly limit.",
            availableCount: 1,
          },
          {
            creditId: "fable",
            label: "Fable reset",
            description:
              "Refills your Fable allowance and gives back what Fable used on your weekly limit. It doesn't reset your whole week.",
            availableCount: 2,
          },
        ],
      },
    },
  };
  await using screen = await render(
    <ComposerUsageIndicator environmentId={environmentId} provider={provider} />,
  );
  await screen.getByRole("button").first().click();
  await page
    .getByRole("button", { name: t("Use"), exact: true })
    .nth(1)
    .click();
  const dialog = page.getByRole("alertdialog");
  await expect.element(dialog.getByText(new RegExp(t("Fable reset")))).toBeVisible();
  await dialog.getByRole("button", { name: t("Cancel"), exact: true }).click();
  expect(harness.calls).toEqual([]);

  await screen.getByRole("button").first().click();
  await page
    .getByRole("button", { name: t("Use"), exact: true })
    .first()
    .click();
  await expect.element(dialog.getByText(new RegExp(t("Weekly reset")))).toBeVisible();
  await dialog.getByRole("button", { name: t("Use credit"), exact: true }).click();
  await vi.waitFor(() =>
    expect(harness.calls).toEqual([{ environmentId, input: { instanceId, creditId: "weekly" } }]),
  );
});
