import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getSession(request?: Request) {
  const requestHeaders = request?.headers ?? (await headers());
  return auth.api.getSession({ headers: requestHeaders });
}

export async function getRequiredSession(request?: Request) {
  const session = await getSession(request);
  return session?.user ? session : null;
}
