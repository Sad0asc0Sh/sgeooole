import crypto from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

const SECRET = process.env.REVALIDATE_SECRET;

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    if (!SECRET || SECRET.length < 16) {
      return NextResponse.json({ message: "Revalidation is disabled" }, { status: 503 });
    }

    const body = (await request.json().catch(() => null)) as { secret?: string; path?: string; tag?: string } | null;

    if (!body || typeof body.secret !== "string" || !secretsMatch(body.secret, SECRET)) {
      return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
    }

    if (!body.path && !body.tag) {
      return NextResponse.json({ message: "path or tag is required" }, { status: 400 });
    }

    if (body.path !== undefined) {
      if (typeof body.path !== "string" || !/^\/[^\s"'<>]{0,500}$/.test(body.path)) {
        return NextResponse.json({ message: "Invalid path" }, { status: 400 });
      }
      revalidatePath(body.path, "page");
      return NextResponse.json({ revalidated: true, path: body.path });
    }

    if (body.tag !== undefined) {
      if (typeof body.tag !== "string" || !/^[A-Za-z0-9:_-]{1,128}$/.test(body.tag)) {
        return NextResponse.json({ message: "Invalid tag" }, { status: 400 });
      }
      revalidateTag(body.tag, "max");
      return NextResponse.json({ revalidated: true, tag: body.tag });
    }

    return NextResponse.json({ message: "Nothing to revalidate" }, { status: 400 });
  } catch (error: any) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[revalidate] Error", error);
      return NextResponse.json({ message: "Error revalidating", error: error?.message }, { status: 500 });
    }

    console.error("[revalidate] Error");
    return NextResponse.json({ message: "Error revalidating" }, { status: 500 });
  }
}
