"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, File, FileText, Upload, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { type DocumentsData, documentsSchema } from "../transaction-schema";

interface StepDocumentsProps {
	data?: DocumentsData;
	onUpdate: (data: DocumentsData) => void;
	onNext: () => void;
	onPrevious: () => void;
}

interface DocumentFile {
	id: string;
	name: string;
	type: string;
	url: string;
	uploadedAt: string;
}

export function StepDocuments({
	data,
	onUpdate,
	onNext,
	onPrevious,
}: StepDocumentsProps) {
	const [uploadedFiles, setUploadedFiles] = useState<DocumentFile[]>(
		data?.documents || [],
	);
	const [isUploading, setIsUploading] = useState(false);

	const form = useForm<DocumentsData>({
		resolver: zodResolver(documentsSchema),
		defaultValues: {
			documents: data?.documents || [],
			notes: data?.notes || "",
		},
	});

	const handleSubmit = (formData: DocumentsData) => {
		const updatedData = {
			...formData,
			documents: uploadedFiles,
		};
		onUpdate(updatedData);
		onNext();
	};

	// Auto-save on form changes
	const handleFormChange = () => {
		const values = form.getValues();
		const updatedData = {
			...values,
			documents: uploadedFiles,
		};
		onUpdate(updatedData);
	};

	// Handle file upload (mock implementation)
	const handleFileUpload = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const files = event.target.files;
		if (!files) return;

		setIsUploading(true);

		try {
			// Mock file upload - in a real app, you'd upload to your storage service
			const newFiles: DocumentFile[] = [];

			for (const file of Array.from(files)) {
				// Simulate upload delay
				await new Promise((resolve) => setTimeout(resolve, 500));

				const mockFile: DocumentFile = {
					id: Math.random().toString(36).substring(2, 11),
					name: file.name,
					type: file.type,
					url: `mock://uploaded/${file.name}`, // In real app, this would be the actual URL
					uploadedAt: new Date().toISOString(),
				};

				newFiles.push(mockFile);
			}

			setUploadedFiles((prev) => [...prev, ...newFiles]);
			form.setValue("documents", [...uploadedFiles, ...newFiles]);
			handleFormChange();

			toast.success(`${newFiles.length} file(s) uploaded successfully`);
		} catch (error) {
			toast.error("Failed to upload files");
			console.error("Upload error:", error);
		} finally {
			setIsUploading(false);
			// Reset the input
			event.target.value = "";
		}
	};

	// Remove uploaded file
	const removeFile = (fileId: string) => {
		const updatedFiles = uploadedFiles.filter((file) => file.id !== fileId);
		setUploadedFiles(updatedFiles);
		form.setValue("documents", updatedFiles);
		handleFormChange();
		toast.success("File removed");
	};

	// Get file type icon
	const getFileIcon = (fileType: string) => {
		if (fileType.includes("pdf")) return <FileText className="h-4 w-4" />;
		if (fileType.includes("image")) return <File className="h-4 w-4" />;
		return <File className="h-4 w-4" />;
	};

	// Format file size (mock)
	const formatFileSize = () => {
		// Mock file size - in real app, you'd get this from the actual file
		return `${Math.floor(Math.random() * 500 + 100)} KB`;
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Documents & Notes</CardTitle>
					<CardDescription>
						Upload relevant documents and add any additional notes for this
						transaction
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(handleSubmit)}
							className="space-y-6"
						>
							{/* File Upload Section */}
							<div className="space-y-4">
								<h3 className="font-medium text-lg">Document Upload</h3>

								{/* Upload Area */}
								<div className="rounded-lg border-2 border-muted-foreground/25 border-dashed p-6">
									<div className="text-center">
										<Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
										<div className="space-y-2">
											<p className="font-medium text-sm">
												Upload Transaction Documents
											</p>
											<p className="text-muted-foreground text-xs">
												Drag and drop files here, or click to browse
											</p>
											<p className="text-muted-foreground text-xs">
												Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB
												each)
											</p>
										</div>
										<div className="mt-4">
											<Button
												type="button"
												variant="outline"
												disabled={isUploading}
												className="relative"
											>
												<input
													type="file"
													multiple
													accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
													onChange={handleFileUpload}
													className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
													disabled={isUploading}
												/>
												{isUploading ? "Uploading..." : "Choose Files"}
											</Button>
										</div>
									</div>
								</div>

								{/* Uploaded Files List */}
								{uploadedFiles.length > 0 && (
									<div className="space-y-2">
										<h4 className="font-medium">
											Uploaded Documents ({uploadedFiles.length})
										</h4>
										<div className="space-y-2">
											{uploadedFiles.map((file) => (
												<div
													key={file.id}
													className="flex items-center justify-between rounded-lg border bg-muted/50 p-3"
												>
													<div className="flex items-center gap-3">
														{getFileIcon(file.type)}
														<div>
															<p className="font-medium text-sm">{file.name}</p>
															<p className="text-muted-foreground text-xs">
																{formatFileSize()} • Uploaded{" "}
																{new Date(file.uploadedAt).toLocaleDateString()}
															</p>
														</div>
													</div>
													<div className="flex items-center gap-2">
														<Badge variant="secondary" className="text-xs">
															{file.type.split("/")[1]?.toUpperCase() || "FILE"}
														</Badge>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => removeFile(file.id)}
															className="h-8 w-8 p-0 text-destructive hover:text-destructive"
														>
															<X className="h-4 w-4" />
														</Button>
													</div>
												</div>
											))}
										</div>
									</div>
								)}
							</div>

							<Separator />

							{/* Additional Notes */}
							<FormField
								control={form.control}
								name="notes"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Additional Notes</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Enter any additional notes about this transaction..."
												className="min-h-[120px]"
												{...field}
												onChange={(e) => {
													field.onChange(e);
													handleFormChange();
												}}
											/>
										</FormControl>
										<FormDescription>
											Optional: Add any relevant information, special
											conditions, or notes about this transaction
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Document Summary */}
							{(uploadedFiles.length > 0 || form.watch("notes")) && (
								<Card className="bg-muted/50">
									<CardHeader>
										<CardTitle className="text-lg">
											Documentation Summary
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2">
										<div className="flex justify-between">
											<span className="text-muted-foreground">Documents:</span>
											<span className="font-medium">
												{uploadedFiles.length} file
												{uploadedFiles.length !== 1 ? "s" : ""} uploaded
											</span>
										</div>
										{form.watch("notes") && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Notes:</span>
												<span className="font-medium">Added</span>
											</div>
										)}
									</CardContent>
								</Card>
							)}

							{/* Navigation */}
							<div className="flex justify-between">
								<Button
									type="button"
									variant="outline"
									onClick={onPrevious}
									className="flex items-center gap-2"
								>
									<ArrowLeft className="h-4 w-4" />
									Back to Commission
								</Button>
								<Button
									type="submit"
									className="flex items-center gap-2"
									disabled={isUploading}
								>
									Continue to Review
									<ArrowRight className="h-4 w-4" />
								</Button>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}
