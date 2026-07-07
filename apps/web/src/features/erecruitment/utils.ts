export async function readFileAsBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsDataURL(file);
	});
}

export function normalizeMalaysianPhone(value: string): string | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;

	const digits = trimmed.replace(/\D/g, "");
	if (!digits) return undefined;

	if (trimmed.startsWith("+60")) {
		return `+${digits}`;
	}
	if (digits.startsWith("60")) {
		return `+${digits}`;
	}
	if (digits.startsWith("0")) {
		return `+60${digits.slice(1)}`;
	}
	return `+60${digits}`;
}
