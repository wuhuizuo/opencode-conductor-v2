import { Plugin } from "@opencode/plugin";
import { composeCommandText } from "./plugin/commandText.js";
import { buildProjectContext } from "./plugin/context.js";
import { COMMAND_IDS, COMMAND_NAMES, COMMAND_TEMPLATES, type CommandId } from "./plugin/prompts.js";
import { migrationNotice, provisionConductorAgent } from "./plugin/provisioning.js";
import {
  hasSubagentAgent,
  loadStrategyText,
  parseDelegationMode,
  resolveStrategy,
  type DelegationMode,
} from "./plugin/strategies.js";

/** Shape of the invocation the OpenCode v2 command runtime hands to `execute`. */
interface CommandInvocation {
  readonly sessionID: string;
  readonly prompt: { readonly text: string } & Record<string, unknown>;
  readonly delivery: "steer" | "queue" | null | undefined;
}

interface AgentDomainLike {
  list(): Promise<unknown>;
}

/**
 * Conductor plugin for OpenCode v2.
 *
 * Registers the six `/conductor:*` commands and provisions the `@conductor`
 * agent into the global OpenCode v2 agents directory.
 */
export default Plugin.define({
  id: "conductor",

  async setup(ctx) {
    const options = (ctx.options ?? {}) as Record<string, unknown>;
    const delegation: DelegationMode = parseDelegationMode(options.delegation);

    if (options.provisionAgent !== false) {
      provisionAgent(typeof options.home === "string" ? options.home : undefined);
    }

    const listAgents = async (): Promise<unknown> => {
      try {
        return await (ctx.agent as unknown as AgentDomainLike).list();
      } catch {
        return [];
      }
    };

    const executeCommand = async (id: CommandId, invocation: CommandInvocation): Promise<void> => {
      const context = buildProjectContext(ctx.location.directory);
      const strategySection =
        id === "implement"
          ? loadStrategyText(resolveStrategy(delegation, hasSubagentAgent(await listAgents())))
          : undefined;

      const text = composeCommandText({
        template: COMMAND_TEMPLATES[id].prompt,
        context,
        strategySection,
        userArguments: invocation.prompt?.text,
      });

      await ctx.session.prompt({
        ...invocation.prompt,
        sessionID: invocation.sessionID,
        text,
        delivery: invocation.delivery,
      });
    };

    const registration = await ctx.command.transform((editor) => {
      for (const id of COMMAND_IDS) {
        editor.add({
          name: COMMAND_NAMES[id],
          description: COMMAND_TEMPLATES[id].description,
          execute: (invocation) => executeCommand(id, invocation as unknown as CommandInvocation),
        });
      }
    });

    return async () => {
      await registration.dispose();
    };
  },
});

/** Install/refresh the conductor agent; provisioning failures must not break command registration. */
function provisionAgent(home?: string): void {
  try {
    const result = provisionConductorAgent(home ? { home } : {});
    if (result.legacyArtifacts.length > 0) {
      console.warn(migrationNotice(result.legacyArtifacts));
    }
  } catch (error) {
    console.warn(`[conductor] agent provisioning skipped: ${String(error)}`);
  }
}
