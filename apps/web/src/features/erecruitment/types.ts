export type RecruitmentDocKey = "icFront" | "icBack" | "registrationFeeReceipt";

export type RecruitmentUploadedDoc = {
	fileName: string;
	fileType: string;
	url?: string;
	storagePath?: string;
	dataUrl?: string;
	uploadedAt: string;
};

export type RecruitmentFormState = {
	fullName: string;
	nickName: string;
	nric: string;
	email: string;
	registrationFee: string;
	paymentMethod: string;
	address: string;
	contactNo: string;
	maritalStatus: string;
	emergencyName: string;
	emergencyContactNo: string;
	emergencyRelationship: string;
	bankName: string;
	bankAccountNo: string;
	bankAccountName: string;
	incomeTaxNo: string;
};

export const EMPTY_RECRUITMENT_FORM: RecruitmentFormState = {
	fullName: "",
	nickName: "",
	nric: "",
	email: "",
	registrationFee: "",
	paymentMethod: "",
	address: "",
	contactNo: "",
	maritalStatus: "",
	emergencyName: "",
	emergencyContactNo: "",
	emergencyRelationship: "",
	bankName: "",
	bankAccountNo: "",
	bankAccountName: "",
	incomeTaxNo: "",
};
