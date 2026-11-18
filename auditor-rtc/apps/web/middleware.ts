import { NextResponse, type NextRequest } from "next/server";
import { lerSessaoDeToken, NOME_COOKIE } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const sessao = await lerSessaoDeToken(req.cookies.get(NOME_COOKIE)?.value);
  if (!sessao) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
