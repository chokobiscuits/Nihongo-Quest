import { describe, expect, it } from "vitest";
import { downmixToMono, parseWav, wavToMp3 } from "./wav-to-mp3";

/// Builds a minimal 16-bit PCM WAV. `extraChunk` inserts a LIST chunk before
/// `data`; `dataSize` overrides the declared size to simulate a streamed file.
function buildWav(
  samples: number[],
  opts: { sampleRate?: number; channels?: number; extraChunk?: boolean; dataSize?: number; format?: number } = {},
): Buffer {
  const { sampleRate = 24000, channels = 1, extraChunk = false, dataSize, format = 1 } = opts;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));

  const fmt = Buffer.alloc(24);
  fmt.write("fmt ", 0, "ascii");
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(format, 8);
  fmt.writeUInt16LE(channels, 10);
  fmt.writeUInt32LE(sampleRate, 12);
  fmt.writeUInt32LE(sampleRate * channels * 2, 16);
  fmt.writeUInt16LE(channels * 2, 20);
  fmt.writeUInt16LE(16, 22);

  const parts = [fmt];
  if (extraChunk) {
    const list = Buffer.alloc(8 + 5 + 1); // odd-sized body plus its pad byte
    list.write("LIST", 0, "ascii");
    list.writeUInt32LE(5, 4);
    parts.push(list);
  }
  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0, "ascii");
  dataHeader.writeUInt32LE(dataSize ?? data.length, 4);
  parts.push(dataHeader, data);

  const body = Buffer.concat(parts);
  const riff = Buffer.alloc(12);
  riff.write("RIFF", 0, "ascii");
  riff.writeUInt32LE(4 + body.length, 4);
  riff.write("WAVE", 8, "ascii");
  return Buffer.concat([riff, body]);
}

function sine(count: number, sampleRate: number, freq = 440): number[] {
  return Array.from({ length: count }, (_, i) => Math.round(8000 * Math.sin((2 * Math.PI * freq * i) / sampleRate)));
}

describe("parseWav", () => {
  it("reads format, samples and duration", () => {
    const wav = parseWav(buildWav([1, -2, 3, -4], { sampleRate: 8000 }));
    expect(wav.sampleRate).toBe(8000);
    expect(wav.channels).toBe(1);
    expect(Array.from(wav.samples)).toEqual([1, -2, 3, -4]);
    expect(wav.durationMs).toBeCloseTo((4 / 8000) * 1000);
  });

  it("skips unrelated chunks, including an odd-sized one", () => {
    const wav = parseWav(buildWav([5, 6, 7], { extraChunk: true }));
    expect(Array.from(wav.samples)).toEqual([5, 6, 7]);
  });

  it("clamps a data size that overruns the buffer", () => {
    const wav = parseWav(buildWav([1, 2, 3, 4], { dataSize: 0xffffffff }));
    expect(Array.from(wav.samples)).toEqual([1, 2, 3, 4]);
  });

  it("counts duration per frame for stereo", () => {
    const wav = parseWav(buildWav([1, 2, 3, 4], { channels: 2, sampleRate: 1000 }));
    expect(wav.channels).toBe(2);
    expect(wav.durationMs).toBeCloseTo(2);
  });

  it("rejects non-WAV input", () => {
    expect(() => parseWav(Buffer.from("not a wav file at all"))).toThrow(/RIFF/);
  });

  it("rejects non-PCM audio", () => {
    expect(() => parseWav(buildWav([1, 2], { format: 3 }))).toThrow(/Unsupported/);
  });

  it("rejects a file with no data chunk", () => {
    const wav = buildWav([1, 2]);
    expect(() => parseWav(wav.subarray(0, 12 + 24))).toThrow(/data/);
  });
});

describe("downmixToMono", () => {
  it("averages channels and passes mono through", () => {
    expect(Array.from(downmixToMono(Int16Array.from([2, 4, 10, 20]), 2))).toEqual([3, 15]);
    const mono = Int16Array.from([1, 2]);
    expect(downmixToMono(mono, 1)).toBe(mono);
  });
});

describe("wavToMp3", () => {
  it("encodes a tone to a non-empty MP3 with a valid frame sync", async () => {
    const { mp3, durationMs } = await wavToMp3(buildWav(sine(24000, 24000), { sampleRate: 24000 }), 48);
    expect(durationMs).toBeCloseTo(1000);
    expect(mp3.length).toBeGreaterThan(1000);
    // 48 kbps for one second is ~6 kB; allow generous headroom either way.
    expect(mp3.length).toBeLessThan(12000);
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1] & 0xe0).toBe(0xe0);
  });
});
