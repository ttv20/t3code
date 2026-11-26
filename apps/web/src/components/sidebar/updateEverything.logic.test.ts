import { createUiMessageResolver } from "@t3tools/client-runtime/i18n";
import * as messages from "~/i18n/messages";
import { EnvironmentId, type ServerSelfUpdateCapability } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  closeFinishedUpdateRun,
  collectChannelSwitchTargets,
  collectRestartingMachines,
  collectServerUpdateTargets,
  collectUpdateEverythingResult,
  describeUpdateCapsule,
  describeUpdateEverything,
  getUpdateEverythingToastView,
  localSwitchBlockReason,
  resolveUpdateRunMachineStatus,
  resolveRestoredRetry,
  runUpdateEverything,
  type UpdateEverythingMachine,
  type UpdateEverythingRun,
  type UpdateRunMachine,
  type UpdateRunMachineStatus,
} from "./updateEverything.logic";

const runMachine = (overrides: Partial<UpdateRunMachine> = {}): UpdateRunMachine => ({
  environmentId: EnvironmentId.make("alvin"),
  label: "alvin",
  updatesProviders: true,
  server: {
    environmentId: EnvironmentId.make("alvin"),
    serverLabel: "alvin",
    selfUpdate: "boot-service",
    targetVersion: "0.0.50",
  },
  handedOffVersion: null,
  startedAt: 0,
  result: null,
  failure: null,
  providerFailure: null,
  ...overrides,
});

function machine(
  id: string,
  serverVersion: string,
  selfUpdate: ServerSelfUpdateCapability | undefined,
  overrides: Partial<UpdateEverythingMachine> = {},
): UpdateEverythingMachine {
  return {
    environmentId: EnvironmentId.make(id),
    label: id,
    serverConfig: {
      environment: {
        environmentId: EnvironmentId.make(id),
        label: id,
        platform: { os: "linux", arch: "x64" },
        serverVersion,
        capabilities: {
          repositoryIdentity: true,
          ...(selfUpdate ? { serverSelfUpdate: selfUpdate } : {}),
          ...(selfUpdate === "desktop-managed"
            ? { desktopAppUpdate: true, desktopAppChannelSwitch: true }
            : {}),
        },
      },
      settings: { continueThreadsAfterServerUpdate: false },
    },
    connected: true,
    hostedByThisApp: false,
    canMaintain: true,
    updateState: { status: "idle" },
    ...overrides,
  };
}

// A desktop-mode server the desktop app cannot control, such as a WSL backend or an older app.
function withoutDesktopControl(base: UpdateEverythingMachine): UpdateEverythingMachine {
  return {
    ...base,
    serverConfig: {
      ...base.serverConfig!,
      environment: {
        ...base.serverConfig!.environment,
        capabilities: { repositoryIdentity: true, serverSelfUpdate: "desktop-managed" },
      },
    },
  };
}

