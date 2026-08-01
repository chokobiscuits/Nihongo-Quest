import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FuriganaText } from "./FuriganaText";
import { renderFurigana, wholeWordFallback } from "@/services/furigana/render";

describe("FuriganaText", () => {
  it("renders plain text in hidden mode, with no <rt>", () => {
    const rendered = renderFurigana([{ ruby: "食", rt: "た" }, { ruby: "べる" }], false);
    render(<FuriganaText render={rendered} />);

    expect(screen.getByText("食べる")).toBeInTheDocument();
    expect(document.querySelector("rt")).not.toBeInTheDocument();
  });

  it("renders one <ruby>/<rt> pair per segment in segments mode", () => {
    const rendered = renderFurigana([{ ruby: "食", rt: "た" }, { ruby: "べる" }], true);
    const { container } = render(<FuriganaText render={rendered} />);

    const rubies = container.querySelectorAll("ruby");
    expect(rubies).toHaveLength(2);
    expect(screen.getByText("た")).toBeInTheDocument();
  });

  it("applies the ruby-fallback class for whole-word fallback segments", () => {
    const segments = wholeWordFallback("難しい", "むずかしい");
    const rendered = renderFurigana(segments, true);
    const { container } = render(<FuriganaText render={rendered} fallback />);

    expect(container.querySelector(".ruby-fallback")).toBeInTheDocument();
  });

  it("wraps each ruby in a lang=ja span for Safari ruby positioning", () => {
    const rendered = renderFurigana([{ ruby: "食", rt: "た" }], true);
    const { container } = render(<FuriganaText render={rendered} />);

    const wrapper = container.querySelector("span[lang='ja'] > ruby")?.parentElement;
    expect(wrapper).not.toBeNull();
  });
});
