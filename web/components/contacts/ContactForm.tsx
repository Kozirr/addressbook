"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { contactFormSchema, ContactFormInput } from "@/lib/validations";
import { contactToFormInput, tagsFromInput } from "@/lib/contact-utils";
import { Contact } from "@/types/contact";

interface ContactFormProps {
  contact?: Contact;
  onSubmit: (data: ContactFormInput) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ContactForm({
  contact,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ContactFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
  } = useForm<ContactFormInput>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: contactToFormInput(contact),
  });

  const isFavorite = useWatch({ control, name: "isFavorite" });
  const tagsValue = useWatch({ control, name: "tags" });

  const handleTagsChange = (value: string) => {
    setValue("tags", tagsFromInput(value));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">
        {contact ? "Edit contact" : "New contact"}
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" {...register("firstName")} />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" {...register("lastName")} />
          {errors.lastName && (
            <p className="text-sm text-destructive">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register("phone")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input id="company" {...register("company")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobTitle">Job title</Label>
          <Input id="jobTitle" {...register("jobTitle")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" {...register("address")} rows={2} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          value={tagsValue.join(", ")}
          onChange={(e) => handleTagsChange(e.target.value)}
          placeholder="friend, work, family"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" {...register("notes")} rows={4} />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isFavorite"
          checked={isFavorite}
          onCheckedChange={(checked) =>
            setValue("isFavorite", checked === true)
          }
        />
        <Label htmlFor="isFavorite" className="cursor-pointer">
          Mark as favorite
        </Label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : contact ? "Save changes" : "Create contact"}
        </Button>
      </div>
    </form>
  );
}
