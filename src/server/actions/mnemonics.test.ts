import { describe, expect, it, vi, beforeEach } from "vitest";

// In-memory stand-in for the UserMnemonic table, keyed the same way the real
// unique constraint is: `${userId}:${subjectId}`.
let store: Map<string, Record<string, unknown>>;
let currentUserId: string;

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: async () => currentUserId,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    userMnemonic: {
      upsert: async ({ where, create, update }: { where: { userId_subjectId: { userId: string; subjectId: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const key = `${where.userId_subjectId.userId}:${where.userId_subjectId.subjectId}`;
        const existing = store.get(key);
        const next = existing ? { ...existing, ...update } : { ...create };
        store.set(key, next);
        return next;
      },
      findUnique: async ({ where }: { where: { userId_subjectId: { userId: string; subjectId: string } } }) => {
        const key = `${where.userId_subjectId.userId}:${where.userId_subjectId.subjectId}`;
        return store.get(key) ?? null;
      },
    },
    subject: {
      findUniqueOrThrow: async () => ({ acceptedMeanings: ["seeded synonym"] }),
    },
  },
}));

const { saveMnemonic, acceptMeaningAnswer } = await import("./mnemonics");

describe("saveMnemonic", () => {
  beforeEach(() => {
    store = new Map();
  });

  it("scopes the write to the current subject only, not a sibling subject", async () => {
    currentUserId = "user-1";
    await saveMnemonic({ subjectId: "subject-A", meaningMnemonic: "mnemonic for A" });
    await saveMnemonic({ subjectId: "subject-B", meaningMnemonic: "mnemonic for B" });

    const a = await import("@/lib/db").then((m) => m.prisma.userMnemonic.findUnique({ where: { userId_subjectId: { userId: "user-1", subjectId: "subject-A" } } }));
    const b = await import("@/lib/db").then((m) => m.prisma.userMnemonic.findUnique({ where: { userId_subjectId: { userId: "user-1", subjectId: "subject-B" } } }));

    expect(a?.meaningMnemonic).toBe("mnemonic for A");
    expect(b?.meaningMnemonic).toBe("mnemonic for B");
  });

  it("never derives the owning user from client input: two users editing the same subject stay isolated", async () => {
    currentUserId = "user-1";
    await saveMnemonic({ subjectId: "shared-subject", meaningMnemonic: "user 1's mnemonic" });

    currentUserId = "user-2";
    await saveMnemonic({ subjectId: "shared-subject", meaningMnemonic: "user 2's mnemonic" });

    const forUser1 = await import("@/lib/db").then((m) => m.prisma.userMnemonic.findUnique({ where: { userId_subjectId: { userId: "user-1", subjectId: "shared-subject" } } }));
    const forUser2 = await import("@/lib/db").then((m) => m.prisma.userMnemonic.findUnique({ where: { userId_subjectId: { userId: "user-2", subjectId: "shared-subject" } } }));

    expect(forUser1?.meaningMnemonic).toBe("user 1's mnemonic");
    expect(forUser2?.meaningMnemonic).toBe("user 2's mnemonic");
  });
});

describe("acceptMeaningAnswer", () => {
  beforeEach(() => {
    store = new Map();
  });

  it("appends to the current user's own whitelist without affecting another user's", async () => {
    currentUserId = "user-1";
    await acceptMeaningAnswer("shared-subject", "my synonym");

    currentUserId = "user-2";
    const forUser2 = await import("@/lib/db").then((m) => m.prisma.userMnemonic.findUnique({ where: { userId_subjectId: { userId: "user-2", subjectId: "shared-subject" } } }));

    // User 2 never wrote anything, so they have no override row at all —
    // the seeded fallback is applied by the read path, not stored here.
    expect(forUser2).toBeNull();

    // User 1's override carries the seeded "seeded synonym" fallback forward
    // (so the append doesn't drop what Subject already allowed) plus their
    // own new addition.
    const forUser1 = await import("@/lib/db").then((m) => m.prisma.userMnemonic.findUnique({ where: { userId_subjectId: { userId: "user-1", subjectId: "shared-subject" } } }));
    expect(forUser1?.acceptedMeanings).toEqual(["seeded synonym", "my synonym"]);
  });
});
