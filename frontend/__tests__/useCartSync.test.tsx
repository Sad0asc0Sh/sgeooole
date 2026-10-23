import React from "react";
import { act, render } from "@testing-library/react";
import { useCartSync } from "@/hooks/useCartSync";
import { authService } from "@/services/authService";

const mockSyncCartFromSource = jest.fn().mockResolvedValue(undefined);

jest.mock("@/store/cartStore", () => ({
    useCartStore: {
        getState: () => ({ syncCartFromSource: mockSyncCartFromSource }),
    },
}));

jest.mock("@/services/authService", () => ({
    authService: { isAuthenticated: jest.fn(() => false) },
}));

function Harness() {
    useCartSync();
    return null;
}

const flush = () => act(() => Promise.resolve());

describe("useCartSync — بازخوانی سبد وقتی صفحه از cache برمی‌گردد", () => {
    beforeEach(() => {
        jest.mocked(authService.isAuthenticated).mockReturnValue(false);
        mockSyncCartFromSource.mockClear();
    });

    it("bfcache: pageshow با persisted=true سبد را بازخوانی می‌کند", async () => {
        render(<Harness />);

        act(() => {
            window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
        });
        await flush();

        expect(mockSyncCartFromSource).toHaveBeenCalledTimes(1);
    });

    it("لود معمولی: pageshow با persisted=false کاری نمی‌کند", async () => {
        render(<Harness />);

        act(() => {
            window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: false }));
        });
        await flush();

        expect(mockSyncCartFromSource).not.toHaveBeenCalled();
    });

    it("back/forward: برای مهمان سبد از localStorage بازخوانی می‌شود", async () => {
        render(<Harness />);

        act(() => {
            window.dispatchEvent(new Event("popstate"));
        });
        await flush();

        expect(mockSyncCartFromSource).toHaveBeenCalledTimes(1);
    });

    it("back/forward: برای کاربر لاگین‌شده درخواست شبکه‌ی اضافه نمی‌زند", async () => {
        jest.mocked(authService.isAuthenticated).mockReturnValue(true);
        render(<Harness />);

        act(() => {
            window.dispatchEvent(new Event("popstate"));
        });
        await flush();

        expect(mockSyncCartFromSource).not.toHaveBeenCalled();
    });

    it("بازگشت تب به foreground بعد از وقفه‌ی طولانی سبد را تازه می‌کند", async () => {
        render(<Harness />);

        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        await flush();

        expect(mockSyncCartFromSource).toHaveBeenCalledTimes(1);
    });

    it("پس از unmount هیچ listener روی window نمی‌ماند", async () => {
        const { unmount } = render(<Harness />);
        unmount();

        act(() => {
            window.dispatchEvent(new Event("popstate"));
            window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
        });
        await flush();

        expect(mockSyncCartFromSource).not.toHaveBeenCalled();
    });
});
