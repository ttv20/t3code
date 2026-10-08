import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { environmentUpdateTarget, findEnvironmentUpdate } from "./environmentUpdates.ts";

afterEach(() => vi.unstubAllGlobals());

describe("environment release checks", () => {
  const signal = new AbortController().signal;

  it("finds a fork nightly when the bundled client and server have the same version", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json([
          { tag_name: "v0.0.46-nightly.20261008.12", draft: true },
          { tag_name: "v0.0.46-preview.20261008.11" },
          { tag_name: "v0.0.46-nightly.20261008.11" },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    expect(await findEnvironmentUpdate("0.0.46-nightly.20261003.10", signal)).toBe(
      "0.0.46-nightly.20261008.11",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/ttv20/t3code/releases?per_page=100&page=1",
      { signal },
    );
  });

  it("does not offer the current version or a downgrade", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => Response.json([{ tag_name: "v1.1.0" }])),
    );
    expect(await findEnvironmentUpdate("1.1.0", signal)).toBeNull();
    expect(await findEnvironmentUpdate("1.2.0", signal)).toBeNull();
  });

  it("walks past other channels to find a stable update", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          Array.from({ length: 100 }, () => ({
            tag_name: "v2.0.0-nightly.20261008.1",
          })),
        ),
      )
      .mockResolvedValueOnce(Response.json([{ tag_name: "v1.1.0" }]));
    vi.stubGlobal("fetch", fetchMock);
    expect(await findEnvironmentUpdate("1.0.0", signal)).toBe("1.1.0");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("page=2");
  });

  it("reports failed and invalid responses rather than claiming up to date", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(findEnvironmentUpdate("1.0.0", signal)).rejects.toThrow("403");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
    await expect(findEnvironmentUpdate("1.0.0", signal)).rejects.toThrow("No stable release");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "invalid" })));
    await expect(findEnvironmentUpdate("1.0.0", signal)).rejects.toThrow();
  });

  it("propagates an aborted check", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url, options) => {
        options.signal.throwIfAborted();
      }),
    );
    await expect(findEnvironmentUpdate("1.0.0", controller.signal)).rejects.toThrow();
  });

  it("keeps the newer client or release target", () => {
    expect(environmentUpdateTarget(null, null)).toBeNull();
    expect(environmentUpdateTarget(null, "1.2.0")).toBe("1.2.0");
    expect(environmentUpdateTarget("1.2.0", null)).toBe("1.2.0");
    expect(environmentUpdateTarget("1.2.0", "1.1.0")).toBe("1.2.0");
    expect(environmentUpdateTarget("1.1.0", "1.2.0")).toBe("1.2.0");
  });
});
