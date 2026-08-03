import Link from "next/link";
import { SUBJECT_THEME } from "./theme";
import { typeToSlug } from "./typeSlug";
import { FuriganaText } from "@/components/furigana/FuriganaText";
import { renderFurigana } from "@/services/furigana/render";
import { MnemonicEditor } from "@/components/mnemonic/MnemonicEditor";
import { AcceptedMeaningsEditor } from "@/components/mnemonic/AcceptedMeaningsEditor";
import { SectionPanel } from "@/components/lessons/SectionPanel";
import { SrsStageChip } from "@/components/srs/SrsStageChip";
import { stageInfo } from "@/services/srs/stages";
import type { SubjectDetail } from "@/server/queries/subjects";
import type { LessonComponentSummary } from "@/server/queries/lessons";
import { cn } from "@/lib/utils";

export interface SubjectDetailCardProps {
  subject: SubjectDetail;
  className?: string;
}

function readingsByType(readings: SubjectDetail["readings"], type: string) {
  return readings.filter((r) => r.type === type);
}

function ComponentChip({ component }: { component: LessonComponentSummary }) {
  const childTheme = SUBJECT_THEME[component.type];
  return (
    <Link
      href={`/subjects/${typeToSlug(component.type)}/${component.slug}`}
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

function formatDueAt(dueAt: Date | null): string {
  if (!dueAt) return "—";
  const diffMs = dueAt.getTime() - Date.now();
  if (diffMs <= 0) return "Due now";
  const hours = Math.round(diffMs / (60 * 60 * 1000));
  if (hours < 24) return `In ${hours}h`;
  return `In ${Math.round(hours / 24)}d`;
}

/// Full detail view for one subject: glyph header, meanings/readings,
/// component relations, SRS state, and the mnemonic + synonym editors.
/// Reuses `LessonTeachCard`'s presentation patterns.
export function SubjectDetailCard({ subject, className }: SubjectDetailCardProps) {
  const theme = SUBJECT_THEME[subject.type];
  const onyomi = readingsByType(subject.readings, "onyomi");
  const kunyomi = readingsByType(subject.readings, "kunyomi");
  const kana = readingsByType(subject.readings, "kana");

  const furiganaRender =
    subject.type === "VOCAB" && subject.furigana ? renderFurigana(subject.furigana, true) : null;

  const primaryMeaning = subject.meanings.find((m) => m.primary) ?? subject.meanings[0];
  const alternateMeanings = subject.meanings.filter((m) => m !== primaryMeaning).map((m) => m.meaning);

  const componentsLabel =
    subject.type === "KANJI" ? "Radicals in this kanji" : subject.type === "RADICAL" ? "Found in kanji" : "Kanji used";

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
          {subject.level !== null && ` · Level ${subject.level}`}
        </span>

        {subject.srs && (
          <span className="absolute right-4 top-3">
            <SrsStageChip stage={subject.srs.stage} />
          </span>
        )}

        <div className="flex flex-col items-center gap-3 px-6 pb-6 pt-8">
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
            {alternateMeanings.length > 0 && <p className="text-sub text-text-dim">{alternateMeanings.join(", ")}</p>}
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
              <span key={pos} className="rounded-[var(--radius-chip)] bg-surface-3 px-2.5 py-1 text-caption text-text-muted">
                {pos}
              </span>
            ))}
          </div>
        )}

        {subject.componentsOf.length > 0 && (
          <SectionPanel label={componentsLabel} count={subject.componentsOf.length} labelColor={theme.base}>
            <div className="flex flex-wrap gap-2">
              {subject.componentsOf.map((c) => (
                <ComponentChip key={c.id} component={c} />
              ))}
            </div>
          </SectionPanel>
        )}

        {radicalFoundInKanji.length > 0 && (
          <SectionPanel
            label={componentsLabel}
            countLabel={subject.usedInTotal > radicalFoundInKanji.length ? `${radicalFoundInKanji.length} of ${subject.usedInTotal}` : `${radicalFoundInKanji.length}`}
            labelColor={theme.base}
          >
            <div className="flex flex-wrap gap-2">
              {radicalFoundInKanji.map((c) => (
                <ComponentChip key={c.id} component={c} />
              ))}
            </div>
          </SectionPanel>
        )}

        {exampleVocab.length > 0 && (
          <SectionPanel label="Example vocab" count={exampleVocab.length} labelColor={theme.base}>
            <div className="flex flex-wrap gap-2">
              {exampleVocab.map((c) => (
                <ComponentChip key={c.id} component={c} />
              ))}
            </div>
          </SectionPanel>
        )}

        <SectionPanel label="Your progress" labelColor={theme.base}>
          {subject.srs ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Stage" value={stageInfo(subject.srs.stage).name} />
              <Stat label="Next review" value={formatDueAt(subject.srs.dueAt)} />
              <Stat
                label="Meaning"
                value={`${subject.srs.meaningCorrect} / ${subject.srs.meaningCorrect + subject.srs.meaningIncorrect}`}
              />
              {subject.type !== "RADICAL" && (
                <Stat
                  label="Reading"
                  value={`${subject.srs.readingCorrect} / ${subject.srs.readingCorrect + subject.srs.readingIncorrect}`}
                />
              )}
              <Stat label="Mastery level" value={String(subject.srs.masteryLevel)} />
              <Stat label="Mastery XP" value={String(subject.srs.masteryXp)} />
            </div>
          ) : (
            <p className="text-caption text-text-dim">Not yet in your SRS.</p>
          )}
        </SectionPanel>

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
          {subject.type !== "RADICAL" && (
            <MnemonicEditor
              subjectId={subject.id}
              field="readingMnemonic"
              label="Reading mnemonic"
              value={subject.readingMnemonic}
              characters={subject.characters}
              accentColor={theme.base}
            />
          )}
          <AcceptedMeaningsEditor subjectId={subject.id} value={subject.acceptedMeanings} accentColor={theme.base} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-micro text-text-faint" lang="en">
        {label}
      </span>
      <span className="text-body font-medium text-text tabular-nums">{value}</span>
    </div>
  );
}
