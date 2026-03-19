import type { Hono } from "hono";

const port = process.env.PORT || 8080;

const isProduction =
	process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;

/**
 * Starts the HTTP server using Bun (dev) or Node.js (production).
 * Call this once at the end of index.ts.
 */
export function startServer(app: Hono) {
	const isBun = typeof globalThis.Bun !== "undefined";

	if (isBun) {
		startBunServer(app);
	} else {
		startNodeServer(app);
	}
}

// ─── Bun (development) ───────────────────────────────────────────────────────

function startBunServer(app: Hono) {
	const globalServer = globalThis as unknown as {
		server?: ReturnType<typeof Bun.serve>;
		serverStopping?: boolean;
	};

	// Stop existing server on hot reload
	if (globalServer.server && !globalServer.serverStopping) {
		try {
			globalServer.serverStopping = true;
			globalServer.server.stop(true);
			globalServer.server = undefined;
		} catch {
			// ignore
		} finally {
			globalServer.serverStopping = false;
		}
	}

	let retries = 0;
	const MAX_RETRIES = 15;

	const tryStart = async () => {
		if (globalServer.serverStopping) {
			setTimeout(tryStart, 300);
			return;
		}

		// Wait until port is free
		if (retries > 0) {
			const available = await isPortFree(Number(port));
			if (!available && retries < MAX_RETRIES) {
				retries++;
				console.warn(
					`⚠️ Port ${port} busy, retrying (${retries}/${MAX_RETRIES})...`,
				);
				setTimeout(tryStart, 500);
				return;
			}
		}

		try {
			const server = Bun.serve({
				fetch: app.fetch,
				port: Number(port),
				hostname: "127.0.0.1",
				idleTimeout: 60,
			});

			globalServer.server = server;
			retries = 0;

			console.log(`✅ Dev server running at http://localhost:${port}`);
			console.log("🔥 Hot reload enabled");

			process.on("SIGTERM", () => shutdown(() => server.stop()));
			process.on("SIGINT", () => shutdown(() => server.stop()));
		} catch (error: unknown) {
			const e = error as { code?: string; message?: string };
			const isPortBusy =
				e?.code === "EADDRINUSE" ||
				e?.message?.includes("port") ||
				e?.message?.includes("in use");

			if (isPortBusy && retries < MAX_RETRIES) {
				retries++;
				setTimeout(tryStart, 500);
			} else {
				console.error("❌ Failed to start server:", error);
				if (retries >= MAX_RETRIES) {
					console.error(`💡 Kill port: netstat -ano | findstr :${port}`);
				}
				process.exit(1);
			}
		}
	};

	tryStart();
}

async function isPortFree(port: number): Promise<boolean> {
	try {
		const s = Bun.serve({
			fetch: () => new Response(""),
			port,
			hostname: "127.0.0.1",
		});
		s.stop();
		return true;
	} catch {
		return false;
	}
}

// ─── Node.js (production) ────────────────────────────────────────────────────

function startNodeServer(app: Hono) {
	import("@hono/node-server").then(({ serve }) => {
		try {
			const hostname = isProduction ? "0.0.0.0" : "localhost";
			const server = serve({ fetch: app.fetch, port: Number(port), hostname });

			console.log(`✅ Server running at ${hostname}:${port}`);
			if (isProduction) {
				console.log("🌐 https://steelix-final-production.up.railway.app");
			}

			process.on("SIGTERM", () => shutdown(() => server.close()));
			process.on("SIGINT", () => shutdown(() => server.close()));
		} catch (error) {
			console.error("❌ Failed to start server:", error);
			process.exit(1);
		}
	});
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function shutdown(stop: () => void) {
	console.log("🛑 Shutting down gracefully…");
	stop();
	process.exit(0);
}
