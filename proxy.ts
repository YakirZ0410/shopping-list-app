import { type NextRequest } from "next/server";
import { updateSession } from "./lib/supabaseMiddleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run proxy on all routes except:
     * - static files
     * - images
     * - favicon
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
