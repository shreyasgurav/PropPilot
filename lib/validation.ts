import { z } from "zod";
import { LeadSource, LeadStatus } from "@prisma/client";

export const createPropertySchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  location: z.string().min(1, "Location is required").max(200),
  price: z.string().min(1, "Price is required").max(50),
  bedrooms: z.coerce.number().int().min(0).max(50).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  externalRef: z.string().max(120).optional().nullable(),
});

export const updatePropertySchema = createPropertySchema.partial();

export const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  phone: z.string().min(8, "Phone is required").max(20),
  budget: z.string().max(60).optional().nullable(),
  source: z.nativeEnum(LeadSource).default(LeadSource.MANUAL),
  propertyId: z.string().cuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateLeadSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  notes: z.string().max(2000).optional().nullable(),
  budget: z.string().max(60).optional().nullable(),
  propertyId: z.string().cuid().optional().nullable(),
});

export const sendManualMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(2000),
});

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(8, "Phone is required").max(20),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type CreateLeadFormInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
