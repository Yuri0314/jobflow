import { type ResumeRecord, resumeRecordSchema, resumeSourceTypeSchema } from "@jobflow/schema";
import { Command } from "commander";
import { z } from "zod";
import { fail, ok, type JsonResponse, writeJson } from "../output.js";
import { createId } from "../runtime/ids.js";
import type { FsStore } from "../state/fs-store.js";

const resumeAddOptionsSchema = z.object({
  label: z.string().min(1),
  sourceType: resumeSourceTypeSchema.default("file"),
  filePath: z.string().min(1).optional(),
  targetRoles: z.string().optional(),
  summary: z.string().optional(),
  default: z.boolean().default(false)
});

type ResumeAddOptions = z.input<typeof resumeAddOptionsSchema>;

type ResumeSetDefaultOptions = {
  resumeId: string;
};

export async function runResumeAdd(
  store: FsStore,
  rawOptions: ResumeAddOptions
): Promise<JsonResponse<{ resume: ResumeRecord }>> {
  const parsedOptions = resumeAddOptionsSchema.safeParse(rawOptions);
  if (!parsedOptions.success) {
    return fail("resume.add", {
      code: "INVALID_INPUT",
      message: "invalid resume options",
      details: parsedOptions.error.flatten()
    });
  }

  const options = parsedOptions.data;
  const now = new Date().toISOString();
  const resume = resumeRecordSchema.parse({
    resume_id: createId("resume"),
    label: options.label,
    file_path: options.filePath,
    source_type: options.sourceType,
    is_default: options.default,
    target_roles: parseTargetRoles(options.targetRoles),
    summary: options.summary,
    updated_at: now
  });

  const state = await store.read();
  if (resume.is_default) {
    state.resumes = state.resumes.map((existing) => ({ ...existing, is_default: false }));
  }

  state.resumes.push(resume);
  await store.write(state);

  return ok("resume.add", { resume });
}

export async function runResumeList(
  store: FsStore
): Promise<JsonResponse<{ items: ResumeRecord[] }>> {
  const state = await store.read();
  return ok("resume.list", { items: state.resumes });
}

export async function runResumeSetDefault(
  store: FsStore,
  options: ResumeSetDefaultOptions
): Promise<JsonResponse<{ resume: ResumeRecord }>> {
  const state = await store.read();
  const target = state.resumes.find((resume) => resume.resume_id === options.resumeId);

  if (!target) {
    return fail("resume.set-default", {
      code: "NOT_FOUND",
      message: `resume not found: ${options.resumeId}`
    });
  }

  const now = new Date().toISOString();
  state.resumes = state.resumes.map((resume) => ({
    ...resume,
    is_default: resume.resume_id === options.resumeId,
    updated_at: resume.resume_id === options.resumeId ? now : resume.updated_at
  }));

  await store.write(state);
  return ok("resume.set-default", {
    resume: state.resumes.find((resume) => resume.resume_id === options.resumeId) ?? target
  });
}

export function registerResumeCommand(program: Command, store: FsStore): void {
  const resume = program.command("resume").description("manage resume references");

  resume
    .command("add")
    .description("add a resume reference")
    .requiredOption("--label <label>", "human-readable resume label")
    .option("--source-type <sourceType>", "file, text, generated", "file")
    .option("--file-path <filePath>", "resume file path")
    .option("--target-roles <targetRoles>", "comma-separated target roles")
    .option("--summary <summary>", "short resume summary")
    .option("--default", "set as default resume", false)
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runResumeAdd(store, options));
    });

  resume
    .command("list")
    .description("list resume references")
    .option("--json", "emit JSON output", true)
    .action(async () => {
      writeJson(await runResumeList(store));
    });

  resume
    .command("set-default")
    .description("set the default resume")
    .requiredOption("--resume-id <resumeId>", "resume ID")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runResumeSetDefault(store, options));
    });
}

function parseTargetRoles(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((role) => role.trim())
    .filter((role) => role.length > 0);
}
