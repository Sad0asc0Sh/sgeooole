import { fireEvent, render, screen } from "@testing-library/react";
import HomeImage from "@/components/home/HomeImage";

const dimensions = { width: 420, height: 420 };

test("exposes the browser's real image URL without a viewport observer", () => {
  render(<HomeImage src="/card.webp" alt="product" {...dimensions} />);
  const image = screen.getByRole("img", { name: "product" });
  expect(image).toHaveAttribute("src", "/card.webp");
  expect(image).toHaveAttribute("loading", "lazy");
  expect(image).toHaveAttribute("width", "420");
  expect(image).toHaveAttribute("height", "420");
});

test("uses the available backup and then the placeholder on error", () => {
  render(<HomeImage src="/card.webp" backupSources={["/full.webp"]} alt="product" {...dimensions} />);
  const image = screen.getByRole("img");
  fireEvent.error(image);
  expect(image).toHaveAttribute("src", "/full.webp");
  fireEvent.error(image);
  expect(image).toHaveAttribute("src", "/placeholder.svg");
  fireEvent.load(image);
  expect(image).toHaveAttribute("data-home-image-loaded");
});

test("falls back to the full mobile artwork when its resized version is missing", () => {
  const { container } = render(<HomeImage src="/desktop.webp" mobileSrc="/mobile-card.webp"
    mobileBackupSrc="/mobile-full.webp" alt="banner" {...dimensions} loading="eager" fetchPriority="high" />);
  const image = screen.getByRole("img") as HTMLImageElement;
  const source = container.querySelector("source");
  expect(source).toHaveAttribute("srcset", "/mobile-card.webp");
  expect(image).toHaveAttribute("fetchpriority", "high");
  Object.defineProperty(image, "currentSrc", { value: new URL("/mobile-card.webp", image.baseURI).href, configurable: true });
  fireEvent.error(image);
  expect(source).toHaveAttribute("srcset", "/mobile-full.webp");
  expect(image).toHaveAttribute("src", "/desktop.webp");
});
