import { expect, it, vi } from "vite-plus/test";
import { scheduleAndroidNotificationGrace } from "./androidNotifications";

const { waitForCompletionGrace } = vi.hoisted(() => ({
  waitForCompletionGrace: vi.fn<(delayMs: number) => Promise<void>>(),
}));

vi.mock("expo", () => ({
  requireOptionalNativeModule: () => ({ waitForCompletionGrace }),
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: { scheme: "t3code" } } }));
vi.mock("react-native", () => ({ Platform: { OS: "android" }, Linking: {} }));

it.each([false, true])(
  "resolves native background grace with cancellation=%s",
  async (cancelled) => {
    waitForCompletionGrace.mockReset();
    let finish!: () => void;
    const nativeWait = new Promise<void>((resolve) => {
      finish = resolve;
    });
    waitForCompletionGrace.mockReturnValue(nativeWait);
    const delivered: string[] = [];
    const cancel = scheduleAndroidNotificationGrace(() => delivered.push("completed"), 2_000);
    expect(waitForCompletionGrace).toHaveBeenCalledExactlyOnceWith(2_000);
    expect(delivered).toEqual([]);
    if (cancelled) cancel();
    finish();
    await nativeWait;
    expect(delivered).toEqual(cancelled ? [] : ["completed"]);
    cancel();
  },
);
