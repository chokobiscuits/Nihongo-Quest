import { describe, expect, it } from "vitest";
import { cleanKunReading } from "../okurigana";

describe("cleanKunReading", () => {
  it("strips the okurigana dot for the clean form, keeps raw as-is", () => {
    expect(cleanKunReading("た.べる")).toEqual({ raw: "た.べる", clean: "たべる" });
  });

  it("handles multiple dots", () => {
    expect(cleanKunReading("おこ.る.す")).toEqual({ raw: "おこ.る.す", clean: "おこるす" });
  });

  it("passes through readings with no dot unchanged", () => {
    expect(cleanKunReading("やま")).toEqual({ raw: "やま", clean: "やま" });
  });
});
