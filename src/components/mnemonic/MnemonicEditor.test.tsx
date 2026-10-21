import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MnemonicEditor } from "./MnemonicEditor";

vi.mock("@/server/actions/mnemonics", () => ({
  saveMnemonic: async () => {},
}));

afterEach(cleanup);

/// Regression test for the mnemonic leak bug: MnemonicEditor keeps its saved
/// value in local state (`useState(value)`), which only reads the `value`
/// prop on mount. Without a `key` tied to `subjectId`, React reuses the same
/// component instance when the `subjectId`/`value` props change underneath
/// it (exactly what happens as a lesson batch advances or a subject page
/// navigates between items), and the previous subject's mnemonic stays on
/// screen — see SubjectDetailCard/LessonTeachCard/LessonRunner's
/// `key={subject.id}` usage, which forces a remount instead so this can't
/// happen.
describe("MnemonicEditor", () => {
  it("leaks the previous subject's mnemonic when re-rendered in place without a key (demonstrates the bug)", () => {
    const { rerender } = render(
      <MnemonicEditor subjectId="subject-A" field="meaningMnemonic" label="Meaning mnemonic" value="A's mnemonic" characters="A" accentColor="#000" />,
    );
    expect(screen.getByText("A's mnemonic")).toBeInTheDocument();

    // Same tree position, no key change — simulates what happens if a caller
    // forgets to key the editor by subject.
    rerender(
      <MnemonicEditor subjectId="subject-B" field="meaningMnemonic" label="Meaning mnemonic" value="B's mnemonic" characters="B" accentColor="#000" />,
    );

    // This is the leak: subject A's mnemonic is still what's shown even
    // though this is now subject B's editor.
    expect(screen.getByText("A's mnemonic")).toBeInTheDocument();
    expect(screen.queryByText("B's mnemonic")).not.toBeInTheDocument();
  });

  it("shows subject B's own mnemonic, not subject A's, once the instance is remounted via key", () => {
    function Host({ subjectId, value }: { subjectId: string; value: string }) {
      return (
        <MnemonicEditor
          key={subjectId}
          subjectId={subjectId}
          field="meaningMnemonic"
          label="Meaning mnemonic"
          value={value}
          characters={subjectId}
          accentColor="#000"
        />
      );
    }

    const { rerender } = render(<Host subjectId="subject-A" value="A's mnemonic" />);
    expect(screen.getByText("A's mnemonic")).toBeInTheDocument();

    rerender(<Host subjectId="subject-B" value="B's mnemonic" />);

    expect(screen.queryByText("A's mnemonic")).not.toBeInTheDocument();
    expect(screen.getByText("B's mnemonic")).toBeInTheDocument();
  });
});
