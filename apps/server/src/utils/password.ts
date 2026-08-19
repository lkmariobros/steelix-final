import { scryptAsync } from "@noble/hashes/scrypt";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

/** Scrypt parameters used by existing password hashes in `account.password`. */
const SCRYPT = {
	N: 16384,
	r: 16,
	p: 1,
	dkLen: 64,
};

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let c = 0;
	for (let i = 0; i < a.length; i++) c |= a[i] ^ b[i];
	return c === 0;
}

async function deriveKey(password: string, salt: string): Promise<Uint8Array> {
	return scryptAsync(password.normalize("NFKC"), salt, {
		N: SCRYPT.N,
		p: SCRYPT.p,
		r: SCRYPT.r,
		dkLen: SCRYPT.dkLen,
		maxmem: 128 * SCRYPT.N * SCRYPT.r * 2,
	});
}

export async function hashPassword(password: string): Promise<string> {
	const saltBytes = new Uint8Array(16);
	crypto.getRandomValues(saltBytes);
	const salt = bytesToHex(saltBytes);
	const key = await deriveKey(password, salt);
	return `${salt}:${bytesToHex(key)}`;
}

export async function verifyPassword({
	hash,
	password,
}: {
	hash: string;
	password: string;
}): Promise<boolean> {
	const [salt, keyHex] = hash.split(":");
	if (!salt || !keyHex) return false;
	const targetKey = await deriveKey(password, salt);
	return constantTimeEqual(targetKey, hexToBytes(keyHex));
}
