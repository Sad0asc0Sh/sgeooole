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
  default: ({ src, alt, priority, fill, blurDataURL, placeholder, ...props }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return React.createElement("img", { src, alt, ...props });
  },
}));

