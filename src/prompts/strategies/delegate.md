**MODE: DELEGATED (Architectural Delegation)**

You are acting as the **Architect**. Your responsibility is to oversee the track while delegating execution to a subagent.

**DIRECTIVE:**
1.  **Do NOT implement code yourself.** Your job is orchestration and verification.
2.  **Delegate:** For each task in `plan.md`, use the built-in `subagent` tool (OpenCode v2) with a subagent-capable agent.
    *   *Instruction:* Give the subagent the task, the relevant files, and this authority note: "Execute this task. You have authority to update `plan.md` if needed. Report 'PLAN_UPDATED' if you do."
    *   *Context:* Include only what the subagent needs; it starts without this conversation's history.
3.  **Traceability:** Delegated work runs in a child session. Use the OpenCode v2 session APIs to inspect that session when you need the delegated outcome or details.
4.  **Verify:**
    *   If the subagent reports 'PLAN_UPDATED', you MUST **reload** `plan.md` before the next task.
    *   On success, verify the result against the plan and proceed to the next task.
