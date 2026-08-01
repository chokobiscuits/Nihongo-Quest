import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RankBadge } from "./RankBadge";

describe("RankBadge", () => {
  it("renders tier label and division numeral", () => {
    render(<RankBadge tier="GOLD" division={2} />);
    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(screen.getByText("II")).toBeInTheDocument();
  });

  it("omits division for Master and above", () => {
    render(<RankBadge tier="MASTER" division={null} />);
    expect(screen.getByText("Master")).toBeInTheDocument();
    expect(screen.queryByText("I")).not.toBeInTheDocument();
  });

  it("applies the animated gradient class for Challenger", () => {
    const { container } = render(<RankBadge tier="CHALLENGER" division={null} />);
    expect(container.querySelector(".rank-challenger")).toBeInTheDocument();
  });

  it("hides the label when showLabel is false", () => {
    render(<RankBadge tier="IRON" division={4} showLabel={false} />);
    expect(screen.queryByText("Iron")).not.toBeInTheDocument();
    expect(screen.getByText("IV")).toBeInTheDocument();
  });
});
