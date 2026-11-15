import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ResilientImage from "@/components/ui/ResilientImage";

test("observes the image itself and retries a failed URL before showing the fallback", () => {
  jest.useFakeTimers();
  const previous = global.IntersectionObserver;
  let notify!: IntersectionObserverCallback;
  const observe = jest.fn();
  global.IntersectionObserver = jest.fn().mockImplementation((callback) => {
    notify = callback;
    return { observe, disconnect: jest.fn() };
  });

  const { unmount } = render(<ResilientImage src="/product.webp" alt="product" width={100} height={100} maxRetries={1} />);
  const img = screen.getByRole("img", { name: "product" }) as HTMLImageElement;
  expect(observe).toHaveBeenCalledWith(img);
  const setSrc = jest.spyOn(img, "src", "set");
  fireEvent.error(img);
  act(() => notify([{ target: img, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
  act(() => jest.advanceTimersByTime(500));
  expect(setSrc).toHaveBeenCalledWith("/product.webp");
  fireEvent.error(img);
  expect(img).toHaveAttribute("src", "/placeholder.svg");

  unmount();
  global.IntersectionObserver = previous;
  jest.useRealTimers();
});
