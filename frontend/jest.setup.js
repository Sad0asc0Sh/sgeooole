const React = require("react");
require("@testing-library/jest-dom");

// Mock IntersectionObserver for JSDOM
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Next.js Image to render a basic img
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, _priority, _fill, _blurDataURL, _placeholder, ...props }) => {
    return React.createElement("img", { src, alt, ...props });
  },
}));

