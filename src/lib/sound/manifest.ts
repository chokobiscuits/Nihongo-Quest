import type { CelebrationEvent } from "@/components/celebration/types";

/// Every sound the app can play. Adding an id here without dropping a file
/// at its `src` is safe: SoundManager warns once and goes quiet for that id.
export type SoundId =
  | "ui.click"
  | "ui.hover"
  | "answer.correct"
  | "answer.wrong"
  | "review.pass"
  | "review.fail"
  | "session.complete"
  | "celebrate.levelup"
  | "celebrate.promotion"
  | "celebrate.newrank"
  | "celebrate.demotion"
  | "celebrate.achievement"
  | "streak.extend";

export interface SoundSpec {
  src: string;
  /// Per-file loudness correction, applied on top of the user's volume.
  /// Assembled kits come from different sources at different levels, and
  /// this is the cheap fix where re-mastering the file is not practical.
  gain: number;
  /// Minimum gap between plays of this id. Only needed for sounds that can
  /// fire in bursts (a mouse sweeping a nav list).
  throttleMs?: number;
}

/// Sources are Kenney (CC0) files, already normalised at build time to a
/// consistent mean level per class — see public/sounds/CREDITS.md. These
/// gains are therefore small relative trims between classes, not the large
/// per-file corrections an un-normalised kit would need.
export const SOUND_MANIFEST: Record<SoundId, SoundSpec> = {
  "ui.click": { src: "/sounds/ui-click.webm", gain: 0.8 },
  "ui.hover": { src: "/sounds/ui-hover.webm", gain: 0.6, throttleMs: 60 },

  "answer.correct": { src: "/sounds/answer-correct.webm", gain: 1 },
  // An "almost"/wrong-type answer is deliberately silent — that branch
  // re-prompts without advancing, and a near-miss is not a failure.
  // Deliberately quieter than `answer.correct`: this app re-queues a miss
  // rather than failing you, so it should read as a nudge, not a buzzer.
  "answer.wrong": { src: "/sounds/answer-wrong.webm", gain: 0.75 },

  "review.pass": { src: "/sounds/review-pass.webm", gain: 0.9 },
  "review.fail": { src: "/sounds/review-fail.webm", gain: 0.8 },
  "session.complete": { src: "/sounds/session-complete.webm", gain: 0.9 },

  "celebrate.levelup": { src: "/sounds/celebrate-levelup.webm", gain: 0.9 },
  "celebrate.promotion": { src: "/sounds/celebrate-promotion.webm", gain: 0.9 },
  // The rarest event in the app, so it gets to be the loudest.
  "celebrate.newrank": { src: "/sounds/celebrate-newrank.webm", gain: 1 },
  "celebrate.demotion": { src: "/sounds/celebrate-demotion.webm", gain: 0.8 },
  "celebrate.achievement": { src: "/sounds/celebrate-achievement.webm", gain: 0.9 },

  "streak.extend": { src: "/sounds/streak-extend.webm", gain: 0.85 },
};

/// One sound per celebration kind. Exhaustive by construction, so a new
/// CelebrationEvent variant fails the typecheck here rather than silently
/// showing a modal in silence.
export const CELEBRATION_SOUND: Record<CelebrationEvent["kind"], SoundId> = {
  levelup: "celebrate.levelup",
  demotion: "celebrate.demotion",
  achievement: "celebrate.achievement",
  promotion: "celebrate.promotion",
  newrank: "celebrate.newrank",
};

/// Defaults for an account that has never touched the sound settings.
/// Shared by the layout (which configures the manager) and the settings page
/// (which renders the controls) so the two cannot drift apart.
export const DEFAULT_SOUND_ENABLED = true;
export const DEFAULT_SOUND_VOLUME = 0.6;

const SEMITONE = 2 ** (1 / 12);
const MAX_COMBO_SEMITONES = 5;

/// Playback rate for `answer.correct` on a run of `streak` consecutive
/// correct answers. Each one lifts the pitch a semitone so a streak audibly
/// climbs, capped so a long run does not end up shrill.
export function comboRateFor(streak: number): number {
  const steps = Math.min(Math.max(Math.floor(streak), 0), MAX_COMBO_SEMITONES);
  return SEMITONE ** steps;
}
