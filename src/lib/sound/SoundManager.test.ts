import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/// These exercise the real SoundManager against a fake AudioContext.
///
/// The bug this file exists for: play() used to return early when a sound
/// was not cached yet, merely kicking off a fetch. That made every one-shot
/// sound (session end, every celebration stinger, the settings Test button)
/// silent forever, because they fire exactly once and there is no "next
/// time" to be audible on.

class FakeAudioBuffer {}

function makeCtx() {
  const started: { rate?: number; gain: number }[] = [];
  const ctx = {
    state: "running" as string,
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
    createGain: () => ({ gain: { value: 1, setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }),
    createBufferSource: () => {
      const node = {
        buffer: null as unknown,
        playbackRate: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
        onended: null as null | (() => void),
        start: vi.fn(() => {
          started.push({ rate: node.playbackRate.value, gain: 1 });
        }),
      };
      return node;
    },
    decodeAudioData: vi.fn(async () => new FakeAudioBuffer() as unknown as AudioBuffer),
  };
  return { ctx, started };
}

let started: { rate?: number; gain: number }[];

beforeEach(() => {
  vi.resetModules();
  const made = makeCtx();
  started = made.started;
  vi.stubGlobal("window", { AudioContext: vi.fn(() => made.ctx) });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function freshManager() {
  const { soundManager } = await import("./SoundManager");
  soundManager.configure({ enabled: true, volume: 0.6 });
  return soundManager;
}

describe("SoundManager.play", () => {
  it("plays a sound that has never been loaded before", async () => {
    const m = await freshManager();
    m.play("answer.correct");

    // The fetch+decode is async, so the sound lands a tick later — but it
    // must land, not be dropped.
    await vi.waitFor(() => expect(started.length).toBe(1));
  });

  it("plays one-shot sounds that only ever fire once", async () => {
    const m = await freshManager();
    for (const id of ["session.complete", "celebrate.levelup", "celebrate.newrank"] as const) {
      m.play(id);
    }
    await vi.waitFor(() => expect(started.length).toBe(3));
  });

  it("reuses the cached buffer on the second play", async () => {
    const m = await freshManager();
    m.play("answer.correct");
    await vi.waitFor(() => expect(started.length).toBe(1));

    m.play("answer.correct");
    await vi.waitFor(() => expect(started.length).toBe(2));
    // One network round-trip for two plays.
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("applies the combo playback rate", async () => {
    const m = await freshManager();
    m.play("answer.correct", { rate: 1.5 });
    await vi.waitFor(() => expect(started.length).toBe(1));
    expect(started[0].rate).toBeCloseTo(1.5, 5);
  });

  it("stays silent when disabled", async () => {
    const m = await freshManager();
    m.configure({ enabled: false, volume: 0.6 });
    m.play("answer.correct");
    await new Promise((r) => setTimeout(r, 20));
    expect(started.length).toBe(0);
  });

  it("does not play a sound whose asset is missing, and does not retry it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = await freshManager();

    m.play("answer.correct");
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(started.length).toBe(0);

    // Marked dead: a second play must not fetch again.
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    m.play("answer.correct");
    await new Promise((r) => setTimeout(r, 20));
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
    warn.mockRestore();
  });
});

describe("SoundManager SSR safety", () => {
  it("is a no-op with no window, and never throws", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("window", undefined);
    const { soundManager } = await import("./SoundManager");
    soundManager.configure({ enabled: true, volume: 0.6 });
    expect(() => soundManager.play("answer.correct")).not.toThrow();
  });
});
