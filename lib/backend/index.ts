import { demoBackend } from "./demo";
import { liveBackend } from "./live";

export const IS_DEMO =
  process.env.NEXT_PUBLIC_DEMO === "1" || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const backend = IS_DEMO ? demoBackend : liveBackend;
export { BackendError } from "./types";
export type { DirectoryEntry, DirectoryResult } from "./types";
