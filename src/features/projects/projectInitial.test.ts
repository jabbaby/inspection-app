import { describe, expect, it } from "vitest";
import { projectInitial } from "./projectInitial";

describe("projectInitial", () => {
  it("takes the first letter of the job name", () => {
    expect(
      projectInitial({ jobName: "example apartments", jobNumber: "" }),
    ).toBe("E");
  });

  it("skips digits and other characters", () => {
    expect(projectInitial({ jobName: "12 Smith St", jobNumber: "SY1" })).toBe(
      "S",
    );
    expect(projectInitial({ jobName: "  #3-5 rose", jobNumber: "" })).toBe("R");
  });

  it("falls back to the job number's first letter", () => {
    expect(projectInitial({ jobName: "123", jobNumber: "sy000001" })).toBe("S");
    expect(projectInitial({ jobName: "", jobNumber: "24-0012B" })).toBe("B");
  });

  it("shows ? when there are no letters", () => {
    expect(projectInitial({ jobName: "", jobNumber: "2401" })).toBe("?");
  });
});
