import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SrsStageChip } from "./SrsStageChip";

describe("SrsStageChip", () => {
  it("renders the Lesson name for stage 0", () => {
    render(<SrsStageChip stage={0} />);
    expect(screen.getByText("Lesson")).toBeInTheDocument();
  });

  it("renders Apprentice stage names verbatim", () => {
    render(<SrsStageChip stage={1} />);
    expect(screen.getByText("Apprentice I")).toBeInTheDocument();
  });

  it("renders Guru stage names verbatim", () => {
    render(<SrsStageChip stage={5} />);
    expect(screen.getByText("Guru I")).toBeInTheDocument();
  });

  it("renders Burned for stage 9", () => {
    render(<SrsStageChip stage={9} />);
    expect(screen.getByText("Burned")).toBeInTheDocument();
  });

  it("throws for an out-of-range stage, matching stageInfo's contract", () => {
    expect(() => render(<SrsStageChip stage={10} />)).toThrow();
  });
});
