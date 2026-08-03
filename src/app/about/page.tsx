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
      <p className="mt-4 text-body text-text-dim">
        Example sentences are sourced from the{" "}
        <a href="https://tatoeba.org/" target="_blank" rel="noreferrer" className="underline hover:text-text">
          Tatoeba Project
        </a>
        , contributed by its community and used under CC BY 2.0 FR. Each
        sentence&apos;s detail page links back to its original entry on
        tatoeba.org.
      </p>
    </div>
  );
}
