// LLM call behind a small interface so generate.ts never talks to a
// provider SDK directly. Two implementations: AnthropicClient (real calls,
// gated on ANTHROPIC_API_KEY) and MockClient (deterministic fakes, used for
// all verification without spending real API credits).

export interface MnemonicClient {
  /// Sends `prompt`, returns the parsed JSON response body (already
  /// JSON.parse'd) or throws on a network/API failure. Callers are
  /// responsible for shape validation via prompts.ts's parse* functions.
  generate(prompt: string): Promise<unknown>;
}

/// Real client. Reads ANTHROPIC_API_KEY from env and calls the Messages API
/// via @anthropic-ai/sdk. Never instantiated during this task's own
/// verification — see scripts/mnemonics/README.md.
export class AnthropicClient implements MnemonicClient {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options?: { apiKey?: string; model?: string }) {
    const apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. This is required to run scripts/mnemonics/generate.ts " +
          "against the real API. Use --dry-run with the mock client for testing, or set the key " +
          "in .env before a real run.",
      );
    }
    this.apiKey = apiKey;
    // claude-sonnet-4-5 is Anthropic's current mid-tier model as of this
    // script's authoring; override via ANTHROPIC_MODEL if that changes.
    this.model = options?.model ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";
  }

  async generate(prompt: string): Promise<unknown> {
    // Imported lazily so environments without the SDK installed (impossible
    // here since it's a declared dependency, but kept as good hygiene) don't
    // pay an import cost unless a real run actually happens.
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: this.apiKey });

    const message = await anthropic.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("Anthropic response had no text content block");
    }

    return JSON.parse(block.text);
  }
}

/// Deterministic mock client for tests and dry runs against the live DB
/// without spending API credits. Derives fake-but-plausible mnemonic text
/// from the prompt itself so different subjects produce different (but
/// reproducible) output, and returns the field shape each prompt asks for
/// by sniffing the prompt's own JSON-shape line.
export class MockClient implements MnemonicClient {
  async generate(prompt: string): Promise<unknown> {
    const seed = hashString(prompt).toString(36);

    if (prompt.includes('"readingMnemonic": string | null')) {
      // VOCAB shape: readingMnemonic nullable.
      const irregular = prompt.includes("also write a reading");
      return {
        meaningMnemonic: `[mock ${seed}] meaning mnemonic.`,
        readingMnemonic: irregular ? `[mock ${seed}] reading mnemonic.` : null,
      };
    }
    if (prompt.includes('"readingMnemonic": string}')) {
      // KANJI shape: readingMnemonic required.
      return {
        meaningMnemonic: `[mock ${seed}] meaning mnemonic.`,
        readingMnemonic: `[mock ${seed}] reading mnemonic.`,
      };
    }
    // RADICAL / GRAMMAR / KANA shape: meaningMnemonic only.
    return { meaningMnemonic: `[mock ${seed}] meaning mnemonic.` };
  }
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function createClient(useMock: boolean): MnemonicClient {
  return useMock ? new MockClient() : new AnthropicClient();
}
