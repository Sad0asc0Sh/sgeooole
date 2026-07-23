import { NAV_STACK_KEY, getInternalNavStack } from "@/hooks/useSmartBack";

describe("useSmartBack / NAV_STACK_KEY", () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    test("returns empty array when sessionStorage is empty", () => {
        expect(getInternalNavStack()).toEqual([]);
    });

    test("reads navigation stack from sessionStorage", () => {
        sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(["/", "/product/123"]));
        expect(getInternalNavStack()).toEqual(["/", "/product/123"]);
    });

    test("handles direct Torob landing (single item in stack)", () => {
        sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(["/product/123"]));
        const stack = getInternalNavStack();
        expect(stack.length).toBe(1);
    });
});
