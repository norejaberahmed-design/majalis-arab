import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const BASE_URL = "http://localhost:3000";
const email = `dev-signin-${crypto.randomUUID()}@example.test`;
const password = "Dev-only-password-123!";

describe("development sign-up and sign-in without email verification", () => {
  let auth: (typeof import("./auth"))["auth"];
  let prisma: (typeof import("./prisma"))["prisma"];
  let originalNodeEnv: string | undefined;

  beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    process.env.BETTER_AUTH_URL = BASE_URL;
    process.env.BETTER_AUTH_SECRET = "test-only-secret-value-long-enough-for-auth-lifecycle";
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.MAIL_FROM;
    ({ auth } = await import("./auth"));
    ({ prisma } = await import("./prisma"));
  });

  afterAll(async () => {
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (user) await prisma.user.deleteMany({ where: { id: user.id } });
    }
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it("allows a newly registered development user to sign in before opening the verification link", async () => {
    const mailLog = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const signUp = await auth.handler(new Request(`${BASE_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ name: "Development Sign In", email, password })
    }));
    expect(signUp.status).toBeLessThan(400);

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
    mailLog.mockRestore();
  });
});
