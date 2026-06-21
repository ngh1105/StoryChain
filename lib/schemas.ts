import { z } from "zod";

// Request sent to contract.create_chain (frontend adds created_at separately).
export const CreateChainRequestSchema = z.object({
  title: z.string().min(1).max(200),
  premise: z.string().min(1).max(1000),
});
export type CreateChainRequest = z.infer<typeof CreateChainRequestSchema>;

// Chain metadata returned by contract.get_chain.
export const StoryChainSchema = z.object({
  chain_id: z.string(),
  title: z.string(),
  premise: z.string(),
  created_by: z.string(),
  created_at: z.string(),
});
export type StoryChain = z.infer<typeof StoryChainSchema>;

// Sentence returned by contract.get_story.
export const SentenceSchema = z.object({
  text: z.string(),
  author: z.string(),
  created_at: z.string(), // on-chain GenLayer has no wall clock; contract sets ""
});
export type Sentence = z.infer<typeof SentenceSchema>;
