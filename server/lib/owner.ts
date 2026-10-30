import { fail, type ActionRunContext } from "@agent-native/core/action";

export function requireOwnerEmail(ctx?: ActionRunContext): string {
  const email = ctx?.userEmail?.trim();
  if (!email) {
    fail("Sign in to run accessibility audits.", {
      errorCode: "unauthorized",
      statusCode: 401,
    });
  }
  return email;
}
