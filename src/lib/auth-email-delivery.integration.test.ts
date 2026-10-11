import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const mailerMocks = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mailerMocks.sendMail }))
  }
}));

const BASE_URL = "https://majalis-ci.example.invalid";
const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  MAIL_FROM: process.env.MAIL_FROM
};

describe("authentication email delivery failures", () => {
  let auth: (typeof import("./auth"))["auth"];
  let userId: string | undefined;

  beforeAll(async () => {
    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_URL = BASE_URL;
    process.env.BETTER_AUTH_SECRET = "test-only-secret-value-long-enough-for-auth-lifecycle";
    process.env.SMTP_HOST = "smtp.example.invalid";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "ci-user";
    process.env.SMTP_PASS = "ci-password-not-used";
    process.env.MAIL_FROM = "Majalis CI <ci@example.invalid>";
    // Deterministic failure: the test must never contact a real SMTP service.
    mailerMocks.sendMail.mockRejectedValue(new Error("SMTP unavailable"));
    auth = (await import("./auth")).auth;
  });

  afterAll(async () => {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("does not report verification email delivery as successful when SMTP fails", async () => {
    const email = \`smtp-failure-\${process.pid}-\${Date.now()}@example.test\`;
    const user = await prisma.user.create({
      data: { name: "SMTP failure test", email, emailVerified: false },
      select: { id: true }
    });
    userId = user.id;

    const response = await auth.handler(new Request(\`\${BASE_URL}/api/auth/send-verification-email\`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email, callbackURL: "/" })
    }));

    expect(mailerMocks.sendMail).toHaveBeenCalledTimes(1);
    expect(response.status).toBeGreaterThanOrEqual(400);
  }, 10000);
});
