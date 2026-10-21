#!/usr/bin/env node
import { createInterface } from "node:readline";
import { mkdir, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

const outDir = join(homedir(), ".config", "opencode", "opencode-quota");
const argSuffix = process.argv[2]?.trim();

console.log("");
console.log("== OpenCode Go — setup ==");
console.log("");
console.log("Necesitas una API key personal de OpenCode Go:");
console.log("  1. Abre https://opencode.ai/console");
console.log("  2. Ve a 'Personal API keys' y crea una key");
console.log("  3. Permisos: 'All' (es la unica forma de leer cuotas, gasto y balance)");
console.log("     No uses una service account: no puede gestionar billing.");
console.log("  4. Copia el valor (empieza con oc_sk_...)");
console.log("");
console.log("La key se guarda solo en tu equipo, con permisos 600.");
console.log("");

const suffixInput = argSuffix ?? (await ask("Nombre de cuenta (opcional, ej. work): ")).trim();
const suffix = suffixInput
  .replace(/[^A-Za-z0-9._-]+/g, "-")
  .replace(/^-+|-+$/g, "");
if (suffix === "active" || suffix.endsWith("-key")) {
  console.error("Ese nombre esta reservado por el switch de cuentas. Usa otro.");
  process.exit(1);
}

const apiKey = (await ask("Pega la API key (oc_sk_...): ")).trim();
rl.close();

if (!apiKey) {
  console.error("La API key es obligatoria. Abortando.");
  process.exit(1);
}
if (!apiKey.startsWith("oc_sk_")) {
  console.warn("Aviso: la key no empieza por 'oc_sk_'. Se guarda igualmente.");
}

const outFile = join(outDir, suffix ? `opencode-go-${suffix}.json` : "opencode-go.json");

await mkdir(outDir, { recursive: true });
await writeFile(outFile, JSON.stringify({ apiKey }, null, 2) + "\n", { mode: 0o600 });
await chmod(outFile, 0o600);

console.log(`\nConfiguracion guardada en: ${outFile}`);
console.log("Reinicia OpenCode y el panel 'Quota cards' aparecera.");
