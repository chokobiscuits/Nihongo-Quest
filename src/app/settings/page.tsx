import Link from "next/link";
import { getOrCreateProfile } from "@/server/queries/profile";
import { storage } from "@/lib/storage";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { KanaSkipControl } from "@/components/kana/KanaSkipControl";
import { ResetProgressControl } from "@/components/settings/ResetProgressControl";
import { isKanaResolvedFor } from "@/services/srs/kana-gate";
import { DEFAULT_SOUND_ENABLED, DEFAULT_SOUND_VOLUME } from "@/lib/sound/manifest";
import { DEFAULT_SPEECH_AUTOPLAY } from "@/components/speech/speechSettings";

export default async function SettingsPage() {
  const profile = await getOrCreateProfile();
  const settings = (profile.settings ?? {}) as {
    lessonBatchSize?: number;
    furiganaOverride?: boolean | null;
    soundEnabled?: boolean;
    soundVolume?: number;
    pronunciationAutoplay?: boolean;
  };
  const kanaResolved = await isKanaResolvedFor(profile.userId);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">Settings</span> <span lang="ja" className="text-text-muted">設定</span>
      </h1>

      <SettingsForm
        initial={{
          displayName: profile.displayName,
          avatarUrl: profile.avatarPath ? storage.publicUrl(profile.avatarPath) : null,
          lessonBatchSize: settings.lessonBatchSize ?? 5,
          furiganaOverride: settings.furiganaOverride ?? null,
          timezone: profile.timezone,
          soundEnabled: settings.soundEnabled ?? DEFAULT_SOUND_ENABLED,
          soundVolume: settings.soundVolume ?? DEFAULT_SOUND_VOLUME,
          pronunciationAutoplay: settings.pronunciationAutoplay ?? DEFAULT_SPEECH_AUTOPLAY,
        }}
        showLogout={Boolean(process.env.APP_PASSWORD)}
      />

      <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <span className="text-micro font-medium uppercase tracking-wide text-text-dim" lang="en">
          Kana
        </span>
        <p className="text-caption text-text-dim">
          If you already know hiragana and katakana, skip the kana lessons — radicals unlock as soon as every kana
          is passed or skipped.
        </p>
        <KanaSkipControl initialResolved={kanaResolved} />
      </div>

      <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <span className="text-micro font-medium uppercase tracking-wide text-text-dim" lang="en">
          About
        </span>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-body">
          <Link href="/changelog" className="text-brand-text hover:underline">
            What&apos;s new
          </Link>
          <Link href="/about" className="text-brand-text hover:underline">
            About &amp; attribution
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-danger/40 bg-surface p-5">
        <span className="text-micro font-medium uppercase tracking-wide text-danger" lang="en">
          Danger zone
        </span>
        <ResetProgressControl />
      </div>
    </div>
  );
}