describe("collectServerUpdateTargets", () => {
  it("updates remote servers that can move to the target and names every skipped one", () => {
    const { targets, skipped } = collectServerUpdateTargets(
      [
        machine("this-app", "0.0.40", "desktop-managed", { hostedByThisApp: true }),
        machine("service", "0.0.40", "boot-service"),
        machine("nightly-service", "0.0.49-nightly.20261001.3", "boot-service"),
        machine("other-desktop", "0.0.49-nightly.20261001.3", "desktop-managed"),
        machine("offline", "0.0.40", "boot-service", { connected: false }),
        machine("never-connected", "0.0.40", "boot-service", { serverConfig: null }),
        machine("no-scope", "0.0.40", "boot-service", { canMaintain: false }),
        machine("busy", "0.0.40", "boot-service", {
          updateState: {
            status: "running",
            stage: "downloading",
            fromVersion: "0.0.40",
            targetVersion: "0.0.50",
          },
        }),
        machine("current", "0.0.50", "boot-service"),
        machine("current-offline", "0.0.50", "boot-service", { connected: false }),
        machine("manual", "0.0.40", undefined),
        withoutDesktopControl(machine("wsl-backend", "0.0.40", "desktop-managed")),
      ],
      "0.0.50",
    );

    expect(targets.map((target) => [target.serverLabel, target.targetVersion])).toEqual([
      ["service", "0.0.50"],
      ["other-desktop", "0.0.50"],
    ]);
    expect(skipped.map((entry) => [entry.label, entry.reason])).toEqual([
      ["nightly-service", "on the nightly channel"],
      ["offline", "not connected"],
      ["never-connected", "still loading"],
      ["no-scope", "no permission"],
      ["busy", "already updating"],
      ["manual", "needs a manual update"],
      ["wsl-backend", "update T3 Code on that machine"],
    ]);
  });

  it("says why a disconnected server was skipped when its connection says", () => {
    const replaced =
      "This address now runs a different T3 Code install (b7a4, not 0359). Remove this connection and add it again.";
    const { skipped } = collectServerUpdateTargets(
      [
        machine("replaced", "0.0.40", "boot-service", {
          connected: false,
          serverConfig: null,
          connectionError: replaced,
        }),
        machine("silent", "0.0.40", "boot-service", { connected: false, connectionError: null }),
        machine("switched-off", "0.0.40", "boot-service", {
          connected: false,
          serverConfig: null,
          turnedOff: true,
        }),
      ],
      "0.0.50",
    );

    expect(skipped.map((entry) => [entry.label, entry.reason])).toEqual([
      ["replaced", replaced],
      ["silent", "not connected"],
      ["switched-off", "turned off"],
    ]);
  });

  it("does not offer a Nightly build to a Stable desktop app, whose own feed has nothing newer", () => {
    const { targets, skipped } = collectServerUpdateTargets(
      [machine("stable-desktop", "0.1.9", "desktop-managed")],
      "0.1.10-nightly.20261116.4761",
    );

    expect(targets.map((target) => target.serverLabel)).toEqual([]);
    expect(skipped.map((entry) => [entry.label, entry.reason])).toEqual([
      ["stable-desktop", "on the stable channel"],
    ]);
  });

  it("skips servers whose policy refuses the update, with the policy's message", () => {
    const managed = (
      id: string,
      updates: { mode: "off" } | { mode: "auto"; allowNightly: false },
      selfUpdate: "boot-service" | "desktop-managed" = "boot-service",
    ) => {
      const base = machine(id, "0.0.40", selfUpdate);
      return {
        ...base,
        serverConfig: {
          ...base.serverConfig!,
          managedPolicy: { organization: "Example Corp", lockedSettings: [], limits: { updates } },
        },
      };
    };
    const machines = [
      managed("off", { mode: "off" }),
      managed("no-nightly", { mode: "auto", allowNightly: false }),
      // A desktop app updates from its own feed, whatever track this app is on.
      managed("desktop-no-nightly", { mode: "auto", allowNightly: false }, "desktop-managed"),
    ];

    expect(
      collectServerUpdateTargets(machines, "0.0.50").skipped.map((entry) => [
        entry.label,
        entry.reason,
      ]),
    ).toEqual([["off", "Example Corp manages T3 Code updates."]]);
    expect(
      collectServerUpdateTargets(
        machines.map((entry) => ({
          ...entry,
          serverConfig: {
            ...entry.serverConfig,
            environment: {
              ...entry.serverConfig.environment,
              serverVersion: "0.0.49-nightly.20261027.1",
            },
          },
        })),
        "0.0.50-nightly.20261028.1",
      ).skipped.map((entry) => entry.label),
    ).toEqual(["off", "no-nightly"]);
  });
});

