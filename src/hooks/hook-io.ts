// I/O partagé des hooks Claude Code : lecture stdin, parse fail-safe, émission JSON stdout.

export interface HookInput {
  hook_event_name?: string;
  cwd?: string;
  session_id?: string;
  source?: string;
  prompt?: string;
  transcript_path?: string;  // SessionEnd : chemin du transcript de la session terminée
  reason?: string;           // SessionEnd : pourquoi la session se termine
}

export type HookEventName = "SessionStart" | "UserPromptSubmit";

export async function readHookInput(): Promise<HookInput | null> {
  try {
    const raw = await Bun.stdin.text();
    if (!raw.trim()) return null;
    return JSON.parse(raw) as HookInput;
  } catch {
    return null;
  }
}

export function emitEmpty(): void {
  process.stdout.write("{}");
}

export function emitContext(eventName: HookEventName, text: string): void {
  const payload = {
    hookSpecificOutput: { hookEventName: eventName, additionalContext: text },
    suppressOutput: true,
  };
  process.stdout.write(JSON.stringify(payload));
}

export function loopActive(): boolean {
  return process.env.ARCADE_LOOP_ACTIVE === "1";
}
