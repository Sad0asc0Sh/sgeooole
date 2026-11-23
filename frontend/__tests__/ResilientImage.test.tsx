import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ResilientImage from "@/components/ui/ResilientImage";

const previousObserver = global.IntersectionObserver;
const observe = jest.fn();
let notify: IntersectionObserverCallback;

beforeEach(() => {
  jest.useFakeTimers();
  observe.mockClear();
  global.IntersectionObserver = jest.fn().mockImplementation((callback) => {
    notify = callback;
    return { observe, disconnect: jest.fn() };
  });
});

afterEach(() => {
  global.IntersectionObserver = previousObserver;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const getImage = () => screen.getByRole<HTMLImageElement>("img");
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));
const reveal = (image: HTMLImageElement) => act(() => {
  const rect = image.getBoundingClientRect();
  notify([{
    target: image, isIntersecting: true, intersectionRatio: 1,
    boundingClientRect: rect, intersectionRect: rect, rootBounds: null, time: 0,
  }], {} as IntersectionObserver);
});

test("waits for a lazy image to become visible before retrying with a fresh URL", () => {
  const ref = createRef<HTMLImageElement>();
  render(<ResilientImage ref={ref} src="/product.webp" alt="product" width={100} height={100} maxRetries={1} />);
  const first = getImage();
  expect(observe).toHaveBeenCalledWith(first);
  expect(first).toHaveAttribute("loading", "lazy");
  fireEvent.error(first);
  fireEvent.error(first);
  advance(1500);
  expect(getImage()).toBe(first);

  reveal(first);
  advance(500);
  const retry = getImage();
  expect(ref.current).toBe(retry);
  expect(retry).not.toBe(first);
  expect(retry).toHaveAttribute("src", expect.stringMatching(/^\/product\.webp\?_retry=/));
  fireEvent.error(retry);
  expect(getImage()).toHaveAttribute("src", "/placeholder.svg");
});

test("recovers a visible thumbnail whose request never signals success or failure", () => {
  render(<ResilientImage src="/thumb.webp" backupSrc="/full.webp" alt="thumbnail" width={64} height={64} />);
  const image = getImage();
  advance(60_000);
  expect(image).toHaveAttribute("src", "/thumb.webp");

  reveal(image);
  expect(image).toHaveAttribute("loading", "eager");
  advance(20_000);
  const full = getImage();
  expect(full).toHaveAttribute("src", "/full.webp");
  expect(full).toHaveAttribute("loading", "eager");

  jest.spyOn(full, "naturalWidth", "get").mockReturnValue(420);
  fireEvent.load(full);
  advance(60_000);
  expect(getImage()).toBe(full);
  expect(full.parentElement?.querySelector('[aria-hidden="true"]')).toBeNull();
});

test("uses the original photo when a thumbnail was already broken before handlers attached", () => {
  jest.spyOn(HTMLImageElement.prototype, "complete", "get").mockImplementation(function (this: HTMLImageElement) {
    return this.getAttribute("src") === "/thumb.webp";
  });
  jest.spyOn(HTMLImageElement.prototype, "currentSrc", "get").mockImplementation(function (this: HTMLImageElement) {
    return this.src;
  });

  render(<ResilientImage src="/thumb.webp" backupSrc="/full.webp" alt="thumbnail" width={64} height={64} />);
  expect(getImage()).toHaveAttribute("src", "/full.webp");
});

test("ends the loading indicator when every visible request times out", () => {
  render(<ResilientImage src="/photo.webp" alt="photo" width={64} height={64} loading="eager" maxRetries={1} />);
  advance(20_000);
  advance(500);
  expect(getImage()).toHaveAttribute("src", expect.stringMatching(/^\/photo\.webp\?_retry=/));

  advance(20_000);
  const image = getImage();
  expect(image).toHaveAttribute("src", "/placeholder.svg");
  expect(image.parentElement?.querySelector('[aria-hidden="true"]')).toBeNull();
});

test("retries both available sources and settles on a placeholder after the last failure", () => {
  const onRetryExhausted = jest.fn();
  render(<ResilientImage src="/thumb.webp" backupSrc="/full.webp" alt="thumbnail" width={64} height={64}
    loading="eager" onRetryExhausted={onRetryExhausted} />);

  fireEvent.error(getImage());
  expect(getImage()).toHaveAttribute("src", "/full.webp");
  fireEvent.error(getImage());
  advance(500);
  expect(getImage()).toHaveAttribute("src", expect.stringMatching(/^\/thumb\.webp\?_retry=/));
  fireEvent.error(getImage());
  advance(1500);
  expect(getImage()).toHaveAttribute("src", expect.stringMatching(/^\/full\.webp\?_retry=/));
  fireEvent.error(getImage());

  const placeholder = getImage();
  expect(placeholder).toHaveAttribute("src", "/placeholder.svg");
  expect(placeholder.parentElement?.querySelector('[aria-hidden="true"]')).toBeNull();
  fireEvent.error(placeholder);
  advance(60_000);
  expect(getImage()).toBe(placeholder);
  expect(onRetryExhausted).toHaveBeenCalledTimes(1);
});

test("clears a scheduled retry when the gallery switches to a different photo", () => {
  const { rerender } = render(<ResilientImage src="/old.webp" alt="photo" width={64} height={64} loading="eager" />);
  const oldImage = getImage();
  fireEvent.error(oldImage);

  rerender(<ResilientImage src="/new.webp" alt="photo" width={64} height={64} loading="eager" />);
  advance(1500);
  expect(getImage()).not.toBe(oldImage);
  expect(getImage()).toHaveAttribute("src", "/new.webp");
});