describe("collectChannelSwitchTargets", () => {
  const NIGHTLY = "0.1.4-nightly.20261027.3796";
  const OLD_NIGHTLY = "0.1.3-nightly.20261001.3500";
  const NEWER_NIGHTLY = "0.1.4-nightly.20261020.3700";
  // What each server reports as its database's highest migration.
  const host = (
    base: UpdateEverythingMachine,
    databaseMigration: number | undefined,
    os: "linux" | "darwin" = "linux",
  ): UpdateEverythingMachine => ({
    ...base,
    serverConfig: {
      ...base.serverConfig!,
      environment: {
        ...base.serverConfig!.environment,
        platform: { os, arch: "x64" },
        ...(databaseMigration === undefined ? {} : { databaseMigration }),
      },
    },
  });

  it("moves nightly hosts to stable only when stable knows their database", () => {
    const stable = { channel: "latest" as const, version: "0.1.3", databaseMigration: 69 };
    const { targets, skipped } = collectChannelSwitchTargets(
      [
        host(machine("this-app", NIGHTLY, "desktop-managed", { hostedByThisApp: true }), 72),
        host(machine("old-service", OLD_NIGHTLY, "boot-service"), 69),
        // Service launchers refuse older versions, even when the database allows it.
        host(machine("newer-service", NEWER_NIGHTLY, "boot-service"), 69),
        host(machine("linux-desktop", OLD_NIGHTLY, "desktop-managed"), 69),
        host(machine("new-service", NIGHTLY, "boot-service"), 72),
        host(machine("old-server", "0.1.2-nightly.20260901.3000", "boot-service"), undefined),
        host(machine("mac-desktop", OLD_NIGHTLY, "desktop-managed"), 69, "darwin"),
        host(machine("preview", "0.1.3-preview.20261026.3702", "boot-service"), 69),
        host(machine("stable", "0.1.3", "boot-service"), 69),
        host(machine("stable-desktop", "0.1.2", "desktop-managed"), 68),
        // Already current, but its saved track may still say Nightly.
        host(machine("current-desktop", "0.1.3", "desktop-managed"), 69, "darwin"),
      ],
      stable,
    );

    expect(
      targets.map((target) => [
        target.serverLabel,
        target.targetVersion,
        target.channel,
        target.trackOnly ?? false,
      ]),
    ).toEqual([
      ["old-service", "0.1.3", undefined, false],
      ["linux-desktop", "0.1.3", "latest", false],
      ["stable-desktop", "0.1.3", "latest", false],
      ["current-desktop", "0.1.3", "latest", true],
    ]);
    expect(targets.every((target) => target.targetDatabaseMigration === 69)).toBe(true);
    expect(skipped.map((entry) => [entry.label, entry.reason])).toEqual([
      ["newer-service", "run `t3 update --channel stable --allow-downgrade` there"],
      [
        "new-service",
        "its database has changes 0.1.3 does not support yet; stay on Nightly until Stable has them",
      ],
      ["old-server", "its server predates database checks; update it on Nightly first"],
      ["mac-desktop", "switch the Mac app on that Mac"],
      ["preview", "runs a preview build"],
    ]);
  });

  const managedHost = (base: UpdateEverythingMachine): UpdateEverythingMachine => ({
    ...base,
    serverConfig: {
      ...base.serverConfig!,
      managedPolicy: {
        organization: "Example Corp",
        lockedSettings: [],
        limits: { updates: { mode: "auto", allowNightly: false } },
      },
    },
  });

  it("moves stable hosts to nightly only when nightly knows their database", () => {
    const nightly = { channel: "nightly" as const, version: NIGHTLY, databaseMigration: 72 };
    const { targets, skipped } = collectChannelSwitchTargets(
      [
        host(machine("service", "0.1.2", "boot-service"), 70),
        // A Stable tag built a migration the latest Nightly does not have yet.
        host(machine("ahead", "0.1.3", "boot-service"), 73),
        withoutDesktopControl(machine("old-desktop", "0.1.2", "desktop-managed")),
        // Already on Nightly, so it needs an update rather than a channel switch.
        withoutDesktopControl(machine("behind-desktop", OLD_NIGHTLY, "desktop-managed")),
        machine("current", NIGHTLY, "boot-service"),
        // The server refuses a track its policy rules out, so the dialog skips it up front.
        managedHost(host(machine("no-nightly", "0.1.2", "boot-service"), 70)),
      ],
      nightly,
    );

    expect(targets.map((target) => [target.serverLabel, target.targetVersion])).toEqual([
      ["service", NIGHTLY],
    ]);
    expect(skipped.map((entry) => [entry.label, entry.reason])).toEqual([
      [
        "ahead",
        `its database has changes ${NIGHTLY} does not support yet; stay on Stable until Nightly has them`,
      ],
      ["old-desktop", "change the update track on that machine"],
      ["behind-desktop", "update T3 Code on that machine"],
      [
        "no-nightly",
        "Example Corp manages T3 Code updates. Only stable releases can be installed.",
      ],
    ]);
  });
});

