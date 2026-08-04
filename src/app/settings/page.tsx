import { getOrCreateProfile } from "@/server/queries/profile";
import { storage } from "@/lib/storage";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { KanaSkipControl } from "@/components/kana/KanaSkipControl";
import { ResetProgressControl } from "@/components/settings/ResetProgressControl";
import { isKanaResolvedFor } from "@/services/srs/kana-gate";

export default async function SettingsPage() {
  const profile = await getOrCreateProfile();
  const settings = (profile.settings ?? {}) as { lessonBatchSize?: number; furiganaOverride?: boolean | null };
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

      <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-danger/40 bg-surface p-5">
        <span className="text-micro font-medium uppercase tracking-wide text-danger" lang="en">
          Danger zone
        </span>
        <ResetProgressControl />
      </div>
    </div>
  );
}
