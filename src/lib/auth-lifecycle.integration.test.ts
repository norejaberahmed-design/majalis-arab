import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const BASE_URL = "http://localhost:3000";
const originalNodeEnv = process.env.NODE_ENV;

function cookieHeader(response: Response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") ?? ""];
  return values.map(value => value.split(";")[0]).filter(Boolean).join("; ");
}

async function loggedLink(spy: ReturnType<typeof vi.spyOn>, label: string) {
  // Better Auth may schedule password-reset email delivery after returning its
  // generic response; wait briefly for the development-only captured link.
  for (let attempt = 0; attempt < 20; attempt++) {
    const messages = spy.mock.calls.map(call => call.map(String).join(" ")).filter(message => message.includes(label));
    const last = messages.at(-1);
    const match = last?.match(/https?:\/\/[^\s]+/);
    if (match) return match[0].replace(/[),]+$/, "");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Development mail log did not contain a ${label} URL.`);
}

describe("authentication lifecycle against SQLite", () => {
  let auth: (typeof import("./auth"))["auth"];
  let createWorkspace: (typeof import("@/app/api/workspaces/route"))["POST"];
  let listWorkspaces: (typeof import("@/app/api/workspaces/route"))["GET"];
  let selectWorkspace: (typeof import("@/app/api/workspaces/active/route"))["POST"];

  beforeAll(async () => {
    process.env.NODE_ENV = "development";
    process.env.BETTER_AUTH_URL = BASE_URL;
    process.env.BETTER_AUTH_SECRET = "test-only-secret-value-long-enough-for-auth-lifecycle";
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.MAIL_FROM;
    auth = (await import("./auth")).auth;
    createWorkspace = (await import("@/app/api/workspaces/route")).POST;
    listWorkspaces = (await import("@/app/api/workspaces/route")).GET;
    selectWorkspace = (await import("@/app/api/workspaces/active/route")).POST;
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it("signs up, verifies email, signs in/out, resets password, and manages workspace membership", async () => {
    const email = `lifecycle-${process.pid}-${Date.now()}@example.test`;
    const oldPassword = "Old-test-password-123!";
    const newPassword = "New-test-password-456!";
    const mailLog = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const signUp = await auth.handler(new Request(`${BASE_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ name: "Lifecycle Test", email, password: oldPassword })
    }));
    expect(signUp.status).toBeLessThan(400);
    const verificationUrl = await loggedLink(mailLog, "Verification link");
    const verification = await auth.handler(new Request(verificationUrl, { headers: { origin: BASE_URL } }));
    expect(verification.status).toBeLessThan(400);

    const signIn = await auth.handler(new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email, password: oldPassword })
    }));
    expect(signIn.status).toBe(200);
    const sessionCookies = cookieHeader(signIn);
    expect(sessionCookies).toContain("better-auth");

    const sessionResponse = await auth.handler(new Request(`${BASE_URL}/api/auth/get-session`, {
      headers: { cookie: sessionCookies }
    }));
    expect((await sessionResponse.json()).user.email).toBe(email);

    const workspaceResponse = await createWorkspace(new NextRequest(`${BASE_URL}/api/workspaces`, {
      method: "POST",
      headers: { origin: BASE_URL, "content-type": "application/json", cookie: sessionCookies },
      body: JSON.stringify({ name: "Lifecycle test council" })
    }));
    expect(workspaceResponse.status).toBe(201);
    const createdWorkspace = (await workspaceResponse.json()).data;
    expect(createdWorkspace.role).toBe("OWNER");

    const selectResponse = await selectWorkspace(new NextRequest(`${BASE_URL}/api/workspaces/active`, {
      method: "POST",
      headers: { origin: BASE_URL, "content-type": "application/json", cookie: sessionCookies },
      body: JSON.stringify({ workspaceId: createdWorkspace.id })
    }));
    expect(selectResponse.status).toBe(200);
    expect(cookieHeader(selectResponse)).toContain("majalis_workspace");

    const workspacesResponse = await listWorkspaces(new NextRequest(`${BASE_URL}/api/workspaces`, {
      headers: { cookie: sessionCookies }
    }));
    expect(workspacesResponse.status).toBe(200);
    expect((await workspacesResponse.json()).data.some((workspace: { id: string }) => workspace.id === createdWorkspace.id)).toBe(true);

    const signOut = await auth.handler(new Request(`${BASE_URL}/api/auth/sign-out`, {
      method: "POST",
      headers: { origin: BASE_URL, cookie: sessionCookies }
    }));
    expect(signOut.status).toBeLessThan(400);
    const afterSignOut = await auth.handler(new Request(`${BASE_URL}/api/auth/get-session`, {
      headers: { cookie: sessionCookies }
    }));
    expect(await afterSignOut.json()).toBeNull();

    const preResetSignIn = await auth.handler(new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email, password: oldPassword })
    }));
    expect(preResetSignIn.status).toBe(200);
    const preResetCookies = cookieHeader(preResetSignIn);

    const resetRequest = await auth.handler(new Request(`${BASE_URL}/api/auth/request-password-reset`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email, redirectTo: "/reset-password" })
    }));
    expect(resetRequest.status).toBeLessThan(400);
    const resetUrl = await loggedLink(mailLog, "Password reset link");
    const resetToken = new URL(resetUrl).searchParams.get("token");
    expect(resetToken).toBeTruthy();

    const reset = await auth.handler(new Request(`${BASE_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ newPassword, token: resetToken })
    }));
    expect(reset.status).toBeLessThan(400);
    const revokedSession = await auth.handler(new Request(`${BASE_URL}/api/auth/get-session`, {
      headers: { cookie: preResetCookies }
    }));
    expect(await revokedSession.json()).toBeNull();

    const newSignIn = await auth.handler(new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email, password: newPassword })
    }));
    expect(newSignIn.status).toBe(200);
    const newCookies = cookieHeader(newSignIn);
    const finalSignOut = await auth.handler(new Request(`${BASE_URL}/api/auth/sign-out`, {
      method: "POST",
      headers: { origin: BASE_URL, cookie: newCookies }
    }));
    expect(finalSignOut.status).toBeLessThan(400);
    mailLog.mockRestore();
  }, 30000);
  it("enforces the persistent sign-in attempt limit", async () => {
    const ip = `198.51.100.${(process.pid % 200) + 1}`;
    let lastResponse: Response | undefined;
    for (let attempt = 0; attempt < 6; attempt++) {
      lastResponse = await auth.handler(new Request(`${BASE_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: BASE_URL,
          "x-forwarded-for": ip
        },
        body: JSON.stringify({
          email: `rate-limit-${process.pid}@example.test`,
          password: "incorrect-password-123!"
        })
      }));
      if (attempt < 5) expect(lastResponse.status).not.toBe(429);
    }
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("x-retry-after")).toBeTruthy();
  }, 30000);

});