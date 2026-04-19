/**
 * Resize and compress an image in the browser for profile avatars.
 * Returns a JPEG data URL suitable for storing in the user record.
 */
export async function compressImageFileToDataUrl(
	file: File,
	maxEdge = 384,
	quality = 0.82,
): Promise<string> {
	if (!file.type.startsWith("image/")) {
		throw new Error("Please choose an image file (JPEG, PNG, or WebP).");
	}
	if (file.size > 5 * 1024 * 1024) {
		throw new Error("Image must be 5MB or smaller.");
	}

	const bitmap = await createImageBitmap(file);
	try {
		const scale = Math.min(1, maxEdge / bitmap.width, maxEdge / bitmap.height);
		const w = Math.max(1, Math.round(bitmap.width * scale));
		const h = Math.max(1, Math.round(bitmap.height * scale));

		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Could not process image.");
		}
		ctx.drawImage(bitmap, 0, 0, w, h);
		const dataUrl = canvas.toDataURL("image/jpeg", quality);
		if (dataUrl.length > 450000) {
			throw new Error("Image is still too large after compression. Try a smaller photo.");
		}
		return dataUrl;
	} finally {
		bitmap.close();
	}
}
