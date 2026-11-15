import React from "react";
import { act, render } from "@testing-library/react";
import DeferredImage from "@/components/ui/DeferredImage";

jest.mock("@/components/ui/ResilientImage", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const originalObserver = global.IntersectionObserver;

afterEach(() => {
  global.IntersectionObserver = originalObserver;
});

test("waits until an image is near the viewport, then retains it", () => {
  let notify!: IntersectionObserverCallback;
  const observe = jest.fn();
  const unobserve = jest.fn();
  global.IntersectionObserver = jest.fn().mockImplementation((callback) => {
    notify = callback;
    return { observe, unobserve, disconnect: jest.fn() };
  });

  const { container } = render(<DeferredImage src="https://images.example/card.webp" alt="product" fill />);
  const anchor = observe.mock.calls[0][0] as Element;
  expect(container.querySelector("span > img")).toBeNull();

  act(() => notify([{ target: anchor, isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(container.querySelector("span > img")).toBeNull();

  act(() => notify([{ target: anchor, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(container.querySelector("span > img")).toHaveAttribute("src", "https://images.example/card.webp");
  expect(unobserve).toHaveBeenCalledWith(anchor);
});

test("loads normally when IntersectionObserver is unavailable", () => {
  // Older browsers must not leave images as permanent skeletons.
  global.IntersectionObserver = undefined as unknown as typeof IntersectionObserver;
  const { container } = render(<DeferredImage src="/card.webp" alt="product" fill />);
  expect(container.querySelector("span > img")).toHaveAttribute("src", "/card.webp");
});
