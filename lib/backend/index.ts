import { demoBackend } from "./demo";
import { liveBackend } from "./live";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "../supabase-env";

export const IS_DEMO =
  process.env.NEXT_PUBLIC_DEMO === "1" || !SUPABASE_URL || !SUPABASE_PUBLIC_KEY;

export const backend = IS_DEMO ? demoBackend : liveBackend;
export { BackendError } from "./types";
export type { DirectoryEntry, DirectoryResult } from "./types";
