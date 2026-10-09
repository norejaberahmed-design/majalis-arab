import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceMigrations = path.join(root, "prisma", "migrations");
const temporaryRoot = mkdtempSync(path.join(tmpdir(), "majalis-upgrade-"));
const temporaryPrisma = path.join(temporaryRoot, "prisma");
const temporaryMigrations = path.join(temporaryPrisma, "migrations");
const databasePath = path.join(temporaryRoot, "upgrade.db");
const databaseUrl = `file:${databasePath}`;
const migrationDirectories = readdirSync(sourceMigrations, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();

if (migrationDirectories.length < 2) {
  throw new Error("Upgrade test requires an initial migration and at least one subsequent migration.");
}

function runPrismaDeploy() {
  execFileSync("npx", ["prisma", "migrate", "deploy", "--schema", path.join(temporaryPrisma, "schema.prisma")], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });
}

try {
  mkdirSync(temporaryMigrations, { recursive: true });
  cpSync(path.join(root, "prisma", "schema.prisma"), path.join(temporaryPrisma, "schema.prisma"));
  cpSync(path.join(sourceMigrations, "migration_lock.toml"), path.join(temporaryMigrations, "migration_lock.toml"));
  cpSync(path.join(sourceMigrations, migrationDirectories[0]), path.join(temporaryMigrations, migrationDirectories[0]), { recursive: true });

  console.log(`Applying baseline migration only: ${migrationDirectories[0]}`);
  runPrismaDeploy();

  process.env.DATABASE_URL = databaseUrl;
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  let sourceId;
  let workspaceId;
  try {
    const source = await prisma.source.create({ data: { title: "upgrade-path-sentinel" } });
    const workspace = await prisma.workspace.create({ data: { name: "Upgrade sentinel", slug: "upgrade-sentinel" } });
    sourceId = source.id;
    workspaceId = workspace.id;
  } finally {
    await prisma.$disconnect();
  }

  for (const migration of migrationDirectories.slice(1)) {
    cpSync(path.join(sourceMigrations, migration), path.join(temporaryMigrations, migration), { recursive: true });
  }

  console.log(`Applying ${migrationDirectories.length - 1} subsequent migration(s) over existing records`);
  runPrismaDeploy();

  const verificationClient = new PrismaClient();
  try {
    const [source, workspace] = await Promise.all([
      verificationClient.source.findUnique({ where: { id: sourceId } }),
      verificationClient.workspace.findUnique({ where: { id: workspaceId } })
    ]);
    if (source?.title !== "upgrade-path-sentinel" || workspace?.slug !== "upgrade-sentinel") {
      throw new Error("Upgrade migration did not preserve pre-existing source/workspace data.");
    }
    console.log("Migration upgrade passed; pre-existing source and workspace records were preserved.");
  } finally {
    await verificationClient.$disconnect();
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
