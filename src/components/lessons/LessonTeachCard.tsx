import Link from "next/link";
import { SUBJECT_THEME } from "@/components/subject/theme";
import { FuriganaText } from "@/components/furigana/FuriganaText";
import { renderFurigana } from "@/services/furigana/render";
import { MnemonicEditor } from "@/components/mnemonic/MnemonicEditor";
import { SectionPanel } from "./SectionPanel";
import type { LessonComponentSummary, LessonSubject } from "@/server/queries/lessons";
import { typeToSlug } from "@/components/subject/typeSlug";
import { cn } from "@/lib/utils";

export interface LessonTeachCardProps {
  subject: LessonSubject;
  /// 1-indexed position within the current lesson batch.
  position?: number;
  batchSize?: number;
  className?: string;
}

function readingsByType(readings: LessonSubject["readings"], type: string) {
  return readings.filter((r) => r.type === type);
}

function subjectHref(type: LessonComponentSummary["type"], slug: string) {
  return `/subjects/${typeToSlug(type)}/${slug}`;
}

/// Kanji glyph chip: glyph + gloss, used for a KANJI's radicals, a VOCAB's
/// kanji, and a KANJI's example vocab.
function ComponentChip({ component }: { component: LessonComponentSummary }) {
  const childTheme = SUBJECT_THEME[component.type];
  return (
    <Link
      href={subjectHref(component.type, component.slug)}
      className="flex h-9 shrink-0 items-center gap-2 rounded-[var(--radius-chip)] border border-line bg-surface px-3 hover:border-line-strong hover:bg-surface-3 transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
    >
      <span lang="ja" className="subject-glyph text-h2" style={{ color: childTheme.text }}>
        {component.characters}
      </span>
      <span className="text-caption text-text-muted">{component.meaning ?? component.slug}</span>
      {component.readingUsed && (
        <span lang="ja" className="text-caption" style={{ color: "var(--color-vocab-text)" }}>
          {component.readingUsed}
        </span>
      )}
    </Link>
  );
}

/// One word in a sentence's breakdown: shows the word as it actually
/// appears in the sentence (its `surface` form, which may be inflected),
/// its gloss, and dims non-gating words (function words, or off-ladder
/// content words) so the words that actually unlocked the sentence stand
/// out without hiding the rest of the sentence's vocabulary.
function SentenceWordChip({ component }: { component: LessonComponentSummary }) {
  const childTheme = SUBJECT_THEME[component.type];
  return (
    <Link
      href={subjectHref(component.type, component.slug)}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-[var(--radius-chip)] border border-line bg-surface px-3 hover:border-line-strong hover:bg-surface-3 transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
        component.isGating === false && "opacity-50",
      )}
    >
      <span lang="ja" className="text-body" style={{ color: childTheme.text }}>
        {component.surface ?? component.characters}
      </span>
      <span className="text-caption text-text-muted">{component.meaning ?? component.slug}</span>
    </Link>
  );
}

/// Glyph-only square chip for a radical's "found in kanji" list — dozens of
/// these can appear per radical, so no gloss, small footprint.
function GlyphOnlyChip({ component }: { component: LessonComponentSummary }) {
  const childTheme = SUBJECT_THEME[component.type];
  return (
    <Link
      href={subjectHref(component.type, component.slug)}
      title={component.meaning ?? component.slug}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-tile)] border border-line bg-surface hover:border-line-strong hover:bg-surface-3 transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
    >
      <span lang="ja" className="subject-glyph text-h2" style={{ color: childTheme.text }}>
        {component.characters}
      </span>
    </Link>
  );
}

/// Scrollable chip tray capped at ~4 rows tall, with a bottom fade mask that
/// only shows while there's more to scroll to.
function ChipTray({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="flex max-h-[168px] flex-wrap gap-2 overflow-y-auto overscroll-contain pr-1">
        {children}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-6"
        style={{
          background: "linear-gradient(to top, var(--color-surface-2), transparent)",
        }}
      />
    </div>
  );
}

