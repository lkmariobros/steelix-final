"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RiFeedbackLine, RiLoader4Line } from "@remixicon/react";

const feedbackSchema = z.object({
	subject: z.string().min(1, "Subject is required"),
	message: z.string().min(1, "Message is required"),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

export function FeedbackButton() {
	const [open, setOpen] = useState(false);

	const form = useForm<FeedbackFormValues>({
		resolver: zodResolver(feedbackSchema),
		defaultValues: {
			subject: "",
			message: "",
		},
	});

	const sendMutation = trpc.feedback.send.useMutation({
		onSuccess: () => {
			toast.success("Feedback sent successfully");
			form.reset();
			setOpen(false);
		},
		onError: (error) => {
			toast.error(error.message ?? "Failed to send feedback");
		},
	});

	function onSubmit(values: FeedbackFormValues) {
		sendMutation.mutate(values);
	}

	return (
		<>
			<Button
				variant="ghost"
				size="sm"
				className="gap-2 text-muted-foreground hover:text-foreground"
				onClick={() => setOpen(true)}
				aria-label="Send feedback"
			>
				<RiFeedbackLine className="size-4" />
				<span className="hidden sm:inline">Feedback</span>
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<RiFeedbackLine className="size-5" />
							Send Feedback
						</DialogTitle>
						<DialogDescription>
							Your feedback will be sent to the team via Telegram.
						</DialogDescription>
					</DialogHeader>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="subject"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Subject</FormLabel>
										<FormControl>
											<Input
												placeholder="Brief summary of your feedback"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="message"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Message</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Describe your feedback, suggestion, or issue..."
												className="min-h-[120px] resize-none"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => setOpen(false)}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={sendMutation.isPending}
								>
									{sendMutation.isPending && (
										<RiLoader4Line className="mr-2 size-4 animate-spin" />
									)}
									Send
								</Button>
							</DialogFooter>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		</>
	);
}
