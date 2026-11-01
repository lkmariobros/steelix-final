import { supabaseAdmin, isSupabaseConfigured } from "../utils/supabase";

/** Buckets required by transaction docs, portal files, and agent profiles. */
const REQUIRED_BUCKETS = [
	"transaction-documents",
	"profile-files",
	"portal-files",
] as const;

let ensurePromise: Promise<void> | null = null;

/** Clear cached ensure result so the next call re-checks Supabase. */
export function resetStorageBucketEnsure(): void {
	ensurePromise = null;
}

/**
 * Ensure Supabase Storage buckets exist (idempotent).
 * After Singapore cutover, empty projects return "The related resource does not exist"
 * until these buckets are created.
 */
export async function ensureStorageBuckets(): Promise<void> {
	if (!isSupabaseConfigured || !supabaseAdmin) return;
	if (!ensurePromise) {
		ensurePromise = (async () => {
			const { data: existing, error: listError } =
				await supabaseAdmin.storage.listBuckets();
			if (listError) {
				console.warn(
					"[storage] listBuckets failed:",
					listError.message,
				);
				return;
			}
			const have = new Set((existing ?? []).map((b) => b.name));
			for (const name of REQUIRED_BUCKETS) {
				if (have.has(name)) continue;
				const { error } = await supabaseAdmin.storage.createBucket(name, {
					public: false,
					fileSizeLimit: 52_428_800,
				});
				if (error && !/already exists/i.test(error.message)) {
					console.warn(`[storage] createBucket ${name}:`, error.message);
				} else {
					console.log(`✅ Storage bucket ready: ${name}`);
				}
			}
		})().catch((e) => {
			ensurePromise = null;
			console.warn(
				"[storage] ensureStorageBuckets failed:",
				e instanceof Error ? e.message : e,
			);
		});
	}
	await ensurePromise;
}
