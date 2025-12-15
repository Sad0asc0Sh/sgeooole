const React = require("react");
require("@testing-library/jest-dom");

// Mock Next.js Image to render a basic img
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line @next/next/no-img-element
    return React.createElement("img", { ...props });
  },
}));