describe("localSwitchBlockReason", () => {
  it("checks every server this app hosts, and only while connected", () => {
    const stable = { channel: "latest" as const, version: "0.1.3", databaseMigration: 69 };
    const nightly = "0.1.4-nightly.20261027.3796";

    const windows = { connected: true, databaseMigration: 69 };
    expect(localSwitchBlockReason(nightly, stable, [windows], 1, true)).toBeNull();
    // A WSL server's newer migration blocks the reinstall that would restart it.
    expect(
      localSwitchBlockReason(
        nightly,
        stable,
        [windows, { connected: true, databaseMigration: 72 }],
        2,
        true,
      ),
    ).toContain("does not support yet");
    // A WSL backend still starting has no client entry, so its database is unchecked.
    expect(localSwitchBlockReason(nightly, stable, [windows], 2, true)).toBe(
      "This app cannot switch: its server is not connected, so its database cannot be checked.",
    );
    // A cached head from a disconnected server proves nothing.
    expect(
      localSwitchBlockReason(
        nightly,
        stable,
        [{ connected: false, databaseMigration: 69 }],
        1,
        true,
      ),
    ).toBe(
      "This app cannot switch: its server is not connected, so its database cannot be checked.",
    );
    expect(localSwitchBlockReason("0.1.3", stable, [], 1, true)).toBeNull();
    // A primary backend still starting has no entry or bootstrap yet, unless Local environment is off.
    expect(localSwitchBlockReason(nightly, stable, [], 0, true)).toBe(
      "This app cannot switch: its server is not connected, so its database cannot be checked.",
    );
    expect(localSwitchBlockReason(nightly, stable, [], 0, false)).toBeNull();
  });
});

describe("collectRestartingMachines", () => {
  it("lists updated servers, and this app's servers only when it installs", () => {
    const withContinuation = (
      id: string,
      overrides: Partial<UpdateEverythingMachine> = {},
      enabled = false,
    ) => {
      const base = machine(id, "0.0.40", "boot-service", overrides);
      return {
        ...base,
        serverConfig: {
          environment: base.serverConfig!.environment,
          settings: { continueThreadsAfterServerUpdate: enabled },
        },
      };
    };
    const machines = [
      withContinuation("this-app", { hostedByThisApp: true }, true),
      withContinuation("alvin", {}, true),
      withContinuation("opted-out", {}, false),
      machine("old", "0.0.40", "boot-service"),
      withContinuation("providers-only"),
    ];
    const servers = ["alvin", "opted-out", "old"].map((id) => ({
      environmentId: EnvironmentId.make(id),
    }));

    expect(collectRestartingMachines(machines, servers, true)).toEqual([
      { environmentId: "this-app", continuesThreads: true },
      { environmentId: "alvin", continuesThreads: true },
      { environmentId: "opted-out", continuesThreads: false },
      { environmentId: "old", continuesThreads: false },
    ]);
    expect(
      collectRestartingMachines(machines, servers, false).map((entry) => entry.environmentId),
    ).toEqual(["alvin", "opted-out", "old"]);
  });
});

