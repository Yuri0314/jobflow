export type JsonError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type JsonResponse<T> =
  | {
      ok: true;
      command: string;
      data: T;
      warnings: string[];
      error: null;
    }
  | {
      ok: false;
      command: string;
      data: null;
      warnings: string[];
      error: JsonError;
    };

export function ok<T>(command: string, data: T, warnings: string[] = []): JsonResponse<T> {
  return { ok: true, command, data, warnings, error: null };
}

export function fail(
  command: string,
  error: JsonError,
  warnings: string[] = []
): JsonResponse<never> {
  return { ok: false, command, data: null, warnings, error };
}

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
