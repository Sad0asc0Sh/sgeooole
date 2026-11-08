import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { render, screen } from "@testing-library/react";
import { Logo } from "./Logo";

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
    const bpp = 4; // RGBA 8-bit
    const stride = width * bpp;
    const prev = new Uint8Array(stride);
    const curr = new Uint8Array(stride);

    let partialAlpha = 0;
    let opaqueWhiteHalo = 0;
    let navyInK = 0;
    let navyInKala = 0;

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
            if (a === 255 && r < 45 && g < 60 && b > r + 20 && b < 115) {
                if (px >= 270 && px <= 370) navyInK++;
                if (px >= 630 && px <= 920) navyInKala++;
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
        md5: crypto.createHash("md5").update(buf).digest("hex"),
        partialAlpha,
        opaqueWhiteHalo,
        navyInK,
        navyInKala,
    };
}

describe("Logo transparent crop & dark-mode adaptive hairline quality", () => {
    it("renders <picture> without any background box wrapper, preserving 929:316 cropped dimensions", () => {
        const { container } = render(<Logo />);
        expect(container.querySelector(".ekg-logo-frame")).toBeNull();

        const picture = container.querySelector("picture");
        expect(picture).not.toBeNull();

        const source = picture?.querySelector("source");
        expect(source).toHaveAttribute("media", "(prefers-color-scheme: dark)");
        expect(source).toHaveAttribute("srcSet", "/logo-text-dark.png");

        const img = screen.getByRole("img", { name: /ekgkala/i });
        expect(img).toHaveAttribute("src", "/logo-text.png");
        expect(img).toHaveAttribute("width", "929");
        expect(img).toHaveAttribute("height", "316");
    });

    it("ships tightly cropped 929x316 32-bit RGBA PNGs with zero opaque white crust and preserves dark-navy k & kala in dark mode", () => {
        const publicDir = path.resolve(__dirname, "../../../public");
        const light = readPngInfo(path.join(publicDir, "logo-text.png"));
        const dark = readPngInfo(path.join(publicDir, "logo-text-dark.png"));

        for (const info of [light, dark]) {
            expect(info.width).toBe(929);
            expect(info.height).toBe(316);
            expect(info.bitDepth).toBe(8);
            expect(info.colorType).toBe(6);
            expect(info.hasTrnsChunk).toBe(false);
            expect(info.partialAlpha).toBeGreaterThan(1000);
            expect(info.opaqueWhiteHalo).toBe(0);
            expect(info.navyInK).toBeGreaterThan(5000);
            expect(info.navyInKala).toBeGreaterThan(10000);
        }

        expect(light.md5).not.toBe(dark.md5);
    });

    it("keeps globals.css free of .ekg-logo-frame opaque box rules around the transparent header logo", () => {
        const globalsCss = fs.readFileSync(
            path.resolve(__dirname, "../../app/globals.css"),
            "utf8"
        );
        expect(globalsCss).not.toContain(".ekg-logo-frame");
    });
});