describe("runUpdateEverything", () => {
  it("restarts servers after providers finish and returns every result", async () => {
    const calls: string[] = [];
    let finishProviders = (_value: string) => {};
    let notifyProvidersStarted = () => {};
    const providersStarted = new Promise<void>((resolve) => {
      notifyProvidersStarted = resolve;
    });
    const run = runUpdateEverything({
      downloadLocal: async () => {
        calls.push("download");
        return true;
      },
      updateProviders: () =>
        new Promise<string>((resolve) => {
          calls.push("providers");
          finishProviders = resolve;
          notifyProvidersStarted();
        }),
      updateServers: async () => {
        calls.push("servers");
        return 2;
      },
    });

    await providersStarted;
    expect(calls).toEqual(["download", "providers"]);
    finishProviders("provider results");
    expect(await run).toEqual({ localReady: true, providers: "provider results", servers: 2 });
    expect(calls).toEqual(["download", "providers", "servers"]);
  });

  it("still updates remote machines when the local download fails", async () => {
    const calls: string[] = [];
    const result = await runUpdateEverything({
      downloadLocal: async () => false,
      updateProviders: async () => {
        calls.push("providers");
      },
      updateServers: async () => {
        calls.push("servers");
      },
    });

    expect(calls).toEqual(["providers", "servers"]);
    expect(result.localReady).toBe(false);
  });

  it("stages servers while providers install and updates each once its own stage settles", async () => {
    const calls: string[] = [];
    const [slow, fast] = [EnvironmentId.make("slow"), EnvironmentId.make("fast")];
    let finishProviders = () => {};
    let failSlowStage = () => {};
    const providers = new Promise<void>((resolve) => (finishProviders = resolve));
    const run = runUpdateEverything({
      updateProviders: () => {
        calls.push("providers");
        return providers.then(() => {
          calls.push("providers done");
        });
      },
      stageServers: () => {
        calls.push("stage");
        return new Map([
          [slow, new Promise((_, reject) => (failSlowStage = () => reject(new Error("failed"))))],
          [fast, Promise.resolve()],
        ]);
      },
      updateServers: (staged) => {
        calls.push("servers");
        return Promise.all(
          [slow, fast].map(async (id) => {
            await staged.get(id);
            calls.push(`server ${id}`);
            if (id === fast) failSlowStage();
          }),
        );
      },
    });
    finishProviders();
    await run;

    expect(calls).toEqual([
      "stage",
      "providers",
      "providers done",
      "servers",
      "server fast",
      "server slow",
    ]);
  });
});

describe("describeUpdateEverything", () => {
  it("gives each machine one row with its T3 Code and provider updates", () => {
    const id = EnvironmentId.make;
    const { rows } = describeUpdateEverything({
      localVersion: "1.1.0",
      localMachines: [
        { environmentId: id("local"), label: "Mainbook" },
        { environmentId: id("wsl"), label: "Mainbook WSL" },
      ],
      servers: [
        {
          environmentId: id("npm"),
          serverLabel: "bb-1",
          selfUpdate: "respawn",
          targetVersion: "1.1.0",
        },
      ],
      providerMachines: [
        { environmentId: id("npm"), label: "bb-1", providers: ["Codex", "Claude"] },
        { environmentId: id("local"), label: "Mainbook", providers: ["Codex"] },
        { environmentId: id("manual"), label: "alvin", providers: ["Claude"] },
      ],
      skipped: [
        { environmentId: id("manual"), label: "alvin", reason: "needs a manual update" },
        { environmentId: id("offline"), label: "TheoRoom", reason: "not connected" },
      ],
    });

    expect(
      rows.map(({ label, app, skipped, providers }) => [label, app, skipped, providers]),
    ).toEqual([
      ["Mainbook", "this-app", null, ["Codex"]],
      ["Mainbook WSL", "this-app", null, []],
      ["bb-1", "server", null, ["Codex", "Claude"]],
      ["alvin", null, "needs a manual update", ["Claude"]],
      ["TheoRoom", null, "not connected", []],
    ]);
  });
});

describe("resolveUpdateRunMachineStatus", () => {
  const running = (stage: "downloading" | "installing" | "resuming") =>
    ({ status: "running", stage, fromVersion: "0.0.40", targetVersion: "0.0.50" }) as const;

  it("follows the run phase, then the server's own update stage", () => {
    const idle = { status: "idle" } as const;
    expect(resolveUpdateRunMachineStatus(runMachine(), "providers", idle)).toBe("providers");
    expect(resolveUpdateRunMachineStatus(runMachine(), "servers", idle)).toBe("waiting");
    expect(resolveUpdateRunMachineStatus(runMachine(), "servers", running("installing"))).toBe(
      "downloading",
    );
    expect(resolveUpdateRunMachineStatus(runMachine(), "servers", running("resuming"))).toBe(
      "restarting",
    );
    expect(
      resolveUpdateRunMachineStatus(
        runMachine({ updatesProviders: false }),
        "providers",
        running("downloading"),
      ),
    ).toBe("downloading");
    expect(resolveUpdateRunMachineStatus(runMachine({ result: "failed" }), "servers", idle)).toBe(
      "failed",
    );
    expect(
      resolveUpdateRunMachineStatus(
        runMachine({ server: null, handedOffVersion: "0.0.50" }),
        "servers",
        idle,
      ),
    ).toBe("restarting");
  });
});

