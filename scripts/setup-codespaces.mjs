import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const envPath = ".env";

if (existsSync(envPath)) {
  console.log("Keeping the existing .env file unchanged.");
} else {
  const codespaceName = process.env.CODESPACE_NAME;
  const baseUrl = codespaceName
    ? `https://${codespaceName}-3000.app.github.dev`
    : "http://localhost:3000";

  const values = [
    'DATABASE_URL="file:./dev.db"',
    `BETTER_AUTH_SECRET="${randomBytes(32).toString("base64url")}"`,
    `BETTER_AUTH_URL="${baseUrl}"`,
    'CATALOGUE_CURATOR_EMAILS=""',
    'OPENAI_API_KEY=""',
    'OPENAI_MODEL="gpt-4.1-mini"'
  ];

  writeFileSync(envPath, `${values.join("\n")}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx"
  });
  console.log("Created a private development .env file. No source or tribal data was imported.");
}
