import * as messages from "~/i18n/messages";
import { createUiMessageResolver } from "@t3tools/client-runtime/i18n";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { confirmMock, readLocalApiMock, settingsMock, hydrateMock } = vi.hoisted(() => {
  const confirmMock = vi.fn<(message: string, options?: unknown) => Promise<boolean>>();
  const readLocalApiMock = vi.fn<
    () =>
      | {
          dialogs: { confirm: (message: string, options?: unknown) => Promise<boolean> };
        }
      | undefined
  >();
  return {
    confirmMock,
    readLocalApiMock,
    settingsMock: { confirmTerminalClose: true },
    hydrateMock: vi.fn<() => Promise<void>>(),
  };
});

vi.mock("~/hooks/useSettings", () => ({
  getClientSettings: () => settingsMock,
  ensureClientSettingsHydrated: () => hydrateMock(),
}));

vi.mock("~/localApi", () => ({
  readLocalApi: () => readLocalApiMock(),
}));

import { confirmTerminalClose, isTerminalCloseConfirmPending } from "./terminalCloseConfirm";

describe("terminal close confirmation", () => {
  it("translates the question without translating the terminal name", async () => {
    using _locale = vi.spyOn(messages, "m").mockImplementation(createUiMessageResolver("he"));
    confirmMock.mockResolvedValue(false);
    await confirmTerminalClose(["Settings עברית 123"]);
    expect(confirmMock.mock.calls[0]?.[0].split("\n")[0]).toBe(
      'לסגור את המסוף "Settings עברית 123"?',
    );
  });

  beforeEach(() => {
    settingsMock.confirmTerminalClose = true;
    hydrateMock.mockReset();
    hydrateMock.mockResolvedValue(undefined);
    confirmMock.mockReset();
    readLocalApiMock.mockReset();
    readLocalApiMock.mockReturnValue({ dialogs: { confirm: confirmMock } });
  });

  it("closes single and multiple terminals immediately when confirmation is disabled", async () => {
    settingsMock.confirmTerminalClose = false;

    await expect(confirmTerminalClose(["Terminal 1"])).resolves.toBe(true);
    await expect(confirmTerminalClose(["Terminal 1", "Terminal 2"])).resolves.toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(isTerminalCloseConfirmPending()).toBe(false);

    settingsMock.confirmTerminalClose = true;
    confirmMock.mockResolvedValue(false);
    await expect(confirmTerminalClose(["Terminal 1"])).resolves.toBe(false);
    expect(confirmMock).toHaveBeenCalledOnce();
  });

  it("waits for the saved opt-out before closing immediately after reload", async () => {
    let finishHydration: () => void = () => undefined;
    hydrateMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishHydration = () => {
            settingsMock.confirmTerminalClose = false;
            resolve();
          };
        }),
    );

    const close = confirmTerminalClose(["Terminal 1"]);
    expect(isTerminalCloseConfirmPending()).toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();

    finishHydration();
    await expect(close).resolves.toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(isTerminalCloseConfirmPending()).toBe(false);
  });

  it("asks for confirmation when saved settings cannot be loaded", async () => {
    settingsMock.confirmTerminalClose = false;
    hydrateMock.mockRejectedValue(new Error("storage unavailable"));
    confirmMock.mockResolvedValue(false);

    await expect(confirmTerminalClose(["Terminal 1"])).resolves.toBe(false);
    expect(confirmMock).toHaveBeenCalledOnce();
    expect(isTerminalCloseConfirmPending()).toBe(false);
  });

  it("clears pending state and resolves false when the dialog rejects", async () => {
    let reject: (reason?: unknown) => void = () => undefined;
    confirmMock.mockImplementation(
      () =>
        new Promise<boolean>((_resolve, rejectPromise) => {
          reject = rejectPromise;
        }),
    );

    const confirmation = confirmTerminalClose(["Terminal 1"]);
    expect(isTerminalCloseConfirmPending()).toBe(true);

    await hydrateMock.mock.results[0]!.value;
    reject(new Error("dialog failed"));
    await expect(confirmation).resolves.toBe(false);
    expect(isTerminalCloseConfirmPending()).toBe(false);
  });
});
