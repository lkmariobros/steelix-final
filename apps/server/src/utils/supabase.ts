import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceKey);

export function assertSupabaseConfigured(): void {
	if (!isSupabaseConfigured) {
		throw new Error(
			"Supabase storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to apps/server/.env, then restart the server.",
		);
	}
}

if (!isSupabaseConfigured) {
	console.warn(
		"⚠️  Supabase environment variables not found. Document upload features will be disabled.",
	);
	console.warn(
		"   Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable Supabase features.",
	);
}

export const supabaseAdmin =
	supabaseUrl && supabaseServiceKey
		? createClient(supabaseUrl, supabaseServiceKey, {
				auth: {
					autoRefreshToken: false,
					persistSession: false,
				},
				realtime: {
					transport: WebSocket as unknown as typeof globalThis.WebSocket,
				},
			})
		: null;
