import { renderEnvironment, type ProjectContext } from "./context.js";

export interface CommandCompositionInput {
  /** Packaged prompt template for the command. */
  readonly template: string;
  /** Project context computed at execution time. */
  readonly context: ProjectContext;
  /** Optional strategy guidance (used by `conductor:implement`). */
  readonly strategySection?: string;
  /** Raw arguments typed after the slash command, if any. */
  readonly userArguments?: string;
}

const SECTION_SEPARATOR = "\n\n---\n\n";

/**
 * Compose the text dispatched to the session for one conductor command:
 * template, optional strategy guidance, optional user arguments, then the
 * execution-time environment block.
 */
export function composeCommandText(input: CommandCompositionInput): string {
  const sections = [input.template.trim()];

  const strategy = input.strategySection?.trim();
  if (strategy) sections.push(`## Execution Strategy\n\n${strategy}`);

  const argumentsText = input.userArguments?.trim();
  if (argumentsText) sections.push(`## User Arguments\n\n${argumentsText}`);

  sections.push(renderEnvironment(input.context));

  return `${sections.join(SECTION_SEPARATOR)}\n`;
}
