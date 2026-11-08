import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import type { DisplayControlRequest } from "./display.types";

const coordinate = z
  .number()
  .finite()
  .min(-1_000_000)
  .max(1_000_000)
  .optional();
const identity = { id: z.string().max(128).optional() };
const controlSchema = z.discriminatedUnion("type", [
  z.object({
    ...identity,
    type: z.literal("action"),
    command: z.string().min(1).max(128),
  }),
  z.object({
    ...identity,
    type: z.literal("keyboard"),
    eventType: z.enum(["keydown", "keyup"]).optional(),
    key: z.string().max(256).optional(),
    code: z.string().max(128).optional(),
    repeat: z.boolean().optional(),
    altKey: z.boolean().optional(),
    ctrlKey: z.boolean().optional(),
    metaKey: z.boolean().optional(),
    shiftKey: z.boolean().optional(),
  }),
  z.object({
    ...identity,
    type: z.literal("touch"),
    action: z.enum(["tap", "swipe", "pointer"]).optional(),
    eventType: z.enum(["down", "move", "up", "cancel"]).optional(),
    x: coordinate,
    y: coordinate,
    x1: coordinate,
    y1: coordinate,
    x2: coordinate,
    y2: coordinate,
    videoWidth: z.number().int().positive().max(16_384).optional(),
    videoHeight: z.number().int().positive().max(16_384).optional(),
    durationMs: z.number().int().min(0).max(60_000).optional(),
  }),
  z.object({
    ...identity,
    type: z.literal("clipboard"),
    text: z
      .string()
      .max(64 * 1024)
      .optional(),
  }),
]);

export const validateDisplayControl = (
  input: unknown,
): DisplayControlRequest => {
  const parsed = controlSchema.safeParse(input);
  if (!parsed.success)
    throw new BadRequestException("Invalid viewer control message.");
  return parsed.data;
};
