import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import type { DisplayControlRequest } from "./display.types";

const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const videoDimension = z.number().int().positive().max(16_384);
const scrollAxis = z.number().finite().min(-16).max(16);
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
  z
    .object({
      ...identity,
      type: z.literal("touch"),
      action: z.enum(["tap", "swipe", "pointer"]).optional(),
      eventType: z.enum(["down", "move", "up", "cancel"]).optional(),
      pointerId: z.number().int().min(0).max(0x7fffffff).optional(),
      x: coordinate.optional(),
      y: coordinate.optional(),
      x1: coordinate.optional(),
      y1: coordinate.optional(),
      x2: coordinate.optional(),
      y2: coordinate.optional(),
      videoWidth: videoDimension.optional(),
      videoHeight: videoDimension.optional(),
      durationMs: z.number().int().min(0).max(60_000).optional(),
    })
    .refine(
      (touch) =>
        touch.pointerId === undefined ||
        (touch.action === "pointer" &&
          touch.eventType !== undefined &&
          touch.videoWidth !== undefined &&
          touch.videoHeight !== undefined &&
          touch.x !== undefined &&
          touch.x >= 0 &&
          touch.x < touch.videoWidth &&
          touch.y !== undefined &&
          touch.y >= 0 &&
          touch.y < touch.videoHeight),
    ),
  z.object({
    ...identity,
    type: z.literal("scroll"),
    x: coordinate,
    y: coordinate,
    videoWidth: videoDimension,
    videoHeight: videoDimension,
    horizontal: scrollAxis,
    vertical: scrollAxis,
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
