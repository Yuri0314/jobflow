import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(packageDir, "..");
const distDir = resolve(rootDir, "dist");

await mkdir(distDir, { recursive: true });

for (const file of ["manifest.json", "src/popup.html", "src/popup.css"]) {
  await copyFile(resolve(rootDir, file), resolve(distDir, file.replace("src/", "")));
}