describe("update capsule", () => {
  const run = (overrides: Partial<UpdateEverythingRun> = {}): UpdateEverythingRun => ({
    localVersion: null,
    phase: "servers",
    restartAt: null,
    machines: [],
    ...overrides,
  });
  const view = (
    label: string,
    status: UpdateRunMachineStatus,
    overrides: Partial<UpdateRunMachine> = {},
  ) => ({
    machine: runMachine({ environmentId: EnvironmentId.make(label), label, ...overrides }),
    status,
    restoredRetry: null,
  });

  it("counts down this app's restart before anything else", () => {
    expect(
      describeUpdateCapsule(
        run({ phase: "countdown", restartAt: 5_000, localVersion: "0.0.50" }),
        [view("alvin", "restarting")],
        { status: "waiting" },
        1_200,
      ),
    ).toEqual({ tone: "default", label: "Restart in 4s", action: "later" });
  });

  it("names the slowest machine once it passes the slow threshold", () => {
    const machines = [
      view("bb-1", "done"),
      view("zbook", "downloading", { startedAt: 60_000 }),
      view("alvin", "restarting", { startedAt: 0 }),
    ];
    expect(describeUpdateCapsule(run(), machines, null, 60_000)).toEqual({
      tone: "default",
      label: "1 of 3 updated",
      action: null,
    });
    expect(describeUpdateCapsule(run(), machines, null, 9 * 60_000)).toEqual({
      tone: "slow",
      label: "alvin",
      slow: { status: "restarting", elapsed: "9m" },
      action: null,
    });
  });

  it("offers a retry only for failed servers it can update again", () => {
    expect(describeUpdateCapsule(run(), [view("alvin", "failed")], null, 0)).toEqual({
      tone: "failed",
      label: "alvin failed",
      action: "retry",
    });
    expect(
      describeUpdateCapsule(
        run(),
        [view("alvin", "failed", { server: null }), view("box", "failed", { server: null })],
        null,
        0,
      ),
    ).toEqual({ tone: "failed", label: "2 failed", action: "dismiss" });
    const localized = describeUpdateCapsule(
      run(),
      [view("Settings", "failed")],
      null,
      0,
      createUiMessageResolver("he"),
    );
    expect(localized.label).toBe("העדכון של Settings נכשל");
  });

  it("ends the run only when every machine is done and this app is not installing", () => {
    const done = runMachine({ result: "done" });
    expect(closeFinishedUpdateRun(run({ machines: [done] }))).toBeNull();
    expect(
      closeFinishedUpdateRun(run({ machines: [done], localVersion: "0.0.50" })),
    ).not.toBeNull();
    expect(
      closeFinishedUpdateRun(run({ machines: [runMachine({ result: "failed" })] })),
    ).not.toBeNull();
    expect(closeFinishedUpdateRun(run({ machines: [done], phase: "providers" }))).not.toBeNull();
  });
});

