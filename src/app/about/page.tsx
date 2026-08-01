export default function AboutPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-h1 font-semibold text-text" lang="en">
        About &amp; Attribution
      </h1>
      <p className="mt-4 text-body text-text-dim">
        Seeded dictionary and kanji data on this site comes from third-party
        sources licensed under CC BY-SA and is used with attribution. See the
        `DataSource` table for the full list of sources, licenses, and
        attribution text.
      </p>
    </div>
  );
}
