import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import CartSummary from "@/components/cart/CartSummary";

describe("CartSummary", () => {
  it("shows final price and savings", () => {
    render(
      <CartSummary
        totalPrice={90000}
        totalOriginalPrice={100000}
        shipping={0}
        finalPrice={85000}
        discount={5000}
      />,
    );

    expect(screen.getByText((85000).toLocaleString("fa-IR"), { exact: false })).toBeInTheDocument();

    const couponRow = screen.getByText("کد تخفیف").closest("div");
    expect(couponRow).not.toBeNull();
    expect(within(couponRow as HTMLElement).getByText((5000).toLocaleString("fa-IR"), { exact: false })).toBeInTheDocument();
  });
});
