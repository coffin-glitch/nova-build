import { z } from "zod";

export const createOfferSchema = z.object({
  rr: z.string().min(1),
  amount: z.coerce.number().positive("Enter a positive dollar amount"),
  notes: z.string().max(500).optional().nullable(),
});
export type CreateOfferInput = z.infer<typeof createOfferSchema>;
