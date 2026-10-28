export type PollResult = {
  taskStatus?: string;
  error?: string;
  dataUrl?: string;
  mime?: string;
  results?: unknown;
  units?: number;
  hint?: string;
};

export async function pollJson(
  url: string,
  options?: {
    fetchImpl?: (input: string) => Promise<{ json: () => Promise<PollResult> }>;
    sleep?: (ms: number) => Promise<void>;
    intervalMs?: number;
    capMs?: number;
    now?: () => number;
  },
): Promise<PollResult> {
  const fetchImpl = options?.fetchImpl ?? (async (input: string) => fetch(input));
  const sleep = options?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const interval = options?.intervalMs ?? 3000;
  const cap = options?.capMs ?? 120000;
  const now = options?.now ?? Date.now;
  const start = now();
  let last: PollResult = {};
  while (now() - start <= cap) {
    const res = await fetchImpl(url);
    last = await res.json();
    const status = last.taskStatus;
    if (status === "success" || status === "error" || last.error) return last;
    await sleep(interval);
  }
  return { ...last, taskStatus: "timeout" };
}
