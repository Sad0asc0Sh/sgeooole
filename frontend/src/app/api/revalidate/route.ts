import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

const SECRET = process.env.REVALIDATE_SECRET;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { secret?: string; path?: string; tag?: string } | null;

    if (!body || body.secret !== SECRET) {
      return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
    }

    if (!body.path && !body.tag) {
      return NextResponse.json({ message: "path or tag is required" }, { status: 400 });
    }

    if (body.path) {
      revalidatePath(body.path, 'page');
      return NextResponse.json({ revalidated: true, path: body.path });
    }

    if (body.tag) {
      revalidateTag(body.tag, 'max');
      return NextResponse.json({ revalidated: true, tag: body.tag });
    }

    return NextResponse.json({ message: "Nothing to revalidate" }, { status: 400 });
  } catch (error: any) {
    console.error("[revalidate] Error", error);
    return NextResponse.json({ message: "Error revalidating", error: error?.message }, { status: 500 });
  }
}
