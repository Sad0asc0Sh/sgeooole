import { validateProgrammaticContent } from "../index";

describe("programmatic content validation (Phase 2)", () => {
  it("has no duplicate slugs or dangling related links", () => {
    const errors = validateProgrammaticContent();
    expect(errors).toEqual([]);
  });
});
