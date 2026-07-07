/** Agent picker label: `Chiew Wei Loon (Steven Chiew DT00001)` */
export function formatAgentPickerLabel(input: {
	name?: string | null;
	nickName?: string | null;
	agentCode?: string | null;
	email?: string | null;
}): string {
	const name = input.name?.trim() || input.email?.trim() || "Agent";
	const parenParts = [input.nickName?.trim(), input.agentCode?.trim()]
		.filter(Boolean)
		.join(" ");

	if (parenParts) return `${name} (${parenParts})`;
	return name;
}