/// Teach screen for one lesson item: glyph header, meanings/readings,
/// component breakdown, and mnemonic slots.
export function LessonTeachCard({ subject, position, batchSize, className }: LessonTeachCardProps) {
  const theme = SUBJECT_THEME[subject.type];
  const onyomi = readingsByType(subject.readings, "onyomi");
  const kunyomi = readingsByType(subject.readings, "kunyomi");
  const kana = readingsByType(subject.readings, "kana");

  const furiganaRender =
    (subject.type === "VOCAB" || subject.type === "SENTENCE") && subject.furigana
      ? renderFurigana(subject.furigana, true)
      : null;

  const primaryMeaning = subject.meanings.find((m) => m.primary) ?? subject.meanings[0];
  const alternateMeanings = subject.meanings.filter((m) => m !== primaryMeaning).map((m) => m.meaning);

  const componentsLabel =
    subject.type === "KANJI"
      ? "Radicals in this kanji"
      : subject.type === "RADICAL"
        ? "Found in kanji"
        : subject.type === "SENTENCE"
          ? "Words in this sentence"
          : "Kanji used";

  const radicalFoundInKanji = subject.type === "RADICAL" ? subject.usedIn : [];
  const exampleVocab = subject.type === "KANJI" ? subject.usedIn : [];

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[720px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface",
        className,
      )}
    >
      <div className="relative border-b border-line" style={{ backgroundColor: theme.bg }}>
        <div className="h-[3px] w-full" style={{ backgroundColor: theme.base }} />

        <span
          className="absolute left-4 top-3 text-micro font-semibold uppercase tracking-[0.08em]"
          style={{ color: theme.base }}
          lang="en"
        >
          {theme.labelEn}
        </span>

        {position !== undefined && batchSize !== undefined && (
          <span
            className="absolute right-4 top-3 text-micro"
            style={{ color: "var(--color-text-dim)" }}
          >
            {position} / {batchSize}
          </span>
        )}

        <div className="flex flex-col items-center gap-3 px-6 pb-6 pt-8">
          {subject.type === "SENTENCE" ? (
            <span
              lang="ja"
              className="flex min-h-[140px] max-w-[560px] items-center justify-center text-center text-h1 leading-loose"
              style={{ color: theme.text }}
            >
              {furiganaRender ? (
                <FuriganaText render={furiganaRender} fallback={subject.furiganaFallback} />
              ) : (
                subject.characters
              )}
            </span>
          ) : (
            <>
              <span
                lang="ja"
                className="subject-glyph flex min-h-[140px] items-center justify-center text-glyph"
                style={{ color: theme.text }}
              >
                {subject.characters}
              </span>
              {furiganaRender && (
                <div className="flex flex-col items-center gap-3">
                  <FuriganaText render={furiganaRender} fallback={subject.furiganaFallback} />
                </div>
              )}
            </>
          )}
          {subject.type === "RADICAL" && primaryMeaning && (
            <span className="text-h1 text-text" lang="en">
              {primaryMeaning.meaning}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-6 pb-6 pt-5">
        {primaryMeaning && subject.type !== "RADICAL" && (
          <section className="flex flex-col gap-1">
            <p className="text-h2 font-semibold text-text">{primaryMeaning.meaning}</p>
            {alternateMeanings.length > 0 && (
              <p className="text-sub text-text-dim">{alternateMeanings.join(", ")}</p>
            )}
          </section>
        )}

        {subject.type === "KANJI" && (onyomi.length > 0 || kunyomi.length > 0) && (
          <SectionPanel label="Readings" labelColor={theme.base}>
            <div className="flex flex-col">
              {onyomi.length > 0 && (
                <div className="flex gap-4 py-1.5">
                  <span className="w-[72px] shrink-0 text-micro uppercase text-text-faint">On&apos;yomi</span>
                  <span lang="ja" className="text-h2 text-text">
                    {onyomi.map((r) => r.reading).join("、")}
                  </span>
                </div>
              )}
              {onyomi.length > 0 && kunyomi.length > 0 && <div className="h-px bg-line" />}
              {kunyomi.length > 0 && (
                <div className="flex gap-4 py-1.5">
                  <span className="w-[72px] shrink-0 text-micro uppercase text-text-faint">Kun&apos;yomi</span>
                  <span lang="ja" className="text-h2 text-text">
                    {kunyomi.map((r, i) => {
                      const [stem, okurigana] = r.reading.split(".");
                      return (
                        <span key={i}>
                          {i > 0 && "、"}
                          {stem}
                          {okurigana && <span className="text-text-dim">.{okurigana}</span>}
                        </span>
                      );
                    })}
                  </span>
                </div>
              )}
            </div>
          </SectionPanel>
        )}

        {subject.type === "VOCAB" && kana.length > 0 && (
          <SectionPanel label="Reading" labelColor={theme.base}>
            <span lang="ja" className="text-h2 text-text">
              {kana.map((r) => r.reading).join("、")}
            </span>
          </SectionPanel>
        )}

        {subject.type === "VOCAB" && subject.partsOfSpeech.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {subject.partsOfSpeech.map((pos) => (
              <span
                key={pos}
                className="rounded-[var(--radius-chip)] bg-surface-3 px-2.5 py-1 text-caption text-text-muted"
              >
                {pos}
              </span>
            ))}
          </div>
        )}

        {subject.componentsOf.length > 0 && (
          <SectionPanel label={componentsLabel} count={subject.componentsOf.length} labelColor={theme.base}>
            <ChipTray>
              {subject.componentsOf.map((c) =>
                subject.type === "SENTENCE" ? (
                  <SentenceWordChip key={c.id} component={c} />
                ) : (
                  <ComponentChip key={c.id} component={c} />
                ),
              )}
            </ChipTray>
          </SectionPanel>
        )}

        {subject.type === "SENTENCE" && subject.tatoebaSentenceId && (
          <p className="text-micro text-text-faint" lang="en">
            Example sentence #{subject.tatoebaSentenceId} from{" "}
            <a
              href={`https://tatoeba.org/en/sentences/show/${subject.tatoebaSentenceId}`}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-text-dim"
            >
              the Tatoeba Project
            </a>
            , CC BY 2.0 FR.
          </p>
        )}

        {radicalFoundInKanji.length > 0 && (
          <SectionPanel
            label={componentsLabel}
            countLabel={
              subject.usedInTotal > radicalFoundInKanji.length
                ? `${radicalFoundInKanji.length} of ${subject.usedInTotal}`
                : `${radicalFoundInKanji.length}`
            }
            labelColor={theme.base}
          >
            <ChipTray>
              {radicalFoundInKanji.map((c) => (
                <GlyphOnlyChip key={c.id} component={c} />
              ))}
            </ChipTray>
          </SectionPanel>
        )}

        {exampleVocab.length > 0 && (
          <SectionPanel label="Example vocab" count={exampleVocab.length} labelColor={theme.base}>
            <ChipTray>
              {exampleVocab.map((c) => (
                <ComponentChip key={c.id} component={c} />
              ))}
            </ChipTray>
          </SectionPanel>
        )}

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <span className="text-micro text-text-faint" lang="en">
            YOUR MNEMONICS
          </span>
          <MnemonicEditor
            subjectId={subject.id}
            field="meaningMnemonic"
            label="Meaning mnemonic"
            value={subject.meaningMnemonic}
            characters={subject.characters}
            accentColor={theme.base}
          />
          {subject.type !== "RADICAL" && subject.type !== "SENTENCE" && (
            <MnemonicEditor
              subjectId={subject.id}
              field="readingMnemonic"
              label="Reading mnemonic"
              value={subject.readingMnemonic}
              characters={subject.characters}
              accentColor={theme.base}
            />
          )}
        </div>
      </div>
    </div>
  );
}
