import ImplementPrompt from "../prompts/conductor/implement.json" with { type: "json" };
import NewTrackPrompt from "../prompts/conductor/newTrack.json" with { type: "json" };
import RevertPrompt from "../prompts/conductor/revert.json" with { type: "json" };
import ReviewPrompt from "../prompts/conductor/review.json" with { type: "json" };
import SetupPrompt from "../prompts/conductor/setup.json" with { type: "json" };
import StatusPrompt from "../prompts/conductor/status.json" with { type: "json" };

/** A packaged conductor command prompt. */
export interface CommandTemplate {
  readonly description: string;
  readonly prompt: string;
}

/**
 * The six conductor commands shipped by the plugin.
 *
 * Templates live in `src/prompts/conductor/*.json` (copied to `dist/prompts` at build time).
 */
export const COMMAND_TEMPLATES = {
  setup: SetupPrompt as CommandTemplate,
  newTrack: NewTrackPrompt as CommandTemplate,
  implement: ImplementPrompt as CommandTemplate,
  review: ReviewPrompt as CommandTemplate,
  status: StatusPrompt as CommandTemplate,
  revert: RevertPrompt as CommandTemplate,
} as const;

export type CommandId = keyof typeof COMMAND_TEMPLATES;

export const COMMAND_IDS = Object.keys(COMMAND_TEMPLATES) as CommandId[];

/** OpenCode v2 command names (namespaced registration). */
export const COMMAND_NAMES: Record<CommandId, string> = {
  setup: "conductor:setup",
  newTrack: "conductor:newTrack",
  implement: "conductor:implement",
  review: "conductor:review",
  status: "conductor:status",
  revert: "conductor:revert",
};
