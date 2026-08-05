import { SOUND_MANIFEST, type SoundId } from "./manifest";

/// Web Audio playback for the app's sound effects.
///
/// Buffers rather than a pool of <audio> elements: decoded buffers allow the
/// same sound to overlap itself (rapid-fire correct answers) and give free
/// pitch-shifting via playbackRate, neither of which an <audio> pool does
/// cleanly.
///
/// Every entry point is safe to call during SSR and safe to call before any
/// asset has loaded. Nothing here throws into a render path.
class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<SoundId, AudioBuffer>();
  private loading = new Map<SoundId, Promise<AudioBuffer | null>>();
  /// Ids whose asset is missing or undecodable. Marked once, never retried.
  private dead = new Set<SoundId>();
  private lastPlayedAt = new Map<SoundId, number>();
  private enabled = false;
  private volume = 0.6;

  configure({ enabled, volume }: { enabled: boolean; volume: number }): void {
    this.enabled = enabled;
    this.volume = Math.min(Math.max(volume, 0), 1);
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime);
    }
  }

  /// Called from a real user gesture to get the AudioContext out of the
  /// "suspended" state browsers start it in. Optional — play() resumes too —
  /// but doing it on first pointerdown means the first real sound is not
  /// racing the resume.
  warm(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  /// Fire-and-forget: returns immediately and never throws. If the asset is
  /// not cached yet it is fetched, decoded, and then played — a few ms late
  /// rather than skipped, because most of these sounds fire exactly once and
  /// "audible next time" would mean never.
  play(id: SoundId, opts?: { rate?: number }): void {
    if (!this.enabled) return;
    const spec = SOUND_MANIFEST[id];
    if (!spec || this.dead.has(id)) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (spec.throttleMs !== undefined) {
      const last = this.lastPlayedAt.get(id) ?? -Infinity;
      if (ctx.currentTime * 1000 - last < spec.throttleMs) return;
      this.lastPlayedAt.set(id, ctx.currentTime * 1000);
    }

    if (ctx.state === "suspended") void ctx.resume();

    const buffer = this.buffers.get(id);
    if (!buffer) {
      // Not cached yet: fetch, decode, then play. Dropping the request and
      // waiting for "next time" would make one-shot sounds — every stinger,
      // session.complete — silent forever, since they fire exactly once.
      // The extra latency is a few ms for a file this size.
      void this.load(id).then((loaded) => {
        if (loaded && this.enabled) this.start(ctx, loaded, spec.gain, opts?.rate);
      });
      return;
    }

    this.start(ctx, buffer, spec.gain, opts?.rate);
  }

  private start(ctx: AudioContext, buffer: AudioBuffer, gainValue: number, rate?: number): void {
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      if (rate !== undefined) source.playbackRate.value = rate;

      const gain = ctx.createGain();
      gain.gain.value = gainValue;

      source.connect(gain);
      gain.connect(this.master ?? ctx.destination);
      source.start();
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
    } catch (error) {
      console.warn("[sound] could not start playback:", error);
    }
  }

  /// Fetch + decode ahead of time, so the first play of these is audible.
  /// Safe to call repeatedly; in-flight requests are de-duped.
  preload(ids: SoundId[]): void {
    if (!this.enabled) return;
    for (const id of ids) void this.load(id);
  }

  private load(id: SoundId): Promise<AudioBuffer | null> {
    const existing = this.loading.get(id);
    if (existing) return existing;

    const ctx = this.ensureContext();
    if (!ctx) return Promise.resolve(null);

    const spec = SOUND_MANIFEST[id];
    const promise = (async () => {
      try {
        const response = await fetch(spec.src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        const decoded = await ctx.decodeAudioData(bytes);
        this.buffers.set(id, decoded);
        return decoded;
      } catch (error) {
        // A missing or corrupt file makes this id permanently silent rather
        // than retrying on every keystroke.
        this.dead.add(id);
        console.warn(`[sound] could not load ${id} (${spec.src}):`, error);
        return null;
      } finally {
        this.loading.delete(id);
      }
    })();

    this.loading.set(id, promise);
    return promise;
  }

  /// Lazily builds the AudioContext. Returns null on the server, and on any
  /// browser without Web Audio. Never constructed at module scope: doing so
  /// would break the server bundle and would also create a context before
  /// any user gesture, which browsers immediately suspend.
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch (error) {
      console.warn("[sound] Web Audio unavailable:", error);
      return null;
    }
  }
}

/// Module singleton. Constructing it touches no browser API, so importing
/// this from a server-rendered module is safe.
export const soundManager = new SoundManager();
