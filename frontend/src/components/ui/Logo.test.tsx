import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { render } from "@testing-library/react";
import { Logo, LOGO_RATIO_PLACEHOLDER } from "./Logo";

function paethPredictor(a: number, b: number, c: number) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

function readPngInfo(filePath: string) {
    const buf = fs.readFileSync(filePath);
    expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const bitDepth = buf[24];
    const colorType = buf[25];

    const idatChunks: Buffer[] = [];
    let offset = 8;
    while (offset < buf.length) {
        const len = buf.readUInt32BE(offset);
        const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
        if (type === "IDAT") {
            idatChunks.push(buf.subarray(offset + 8, offset + 8 + len));
        }
        offset += 12 + len;
    }

    const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
    const bpp = 4;
    const stride = width * bpp;
    const prev = new Uint8Array(stride);
    const curr = new Uint8Array(stride);

    let partialAlpha = 0;
    let opaqueWhiteHalo = 0;
    let maskCoverageK = 0;
    let maskCoverageKala = 0;

    for (let y = 0; y < height; y++) {
        const rowStart = y * (stride + 1);
        const filter = inflated[rowStart];
        for (let x = 0; x < stride; x++) {
            const raw = inflated[rowStart + 1 + x];
            const left = x >= bpp ? curr[x - bpp] : 0;
            const up = prev[x];
            const upLeft = x >= bpp ? prev[x - bpp] : 0;

            let val = raw;
            if (filter === 1) val = (raw + left) & 0xff;
            else if (filter === 2) val = (raw + up) & 0xff;
            else if (filter === 3) val = (raw + ((left + up) >> 1)) & 0xff;
            else if (filter === 4) val = (raw + paethPredictor(left, up, upLeft)) & 0xff;
            curr[x] = val;
        }
        for (let px = 0; px < width; px++) {
            const p = px * 4;
            const r = curr[p];
            const g = curr[p + 1];
            const b = curr[p + 2];
            const a = curr[p + 3];
            if (a > 0 && a < 255) partialAlpha++;
            if (a === 255 && r > 220 && g > 220 && b > 220) {
                opaqueWhiteHalo++;
            }
            if (a > 200) {
                if (px >= 270 && px <= 415) maskCoverageK++;
                if (px >= 612 && px <= 929) maskCoverageKala++;
            }
        }
        prev.set(curr);
    }

    return {
        width,
        height,
        bitDepth,
        colorType,
        hasTrnsChunk: buf.includes(Buffer.from("tRNS")),
        partialAlpha,
        opaqueWhiteHalo,
        maskCoverageK,
        maskCoverageKala,
    };
}

