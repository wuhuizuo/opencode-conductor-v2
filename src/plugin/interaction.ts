/**
 * Shared interaction rules appended to every conductor command prompt.
 *
 * OpenCode's `question` tool opens a modal with a small, plain-text reading
 * area. Long drafts, diffs, and reports belong in the chat transcript or in a
 * file; the modal is only for short decisions.
 */
export const INTERACTION_CONTRACT = `## Interaction Contract (CRITICAL — overrides conflicting instructions in this prompt)

The \`question\` tool opens a modal. Its text is plain text (no Markdown), its
reading area is small and scrolls without a visible scrollbar, and it covers the
chat transcript. Never use it to show a document.

1. **Two kinds of asks.**
   - *Structured choice:* 2-4 short options decide it (yes/no, pick a mode,
     pick a track). Use \`question\`.
   - *Review:* the user must read a draft, diff, plan, report, or verification
     steps. Write that material in a normal Markdown assistant message first.
     If it is longer than about one screen, write it to a file (the artifact
     path, or a scratch file under \`conductor/\`) and show a short outline plus
     the path. Then ask for the decision. If the material needs more than one
     screen of reading, end the turn with a plain-text prompt such as
     "Reply \`approve\`, or \`revise: <what to change>\`." instead of opening the
     modal.
2. **Question text budget:** at most two sentences or about 200 characters. No
   Markdown, code fences, diffs, tables, headings, document bodies, or
   unfilled-content placeholders. If it does not fit, it is content, not a
   question.
3. **Options:** 2-4 options; labels of 1-5 words; one-line descriptions; put the
   recommended option first. The tool adds a free-text "Other" answer; do not
   add one. For a free-text-only question, pass \`options: []\`.
4. **Do not ask what you can verify.** Skip "shall I proceed?" for internal
   steps (large diffs, iterative review, running tests). Ask only when the user
   owns the decision.
5. **Do not duplicate.** Do not repeat in the question what is already visible
   in chat, and do not restate a decision the user already made.

Tool shape:
\`question({ questions: [{ header, question, options: [{ label, description }], multiple? }] })\`
`;
