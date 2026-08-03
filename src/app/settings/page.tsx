import { getOrCreateProfile } from "@/server/queries/profile";
import { SettingsForm } from "@/components/settings/SettingsForm";

export default async function SettingsPage() {
  const profile = await getOrCreateProfile();
  const settings = (profile.settings ?? {}) as { lessonBatchSize?: number; furiganaOverride?: boolean | null };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">Settings</span> <span lang="ja" className="text-text-muted">設定</span>
      </h1>

      <SettingsForm
        initial={{
          displayName: profile.displayName,
          avatarUrl: profile.avatarPath ? `/uploads/${profile.avatarPath}` : null,
          lessonBatchSize: settings.lessonBatchSize ?? 5,
          furiganaOverride: settings.furiganaOverride ?? null,
          timezone: profile.timezone,
        }}
      />
    </div>
  );
}
