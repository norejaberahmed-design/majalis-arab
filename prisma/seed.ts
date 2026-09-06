import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const email = "admin@majalis-arab.local";
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log("Admin user already exists");
    return;
  }

  const passwordHash = await bcrypt.hash("admin12345", 12);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: "مدير النظام",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log("Admin user created: admin@majalis-arab.local / admin12345");
  console.log("⚠️  DEMO DATA — change this password in production");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
