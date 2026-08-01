// Phase 1: fetch every upstream source into data/raw/ (gitignored). Skips
// re-downloading a file whose sha256 checksum is already recorded in
// data/raw/.checksums.json, so re-running this script after an interrupted
// or partial pipeline run doesn't re-pull 12MB+ of gzip for nothing.
//
// This script performs network + filesystem IO only. It does no parsing;
// all parsing lives in scripts/seed/lib and is exercised by transform.ts,
// so nothing here needs unit tests of its own beyond the checksum helper.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const RAW_DIR = path.resolve(__dirname, "../../data/raw");
const CHECKSUM_FILE = path.join(RAW_DIR, ".checksums.json");

interface Source {
  key: string;
  url: string;
  filename: string;
}

// Direct downloads. JmdictFurigana and KanjiVG ship as GitHub release
// assets whose exact filenames include a version/date, so those two are
// resolved dynamically via the GitHub Releases API below rather than a
// fixed URL.
const DIRECT_SOURCES: Source[] = [
  { key: "kanjidic2", url: "http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz", filename: "kanjidic2.xml.gz" },
  { key: "jmdict", url: "http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz", filename: "JMdict_e.gz" },
  { key: "kradfile", url: "http://ftp.edrdg.org/pub/Nihongo/kradzip.zip", filename: "kradzip.zip" },
  {
    key: "jlpt",
    url: "https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json",
    filename: "kanji-data.json",
  },
];

type ChecksumMap = Record<string, string>;

function loadChecksums(): ChecksumMap {
  if (!existsSync(CHECKSUM_FILE)) return {};
  return JSON.parse(readFileSync(CHECKSUM_FILE, "utf-8"));
}

function saveChecksums(checksums: ChecksumMap) {
  writeFileSync(CHECKSUM_FILE, JSON.stringify(checksums, null, 2));
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function downloadFile(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/// Resolves a GitHub release asset URL by matching a substring against the
/// latest release's asset names, since JmdictFurigana/KanjiVG asset
/// filenames embed a version or date that changes over time.
async function resolveLatestReleaseAsset(repo: string, namePattern: RegExp): Promise<{ url: string; name: string }> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { "User-Agent": "choko-japan-seed-script" },
  });
  if (!res.ok) {
    throw new Error(`GitHub releases lookup failed for ${repo}: ${res.status} ${res.statusText}`);
  }
  const release = (await res.json()) as { assets: { name: string; browser_download_url: string }[] };
  const asset = release.assets.find((a) => namePattern.test(a.name));
  if (!asset) {
    throw new Error(
      `No asset matching ${namePattern} found in latest release of ${repo}. Available: ${release.assets.map((a) => a.name).join(", ")}`,
    );
  }
  return { url: asset.browser_download_url, name: asset.name };
}

async function downloadOne(key: string, url: string, filename: string, checksums: ChecksumMap): Promise<void> {
  const dest = path.join(RAW_DIR, filename);
  const existingChecksum = checksums[key];

  if (existingChecksum && existsSync(dest)) {
    console.log(`[skip] ${key}: ${filename} already downloaded (sha256 ${existingChecksum.slice(0, 12)}...)`);
    return;
  }

  console.log(`[fetch] ${key}: ${url}`);
  const buffer = await downloadFile(url);
  const checksum = sha256(buffer);
  writeFileSync(dest, buffer);
  checksums[key] = checksum;
  console.log(`[done] ${key}: wrote ${filename} (${buffer.length} bytes, sha256 ${checksum.slice(0, 12)}...)`);
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });
  const checksums = loadChecksums();

  for (const source of DIRECT_SOURCES) {
    await downloadOne(source.key, source.url, source.filename, checksums);
    saveChecksums(checksums);
  }

  const furigana = await resolveLatestReleaseAsset("Doublevil/JmdictFurigana", /^JmdictFurigana\.json$/i);
  await downloadOne("jmdict_furigana", furigana.url, "JmdictFurigana.json", checksums);
  saveChecksums(checksums);

  // "-main" is KanjiVG's release variant with the primary per-kanji SVGs
  // (the others are "-all", which additionally includes variant glyph
  // forms, and "-stripped", which drops stroke-order numbering).
  const kanjivg = await resolveLatestReleaseAsset("KanjiVG/kanjivg", /^kanjivg-.*-main\.zip$/i);
  await downloadOne("kanjivg", kanjivg.url, kanjivg.name, checksums);
  saveChecksums(checksums);

  // Kanji Alive ships as a git repo, not a release asset. Its 247-radical
  // table with English meanings lives at language-data/japanese-radicals.csv
  // (there is no dedicated data/ JSON in this repo, despite the folder name).
  await downloadOne(
    "kanji_alive",
    "https://raw.githubusercontent.com/kanjialive/kanji-data-media/master/language-data/japanese-radicals.csv",
    "kanjialive-radicals.csv",
    checksums,
  );
  saveChecksums(checksums);

  console.log("\nAll sources downloaded to data/raw/. Run `npm run seed:transform` next.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