describe("update everything summary", () => {
  const result = collectUpdateEverythingResult({
    localVersion: "0.0.50",
    localFailures: ["Could not download update: Network error."],
    servers: [
      { label: "alvin", outcome: { status: "failed", message: "Download failed." } },
      { label: "box", outcome: { status: "updated" } },
      { label: "studio", outcome: { status: "updated" } },
      { label: "busy", outcome: { status: "skipped" } },
    ],
    providers: [
      { status: "updated" },
      { status: "interrupted" },
      { status: "failed", line: "box · Codex: npm exited with code 1." },
    ],
  });

  it("counts updates and names the machine of each failure", () => {
    expect(result).toEqual({
      localVersion: "0.0.50",
      updatedServers: 2,
      updatedProviders: 1,
      restarting: [],
      failures: [
        "This app: Could not download update: Network error.",
        "alvin: Download failed.",
        "box · Codex: npm exited with code 1.",
      ],
    });
  });

  it("includes this app only when the relaunch landed on its version", () => {
    expect(getUpdateEverythingToastView(result, "0.0.50")).toEqual({
      type: "error",
      title: "Updated this app, 2 servers, and 1 provider",
      description: [
        "This app: Could not download update: Network error.",
        "alvin: Download failed.",
        "box · Codex: npm exited with code 1.",
      ].join("\n"),
    });
    expect(getUpdateEverythingToastView({ ...result, failures: [] }, "0.0.40")).toEqual({
      type: "success",
      title: "Updated 2 servers and 1 provider",
    });
  });

  it("reports a failure when nothing updated, and nothing when nothing finished", () => {
    const empty = { localVersion: null, updatedServers: 0, updatedProviders: 0, restarting: [] };
    expect(
      getUpdateEverythingToastView({ ...empty, failures: ["alvin: offline"] }, "0.0.50"),
    ).toEqual({ type: "error", title: "Update failed", description: "alvin: offline" });
    expect(getUpdateEverythingToastView({ ...empty, failures: [] }, "0.0.50")).toBeNull();
  });

  it("localizes restart summaries while preserving server names", () => {
    using _locale = vi.spyOn(messages, "m").mockImplementation(createUiMessageResolver("he"));
    expect(
      getUpdateEverythingToastView({ ...result, failures: [], restarting: ["alvin"] }, "0.0.50")
        ?.description,
    ).toBe("alvin עדיין באתחול.");
  });

  it("names servers still restarting when this app relaunched", () => {
    expect(
      getUpdateEverythingToastView(
        { ...result, failures: [], restarting: ["alvin", "zbook"] },
        "0.0.50",
      ),
    ).toEqual({
      type: "success",
      title: "Updated this app, 2 servers, and 1 provider",
      description: "alvin and zbook are still restarting.",
    });
  });
});
describe("describeUpdateCapsule", () => {
  it("sends failed track switches back through the planner instead of retrying their target", () => {
    const failed = {
      machine: {
        environmentId: EnvironmentId.make("remote"),
        label: "remote",
        updatesProviders: false,
        server: {
          environmentId: EnvironmentId.make("remote"),
          serverLabel: "remote",
          selfUpdate: "boot-service" as const,
          targetVersion: "0.1.3",
        },
        handedOffVersion: null,
        startedAt: 0,
        result: "failed" as const,
        failure: "offline",
        providerFailure: null,
      },
      status: "failed" as const,
      restoredRetry: null,
    };
    const run = { localVersion: null, phase: "servers" as const, restartAt: null, machines: [] };

    expect(describeUpdateCapsule(run, [failed], null, 0).action).toBe("retry");
    expect(describeUpdateCapsule({ ...run, trackSwitch: true }, [failed], null, 0).action).toBe(
      "dismiss",
    );
  });
});

describe("resolveRestoredRetry", () => {
  // A row the relaunched app rebuilt from its saved handoff: no target, only the version.
  const restored = (id: string): UpdateRunMachine => ({
    environmentId: EnvironmentId.make(id),
    label: id,
    updatesProviders: false,
    server: null,
    handedOffVersion: "0.1.12",
    startedAt: 0,
    result: "failed",
    failure: "Not back after 32 minutes",
    providerFailure: null,
  });

  it("rebuilds the target from the server as it is now, so the capsule offers Retry", () => {
    const retry = resolveRestoredRetry(restored("remote"), [
      machine("other", "0.1.10", "boot-service"),
      machine("remote", "0.1.10", "boot-service"),
    ]);
    expect(retry).toEqual({
      environmentId: "remote",
      serverLabel: "remote",
      selfUpdate: "boot-service",
      installation: undefined,
      desktopAppUpdate: false,
      targetVersion: "0.1.12",
    });
    const run = { localVersion: null, phase: "servers" as const, restartAt: null, machines: [] };
    const view = { machine: restored("remote"), status: "failed" as const, restoredRetry: retry };
    expect(describeUpdateCapsule(run, [view], null, 0).action).toBe("retry");
    expect(describeUpdateCapsule(run, [{ ...view, restoredRetry: null }], null, 0).action).toBe(
      "dismiss",
    );
  });

  it("marks a server already on the target and offers nothing for one that is gone", () => {
    expect(
      resolveRestoredRetry(restored("remote"), [machine("remote", "0.1.12", "boot-service")]),
    ).toBe("current");
    expect(resolveRestoredRetry(restored("remote"), [])).toBeNull();
  });
});
