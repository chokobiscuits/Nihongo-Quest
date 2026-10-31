import { describe, expect, it } from "vitest";
import { speechAudioKey } from "../../src/components/speech/speechAudio";
import { dedupeJobs, jobsForSubject, type AudioJob, type SubjectRow } from "./jobs";

function row(partial: Partial<SubjectRow> & Pick<SubjectRow, "type">): SubjectRow {
  return { id: "id", slug: "slug", characters: null, readings: [], furigana: null, ...partial };
}

describe("jobsForSubject", () => {
  it("makes a kana job for a kana glyph", () => {
    const [job] = jobsForSubject(row({ type: "KANA", characters: "あ" }));
    expect(job).toMatchObject({ text: "あ", kind: "kana", source: null, key: speechAudioKey("あ") });
  });

  it("makes one kana job per cleaned kanji reading", () => {
    const jobs = jobsForSubject(
      row({
        type: "KANJI",
        characters: "食",
        readings: [
          { reading: "しょく", primary: true, type: "onyomi" },
          { reading: "た.べる", primary: false, type: "kunyomi" },
        ],
      }),
    );
    expect(jobs.map((j) => [j.text, j.kind, j.source])).toEqual([
      ["しょく", "kana", null],
      ["たべる", "kana", null],
    ]);
  });

  it("keeps the kanji form as the verification source for vocab", () => {
    const jobs = jobsForSubject(
      row({ type: "VOCAB", characters: "日", readings: [{ reading: "ひ", primary: true, type: "kana" }] }),
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ text: "ひ", kind: "word", source: "日" });
  });

  it("has no source when the vocab is already kana", () => {
    const [job] = jobsForSubject(
      row({ type: "VOCAB", characters: "ねこ", readings: [{ reading: "ねこ", primary: true, type: "kana" }] }),
    );
    expect(job.source).toBeNull();
  });

  it("speaks sentence furigana and keeps the characters as the source", () => {
    const [job] = jobsForSubject(
      row({
        type: "SENTENCE",
        characters: "私です",
        furigana: [{ ruby: "私", rt: "わたし" }, { ruby: "です" }],
      }),
    );
    expect(job).toMatchObject({ text: "わたしです", kind: "sentence", source: "私です" });
  });

  it("makes nothing for radicals and grammar", () => {
    expect(jobsForSubject(row({ type: "RADICAL", characters: "一" }))).toEqual([]);
    expect(jobsForSubject(row({ type: "GRAMMAR", characters: "～たい" }))).toEqual([]);
  });
});

describe("dedupeJobs", () => {
  const job = (text: string, kind: AudioJob["kind"], label = "x"): AudioJob => ({
    key: speechAudioKey(text),
    text,
    kind,
    source: null,
    label,
  });

  it("collapses repeated texts", () => {
    const { jobs } = dedupeJobs([job("ひ", "word"), job("ひ", "word"), job("あ", "kana")]);
    expect(jobs.map((j) => j.text).sort()).toEqual(["ひ", "あ"].sort());
  });

  it("prefers the kana clip when a text is wanted both ways", () => {
    const { jobs } = dedupeJobs([job("ひ", "word"), job("ひ", "kana")]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].kind).toBe("kana");
  });

  it("reports distinct texts that share a key", () => {
    const a = job("あ", "kana");
    const b = { ...job("い", "kana"), key: a.key };
    const { jobs, collisions } = dedupeJobs([a, b]);
    expect(jobs).toEqual([a]);
    expect(collisions).toEqual([[a, b]]);
  });
});
