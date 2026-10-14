import { AtomRegistry } from "effect/reactivity";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { afterAll, afterEach, describe, expect, it, vi } from "vite-plus/test";

import { forkReleasePublishedAtom } from "./forkRelease";

const version = "0.0.46-nightly.20261012.3021";

// FetchHttpClient reads globalThis.fetch once and keeps it, so every test shares this mock.
const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

async function settledCheck() {
  const atom = forkReleasePublishedAtom(version);
  const registry = AtomRegistry.make();
  const unmount = registry.mount(atom);
  try {
    await vi.waitFor(() => {
      const result = registry.get(atom);
      expect(AsyncResult.isInitial(result) || result.waiting).toBe(false);
    });
    return registry.get(atom);
  } finally {
    unmount();
    registry.dispose();
  }
}

const publishedRelease = {
  tag_name: `v${version}`,
  draft: false,
  assets: [{ name: "SHA256SUMS" }, { name: `t3-${version}-linux-x64.tar.gz` }],
};

describe("forkReleasePublishedAtom", () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("checks the fork's downloadable release without tracing headers", async () => {
    fetchMock.mockImplementation(async () => Response.json(publishedRelease));

    const result = await settledCheck();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = new Request(fetchMock.mock.calls[0]?.[0] ?? "", fetchMock.mock.calls[0]?.[1]);
    expect(request.url).toBe(`https://api.github.com/repos/ttv20/t3code/releases/tags/v${version}`);
    expect(request.headers.get("traceparent")).toBeNull();
    expect(request.headers.get("b3")).toBeNull();
    expect(AsyncResult.getOrElse(result, () => false)).toBe(true);
  });

  it("reports a missing GitHub release as unpublished", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 404 }));

    const result = await settledCheck();

    expect(AsyncResult.isSuccess(result)).toBe(true);
    expect(AsyncResult.getOrElse(result, () => true)).toBe(false);
  });

  it.each([
    { ...publishedRelease, draft: true },
    { ...publishedRelease, tag_name: "v1.0.0" },
    { ...publishedRelease, assets: [{ name: "SHA256SUMS" }] },
    { ...publishedRelease, assets: [{ name: `t3-${version}-linux-x64.tar.gz` }] },
  ])("does not offer draft, mismatched, or incomplete releases: %j", async (release) => {
    fetchMock.mockImplementation(async () => Response.json(release));
    expect(AsyncResult.getOrElse(await settledCheck(), () => true)).toBe(false);
  });

  it("keeps rate limits unknown instead of treating them as a missing release", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 403 }));
    expect(AsyncResult.isFailure(await settledCheck())).toBe(true);
  });

  it("leaves a failed first check unknown, which callers read as unpublished", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await settledCheck();

    expect(AsyncResult.isFailure(result)).toBe(true);
    expect(AsyncResult.getOrElse(result, () => false)).toBe(false);
  });
});
