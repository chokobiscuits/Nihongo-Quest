/// Merges a Subject's seeded-default USER-AUTHORED block with a signed-in
/// user's own UserMnemonic override. The override, when present, wins field
/// by field; a field the user has never touched on their override row falls
/// back to Subject's own (seeded/generated) value. See prisma/schema.prisma's
/// UserMnemonic model for why this split exists: Subject is shared across
/// every account, so writing a user's edit there would leak it to everyone
/// else.
///
/// `acceptedMeanings` is NOT merged (union) with Subject's own list — an
/// override row, once it exists, fully replaces it, mirroring how the
/// mnemonic fields themselves are replaced rather than combined. A user's
/// override is created with `[]` only when they have added nothing of their
/// own yet, in which case falling back to Subject's seeded list below is
/// still correct.
export interface SubjectMnemonicFields {
  meaningMnemonic: string | null;
  readingMnemonic: string | null;
  meaningHint: string | null;
  readingHint: string | null;
  acceptedMeanings: unknown;
}

export interface UserMnemonicOverride {
  meaningMnemonic: string | null;
  readingMnemonic: string | null;
  meaningHint: string | null;
  readingHint: string | null;
  acceptedMeanings: unknown;
}

export interface MergedMnemonicFields {
  meaningMnemonic: string | null;
  readingMnemonic: string | null;
  meaningHint: string | null;
  readingHint: string | null;
  acceptedMeanings: string[];
}

export function mergeMnemonicFields(
  subject: SubjectMnemonicFields,
  override: UserMnemonicOverride | null | undefined,
): MergedMnemonicFields {
  if (!override) {
    return {
      meaningMnemonic: subject.meaningMnemonic,
      readingMnemonic: subject.readingMnemonic,
      meaningHint: subject.meaningHint,
      readingHint: subject.readingHint,
      acceptedMeanings: (subject.acceptedMeanings as string[]) ?? [],
    };
  }

  return {
    meaningMnemonic: override.meaningMnemonic ?? subject.meaningMnemonic,
    readingMnemonic: override.readingMnemonic ?? subject.readingMnemonic,
    meaningHint: override.meaningHint ?? subject.meaningHint,
    readingHint: override.readingHint ?? subject.readingHint,
    acceptedMeanings: (override.acceptedMeanings as string[]) ?? [],
  };
}
