import { z } from "zod";

export const nameSchema = z.string().trim().min(1, "Enter your name").max(60, "Use 60 characters or fewer");
export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(200);
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(200, "Use 200 characters or fewer");

export const signupSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(200) });

export const profileSchema = z.object({
  name: nameSchema.optional(),
  avatarUrl: z.string().url().max(1000).nullable().optional(),
});

export const spaceCreateSchema = z.object({
  name: z.string().trim().min(1, "Give the space a name").max(60, "Use 60 characters or fewer"),
  description: z.string().trim().max(280, "Use 280 characters or fewer").optional().default(""),
});

export const spaceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(280).optional(),
  replyMode: z.enum(["mention", "auto"]).optional(),
  requireApproval: z.boolean().optional(),
});

export const handleSchema = z
  .string()
  .trim()
  .min(2, "Handles need at least 2 characters")
  .max(24, "Use 24 characters or fewer")
  .regex(/^[A-Za-z][A-Za-z0-9]*$/, "Use letters and digits only, starting with a letter");

export const agentToolSchema = z.enum(["search", "tasks", "polls", "summarize"]);

export const agentCreateSchema = z.object({
  name: z.string().trim().min(1, "Name your agent").max(40, "Use 40 characters or fewer"),
  handle: handleSchema,
  tagline: z.string().trim().max(120, "Use 120 characters or fewer").optional().default(""),
  instructions: z
    .string()
    .trim()
    .min(10, "Describe how the agent should behave (at least 10 characters)")
    .max(4000, "Keep instructions under 4,000 characters"),
  tools: z.array(agentToolSchema).max(4).default([]),
  avatarUrl: z.string().url().max(1000).nullable().optional(),
});
export const agentUpdateSchema = agentCreateSchema.partial();

export const nexconnMessageIdSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9-]+$/);

export const chatMessageSchema = z.object({
  messageId: nexconnMessageIdSchema,
  text: z.string().max(5000),
  mentionedIds: z.array(z.string().max(80)).max(50).default([]),
  sentTime: z.number().int().positive().optional(),
});

export const catchupSchema = z.object({ since: z.string().datetime().optional() });

export const translateSchema = z.object({
  messageId: nexconnMessageIdSchema,
  language: z.string().trim().min(2).max(40),
});

export const memoryCreateSchema = z.object({
  kind: z.enum(["fact", "decision"]),
  text: z.string().trim().min(1, "Write the fact or decision").max(400, "Keep it under 400 characters"),
  sourceMessageId: nexconnMessageIdSchema.optional(),
});
export const memoryUpdateSchema = z.object({
  kind: z.enum(["fact", "decision"]).optional(),
  text: z.string().trim().min(1).max(400).optional(),
});

const proposalTasks = z.object({
  type: z.literal("tasks"),
  title: z.string().trim().min(1).max(120),
  items: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(200),
        assigneeName: z.string().trim().max(80).nullable().optional(),
        due: z.string().trim().max(10).nullable().optional(),
      }),
    )
    .min(1)
    .max(20),
});
const proposalPoll = z.object({
  type: z.literal("poll"),
  question: z.string().trim().min(1).max(200),
  options: z.array(z.string().trim().min(1).max(120)).min(2).max(8),
  multi: z.boolean(),
});
const proposalMemory = z.object({
  type: z.literal("memory"),
  entries: z.array(z.object({ kind: z.enum(["fact", "decision"]), text: z.string().trim().min(1).max(400) })).min(1).max(10),
});
export const proposalSchema = z.discriminatedUnion("type", [proposalTasks, proposalPoll, proposalMemory]);

export const actionDecisionSchema = z.object({ decision: z.enum(["approve", "dismiss"]) });

export const taskPatchSchema = z
  .object({
    done: z.boolean().optional(),
    assigneeUserId: z.string().uuid().nullable().optional(),
    due: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .nullable()
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const voteSchema = z.object({ optionId: z.string().uuid() });

export const testConsoleSchema = z.object({
  message: z.string().trim().min(1, "Type a message").max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "agent"]), text: z.string().max(4000) }))
    .max(20)
    .default([]),
  draft: agentCreateSchema.partial().optional(),
});
