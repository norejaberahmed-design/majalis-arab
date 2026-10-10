import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const BASE_URL = "http://localhost:3000";
const email = `dev-signin-${crypto.randomUUID()}@example.test`;
const password = "Dev-only-password-123!";
const envKeys = [
  "NODE_ENV",
  "DATABASE_URL",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "MAIL_FROM"
] as const;

describe("development sign-up and sign-in without email verification", () => {
  let auth: (typeof import("./auth"))["auth"];
  let prisma: (typeof import("./prisma"))["prisma"];
  let originalEnv: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};
  let mailLog: ReturnType<typeof vi.spyOn> | undefined;

  beforeAll(async () => {
    originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    process.env.DATABASE_URL ??= "file:./dev.db";
    process.env.NODE_ENV = "development";
    process.env.BETTER_AUTH_URL = BASE_URL;
    process.env.BETTER_AUTH_SECRET = "test-only-secret-value-long-enough-for-auth-lifecycle";
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.MAIL_FROM;
    ({ auth } = await import("./auth"));
    ({ prisma } = await import("./prisma"));
  });

  afterAll(async () => {
    mailLog?.mockRestore();
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (user) await prisma.user.deleteMany({ where: { id: user.id } });
    }
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("rejects an incorrect password and allows a newly registered development user to sign in before email verification", async () => {
    mailLog = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const signUp = await auth.handler(new Request(`${BASE_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ name: "Development Sign In", email, password })
    }));
    expect(signUp.status).toBeLessThan(400);

    const badSignIn = await auth.handler(new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email, password: "Definitely-wrong-password-123!" })
    }));
    expect(badSignIn.status).toBeGreaterThanOrEqual(400);
    const badCookies = typeof badSignIn.headers.getSetCookie === "function"
      ? badSignIn.headers.getSetCookie()
      : [badSignIn.headers.get("set-cookie") ?? ""];
    expect(badCookies.join("; ")).not.toContain("better-auth");

    const signIn = await auth.handler(new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email, password })
    }));
    expect(signIn.status).toBe(200);
    const cookies = typeof signIn.headers.getSetCookie === "function"
      ? signIn.headers.getSetCookie()
      : [signIn.headers.get("set-cookie") ?? ""];
    expect(cookies.join("; ")).toContain("better-auth");

    mailLog?.mockRestore();
    mailLog = undefined;
  });
});
