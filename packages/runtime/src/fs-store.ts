import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createEmptyState, type JobflowState, stateSchema } from "./state-schema.js";

export type FsStore = {
  read(): Promise<JobflowState>;
  write(state: JobflowState): Promise<void>;
};

export function createFsStore(rootDir = ".jobflow"): FsStore {
  const statePath = join(rootDir, "state.json");

  return {
    async read() {
      try {
        const raw = await readFile(statePath, "utf8");
        return stateSchema.parse(JSON.parse(raw));
      } catch (error) {
        if (isNotFoundError(error)) {
          return createEmptyState();
        }
        throw error;
      }
    },
    async write(state) {
      await mkdir(rootDir, { recursive: true });
      await writeFile(statePath, `${JSON.stringify(stateSchema.parse(state), null, 2)}\n`, "utf8");
    }
  };
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "ENOENT"
  );
}
