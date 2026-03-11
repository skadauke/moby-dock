import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-auth";

export async function GET() {
  const authResult = await checkApiAuth();
  if (!authResult.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.MOBY_FILE_SERVER_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "File server token not configured" },
      { status: 500 }
    );
  }

  return NextResponse.json({ token });
}
