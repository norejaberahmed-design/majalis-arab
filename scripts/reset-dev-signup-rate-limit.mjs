import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to alter authentication limits in production.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Add the local SQLite URL from .env.example to .env, then retry.");
  process.exit(1);
}
if (!process.env.DATABASE_URL.startsWith("file:")) {
  console.error("Refusing to alter rate limits unless DATABASE_URL points to a local SQLite file.");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const matching = await prisma.rateLimit.findMany({
    where: { key: { contains: "sign-up" } },
    select: { id: true }
  });

  if (matching.length === 0) {
    console.log("No sign-up rate-limit records matched. No data was changed.");
    console.log("The limiter key format may differ in this Better Auth version; inspect keys locally before changing anything.");
  } else {
    const result = await prisma.rateLimit.deleteMany({
      where: { key: { contains: "sign-up" } }
    });
    console.log(`Removed ${result.count} development sign-up rate-limit record(s). No users, sessions, or other rate limits were changed.`);
  }
} catch (error) {
  console.error("Could not inspect/reset the development sign-up rate limit:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
