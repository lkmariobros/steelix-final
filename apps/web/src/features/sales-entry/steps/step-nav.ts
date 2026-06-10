/** Shared navigation options for wizard sub-sections. */
export type StepNavigationOptions = {
	hideNavigation?: boolean;
	hidePrevious?: boolean;
	nextLabel?: string;
	previousLabel?: string;
	/** Return false to block advancing (e.g. incomplete section above). */
	beforeNext?: () => boolean;
};
