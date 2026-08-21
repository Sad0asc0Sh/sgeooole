import { fireEvent, render, screen } from "@testing-library/react";
import RouteLoadingProvider, { useRouteLoadingState } from "./RouteLoadingProvider";

let pathname = "/products";
let search = "";

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
}));

function RouteProbe() {
  const { isCurrentRouteReady, markRoutePending, markRouteReady } = useRouteLoadingState();

  return (
    <>
      <output data-testid="state">{isCurrentRouteReady ? "ready" : "pending"}</output>
      <button type="button" onClick={markRoutePending}>pending</button>
      <button type="button" onClick={markRouteReady}>ready</button>
    </>
  );
}

describe("RouteLoadingProvider", () => {
  beforeEach(() => {
    pathname = "/products";
    search = "";
  });

  it("requires the products route to become ready again after a round-trip", () => {
    const view = render(
      <RouteLoadingProvider>
        <RouteProbe />
      </RouteLoadingProvider>,
    );

    expect(screen.getByTestId("state")).toHaveTextContent("pending");
    fireEvent.click(screen.getByRole("button", { name: "ready" }));
    expect(screen.getByTestId("state")).toHaveTextContent("ready");

    pathname = "/product/example";
    view.rerender(
      <RouteLoadingProvider>
        <RouteProbe />
      </RouteLoadingProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "pending" }));

    pathname = "/products";
    view.rerender(
      <RouteLoadingProvider>
        <RouteProbe />
      </RouteLoadingProvider>,
    );
    expect(screen.getByTestId("state")).toHaveTextContent("pending");
  });
});
