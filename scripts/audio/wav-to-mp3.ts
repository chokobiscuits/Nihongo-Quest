// WAV parsing and MP3 encoding for the audio generator. VOICEVOX returns
// plain 16-bit PCM WAV; this reads just enough of the container to hand the
// samples to lamejs, so no ffmpeg is needed on the machine running it.
//
// lamejs is loaded with a dynamic import: tsx runs this script as CommonJS,
// and the package's `require` entry is an IIFE build that exports nothing,
// so a static import resolves to an empty object at runtime.
type Lamejs = typeof import("@breezystack/lamejs");
let lamejs: Promise<Lamejs> | null = null;
function loadLamejs(): Promise<Lamejs> {
  lamejs ??= import("@breezystack/lamejs");
  return lamejs;
}

export interface ParsedWav {
  sampleRate: number;
  channels: number;
  /// Interleaved 16-bit samples.
  samples: Int16Array;
  durationMs: number;
}

/// Parses a RIFF/WAVE buffer holding 16-bit PCM. Walks the chunk list rather
/// than assuming a 44-byte header, so extra chunks (LIST, etc.) are skipped.
/// A `data` size that overruns the buffer, or a streaming placeholder of
/// 0xFFFFFFFF, is clamped to what is actually there.
export function parseWav(buffer: Buffer): ParsedWav {
  if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a RIFF/WAVE file");
  }

  let format: { audioFormat: number; channels: number; sampleRate: number; bitsPerSample: number } | null = null;
  let dataStart = -1;
  let dataLength = 0;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      if (body + 16 > buffer.length) throw new Error("Truncated fmt chunk");
      format = {
        audioFormat: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bitsPerSample: buffer.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      dataStart = body;
      dataLength = Math.min(size, buffer.length - body);
      break;
    }
    // Chunks are word-aligned: an odd size is followed by one pad byte.
    offset = body + size + (size % 2);
  }

  if (!format) throw new Error("WAV has no fmt chunk");
  if (dataStart < 0) throw new Error("WAV has no data chunk");
  if (format.audioFormat !== 1 || format.bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV (format ${format.audioFormat}, ${format.bitsPerSample}-bit); need 16-bit PCM`);
  }
  if (format.channels < 1 || format.sampleRate < 1) throw new Error("WAV has an invalid fmt chunk");

  const frameBytes = 2 * format.channels;
  const usable = dataLength - (dataLength % frameBytes);
  const samples = new Int16Array(usable / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = buffer.readInt16LE(dataStart + i * 2);
  }

  const frames = usable / frameBytes;
  return {
    sampleRate: format.sampleRate,
    channels: format.channels,
    samples,
    durationMs: (frames / format.sampleRate) * 1000,
  };
}

/// Averages interleaved channels down to mono.
export function downmixToMono(samples: Int16Array, channels: number): Int16Array {
  if (channels === 1) return samples;
  const frames = Math.floor(samples.length / channels);
  const mono = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += samples[i * channels + c];
    mono[i] = Math.round(sum / channels);
  }
  return mono;
}

const ENCODE_BLOCK = 1152;

/// Encodes a WAV buffer to mono MP3 at `kbps`.
export async function wavToMp3(wav: Buffer, kbps = 48): Promise<{ mp3: Buffer; durationMs: number }> {
  const parsed = parseWav(wav);
  const mono = downmixToMono(parsed.samples, parsed.channels);
  const { Mp3Encoder } = await loadLamejs();
  const encoder = new Mp3Encoder(1, parsed.sampleRate, kbps);

  // lamejs hands back Int8Array views over a buffer it reuses, so each block
  // is copied out as bytes before the next call.
  const chunks: Buffer[] = [];
  const copy = (out: ArrayBufferView) => Buffer.from(new Uint8Array(out.buffer, out.byteOffset, out.byteLength));
  for (let i = 0; i < mono.length; i += ENCODE_BLOCK) {
    const out = encoder.encodeBuffer(mono.subarray(i, i + ENCODE_BLOCK));
    if (out.length > 0) chunks.push(copy(out));
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(copy(tail));

  return { mp3: Buffer.concat(chunks), durationMs: parsed.durationMs };
}
