import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

const secret = process.env.BETTER_AUTH_SECRET;
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const mailFrom = process.env.MAIL_FROM;
const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass && mailFrom && Number.isFinite(smtpPort));
if (process.env.NODE_ENV === "production" && !smtpConfigured) {
  throw new Error("SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM are required in production for account verification.");
}
const mailer = smtpConfigured ? nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: { user: smtpUser, pass: smtpPass }
}) : null;
const baseURL = (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\\/+$/, "");
const additionalTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim().replace(/\\/+$/, ""))
  .filter(Boolean);
const trustedOrigins = [...new Set([baseURL, ...additionalTrustedOrigins])];

for (const origin of trustedOrigins) {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(`Invalid origin in BETTER_AUTH_URL / BETTER_AUTH_TRUSTED_ORIGINS: ${origin}`);
  }
  if (parsed.origin !== origin || parsed.username || parsed.password) {
    throw new Error(`Trusted origins must be bare origins without paths or credentials: ${origin}`);
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("All trusted authentication origins must use HTTPS in production.");
  }
}
let productionBaseURLIsValid = false;
try { productionBaseURLIsValid = new URL(baseURL).protocol === "https:"; } catch { productionBaseURLIsValid = false; }
if (process.env.NODE_ENV === "production" && (!process.env.BETTER_AUTH_URL || !productionBaseURLIsValid)) {
  throw new Error("BETTER_AUTH_URL must be set to the canonical HTTPS application origin in production.");
}
if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
  throw new Error("BETTER_AUTH_SECRET must be set to a random value of at least 32 characters in production.");
}

export const auth = betterAuth({
  appName: "مجالس العرب",
  baseURL,
  trustedOrigins,
  secret,
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 3 },
      "/request-password-reset": { window: 3600, max: 3 },
      "/reset-password": { window: 60, max: 5 }
    }
  },
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, token }) => {
      const resetUrl = new URL("/reset-password", baseURL);
      resetUrl.searchParams.set("token", token);
      if (!mailer || !mailFrom) {
        if (process.env.NODE_ENV === "development") {
          console.info("[DEV ONLY] Password reset link for " + user.email + ": " + resetUrl.toString());
          return;
        }
        throw new Error("Password reset email delivery is not configured.");
      }
      await mailer.sendMail({
        from: mailFrom,
        to: user.email,
        subject: "إعادة تعيين كلمة المرور — مجالس العرب",
        text: "مرحبًا " + user.name + ",\n\nلإعادة تعيين كلمة المرور افتح الرابط التالي: " + resetUrl.toString() + "\n\nإذا لم تطلب إعادة التعيين فتجاهل هذه الرسالة."
      });
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      if (!mailer || !mailFrom) {
        if (process.env.NODE_ENV === "development") {
          console.info("[DEV ONLY] Verification link for " + user.email + ": " + url);
          return;
        }
        throw new Error("Email verification delivery is not configured.");
      }
      await mailer.sendMail({
        from: mailFrom,
        to: user.email,
        subject: "تحقق من بريدك الإلكتروني — مجالس العرب",
        text: "مرحبًا " + user.name + ",\n\nافتح الرابط التالي لتأكيد بريدك الإلكتروني: " + url + "\n\nينتهي الرابط خلال ساعة. إذا لم تطلب إنشاء الحساب فتجاهل الرسالة."
      });
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false }
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    }
  }
});
