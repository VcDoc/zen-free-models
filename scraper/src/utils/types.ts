import { z } from "zod";

/** Zod schema for output validation */
export const OutputSchema = z.object({
  updatedAt: z.string().datetime({ offset: true }),
  source: z.string().url(),
  modelIds: z.array(z.string().min(1)),
  raw: z
    .object({
      totalModelsFound: z.number().int().positive(),
      scrapeTimestamp: z.number().int().positive(),
      allModels: z
        .array(
          z.object({
            modelId: z.string().min(1),
            isFree: z.boolean(),
          })
        )
        .optional(),
    })
    .optional(),
});

/** Output type for zen-free-models.json */
export type Output = z.infer<typeof OutputSchema>;