describe("Logo unified atomic loading, non-drag interaction & Force-Dark adaptive system", () => {
    it("renders zero background box, non-draggable atomic placeholder carrier, and lazy monolithic fallback", () => {
        const { container } = render(<Logo />);
        expect(container.querySelector(".ekg-logo-frame")).toBeNull();
        expect(container.querySelector('picture source[media="(prefers-color-scheme: dark)"]')).toBeNull();

        const fallbackImg = container.querySelector("img.ekg-logo-fallback");
        expect(fallbackImg).not.toBeNull();
        expect(fallbackImg).toHaveAttribute("src", "/logo-text.png");
        expect(fallbackImg).toHaveAttribute("width", "929");
        expect(fallbackImg).toHaveAttribute("height", "316");
        expect(fallbackImg).toHaveAttribute("loading", "lazy");
        expect(fallbackImg).toHaveAttribute("draggable", "false");
        expect(fallbackImg).toHaveClass("pointer-events-none", "select-none");

        const composite = container.querySelector(".ekg-logo-composite");
        expect(composite).not.toBeNull();
        const baseImg = composite?.querySelector("img.ekg-logo-base");
        expect(baseImg).toHaveAttribute("src", LOGO_RATIO_PLACEHOLDER);
        expect(baseImg).toHaveAttribute("alt", "ای کا جی کالا | ekgkala");
        expect(baseImg).toHaveAttribute("width", "929");
        expect(baseImg).toHaveAttribute("height", "316");
        expect(baseImg).toHaveAttribute("draggable", "false");
        expect(baseImg).toHaveClass("pointer-events-none", "select-none");
        expect(composite?.querySelector(".ekg-logo-ink-mask")).not.toBeNull();

        // Placeholder PNG matches exact 929x316 intrinsic dimensions
        const placeholderPng = Buffer.from(
            LOGO_RATIO_PLACEHOLDER.replace("data:image/png;base64,", ""),
            "base64"
        );
        expect(placeholderPng.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
        expect(placeholderPng.readUInt32BE(16)).toBe(929);
        expect(placeholderPng.readUInt32BE(20)).toBe(316);
    });

    it("ships halo-free 929x316 32-bit RGBA monolithic, color-base, and k+kala alpha mask PNGs", () => {
        const publicDir = path.resolve(__dirname, "../../../public");
        const full = readPngInfo(path.join(publicDir, "logo-text.png"));
        const base = readPngInfo(path.join(publicDir, "logo-text-base.png"));
        const mask = readPngInfo(path.join(publicDir, "logo-text-mask.png"));

        for (const info of [full, base, mask]) {
            expect(info.width).toBe(929);
            expect(info.height).toBe(316);
            expect(info.bitDepth).toBe(8);
            expect(info.colorType).toBe(6);
            expect(info.hasTrnsChunk).toBe(false);
            expect(info.opaqueWhiteHalo).toBe(0);
            expect(info.partialAlpha).toBeGreaterThan(500);
        }

        // Mask strictly isolates 'k' + 'kala' without leaving leftover opaque ink inside base
        expect(mask.maskCoverageK).toBeGreaterThan(8000);
        expect(mask.maskCoverageKala).toBeGreaterThan(14000);
    });

    it("inlines BOTH base e+G+| and Force-Dark DrawText mask in globals.css for single-frame atomic paint and anti-drag safety", () => {
        const globalsCss = fs.readFileSync(
            path.resolve(__dirname, "../../app/globals.css"),
            "utf8"
        );
        expect(globalsCss).not.toContain(".ekg-logo-frame");

        const blockStart = globalsCss.indexOf(".ekg-logo-link");
        expect(blockStart).toBeGreaterThan(-1);
        const logoSection = globalsCss.slice(blockStart);

        expect(logoSection).toContain("-webkit-user-drag: none");
        expect(logoSection).toContain(".ekg-logo-link:focus:not(:focus-visible)");
        expect(logoSection).toContain("background-image: url(\"data:image/png;base64,");
        expect(logoSection).toContain("-webkit-mask-image: url(\"data:image/png;base64,");
        expect(logoSection).toContain(".ekg-logo-ink-mask::before");
        expect(logoSection).toContain("color: #0e1d45");
        expect(logoSection).not.toMatch(/oklch\(|color-mix\(|in\s+oklab|clamp\(|(?:^|\s)inset\s*:/im);

        // Both embedded PNGs in globals.css must have identical 929x316 geometry so e+G+| and k+kala align 1:1
        const baseMatch = logoSection.match(/background-image: url\("data:image\/png;base64,([A-Za-z0-9+/=]+)"\)/);
        const maskMatch = logoSection.match(/-webkit-mask-image: url\("data:image\/png;base64,([A-Za-z0-9+/=]+)"\)/);
        expect(baseMatch).not.toBeNull();
        expect(maskMatch).not.toBeNull();

        const inlineBaseBuf = Buffer.from(baseMatch![1], "base64");
        const inlineMaskBuf = Buffer.from(maskMatch![1], "base64");
        expect(inlineBaseBuf.readUInt32BE(16)).toBe(929);
        expect(inlineBaseBuf.readUInt32BE(20)).toBe(316);
        expect(inlineMaskBuf.readUInt32BE(16)).toBe(929);
        expect(inlineMaskBuf.readUInt32BE(20)).toBe(316);
    });

    it("prevents Header logo links from dragging apart or showing a black focus rectangle on mouse hold", () => {
        const headerTsx = fs.readFileSync(
            path.resolve(__dirname, "../layout/Header.tsx"),
            "utf8"
        );
        const logoLinks = headerTsx.match(/className="ekg-logo-link[^"]*"/g) || [];
        expect(logoLinks.length).toBe(2);
        const draggableFalseLinks = headerTsx.match(/draggable=\{false\}/g) || [];
        expect(draggableFalseLinks.length).toBeGreaterThanOrEqual(2);
        expect(headerTsx).toContain("focus:outline-none focus-visible:ring-2");
    });
});
