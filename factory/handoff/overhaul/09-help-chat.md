# Phase 9: Help chat

## Goal

An `Ask` tab next to the steps where a learner can ask a tutor about the step
they are on. The tutor is Claude, called through a small server that holds the
API key. It sees the step, checklist, mistake, circuit, code and run status,
and it answers with words and with tools that act on the workbench (highlight,
labels, camera, the phase 8 explain tools, quick checks, code suggestions for
debugging). It guides rather than solves, never edits the learner's work, and
nothing it does counts towards a goal.

The chat is off unless the build turns it on, keeps no chat text anywhere,
and stays on course topics (decision 8 in `00-plan.md`).

## Before writing any code for this phase

Invoke the `claude-api` skill and read, from its base directory:
`typescript/claude-api/README.md`, `typescript/claude-api/tool-use.md`,
`shared/tool-use-concepts.md`, `shared/prompt-caching.md`, and the
"Migrating to Claude Opus 5.5" part of `shared/model-migration.md` (refusals,
server side fallbacks, preserved thinking). Where the skill and this file
disagree about the API, follow the skill and write the difference into
"Decisions made while building".

## 9.1 Setup

- `npm install @anthropic-ai/sdk@latest` (AGENTS.md rule: never `npm update`).
- `.gitignore`: add `.env`, `.env.local` and `.env.*.local`.
- `.env.example` (committed):
  ```
  # Show the Ask tab in the app (vite reads VITE_ variables)
  VITE_TUTOR=on
  # Read by the tutor server only. Never put a real key in a committed file.
  ANTHROPIC_API_KEY=
  ```
- `vite.config.js` (new): proxy `/api` to `http://localhost:7300` for both
  `server` and `preview`. Nothing else.
- `package.json` script: `"tutor": "node server/tutor.mjs"`.
- The Ask tab only exists when `import.meta.env.VITE_TUTOR === 'on'`.
- README: a short "Help chat" section: copy `.env.example` to `.env.local`,
  set `ANTHROPIC_API_KEY` (or sign in with `ant auth login`), run
  `npm run tutor` next to `npm run dev`. Hosting the server in production is
  not part of this work.

## 9.2 Tool definitions (shared)

`src/tutor/toolDefs.js`: pure data, imported by the server (to send to the
API) and the client (to validate and run). Every tool has `strict: true`, an
`input_schema` with `type: 'object'`, `additionalProperties: false`, and every
property listed in `required`. If the API rejects a schema keyword under
strict mode, drop the keyword and enforce it in `src/tutor/tools.js`.

| Name | Input | Description (send this text) |
| --- | --- | --- |
| `highlight` | `target` string | Light up a hole (`9e`), a strip (`9-top`), a rail (`rail-T+`), an Uno pin (`D13`) or a placed part (`led1`) for a few seconds. |
| `pin_label` | `target` string, `text` string | Pin a short note (40 characters at most) to a hole, pin or placed part. |
| `move_camera` | `target` string, `view` enum `top`, `3d` | Point the camera at a hole, pin, part, `breadboard` or `uno`. |
| `point_to_code` | `line` integer, `note` string | Mark a line of the sketch with a short note and open the code. |
| `show_placement` | `part` string | Show a see-through copy of one working placement for a part of the current build or wire step. Only works after the learner has had a hint. |
| `trace_current` | `from` string | Animate the current from an Uno pin through the learner's circuit and report where it goes or stops. |
| `xray` | `on` boolean | Make the breadboard see-through to show the metal strips. |
| `connections` | `compare` boolean | Show every connection in the learner's circuit, optionally ticked against the lesson circuit. |
| `part_card` | `part` string | Show a card about a part (a part id or type): its legs and key numbers. |
| `scope` | `pin` string, `seconds` integer | Plot a pin's level over the last 1 to 5 seconds while the sketch runs, and report the timing. |
| `measure` | `target` string | Read the voltage at a hole, pin or part leg (`led1.anode`). |
| `what_if` | `kind` enum `code`, `flip`, `remove`, `ohms`; `target` string; `value` string | Run a pretend copy with one change and report the difference. For code, target is the line number and value the new line. The learner's work is not changed. |
| `slow_motion` | `speed` enum `0.1`, `0.25` | Run the sketch slowly with the running line lit up. Pauses goals until the learner presses Run again. |
| `demo_input` | `target` string, `value` number, `seconds` integer | Press a button (`btn1`, value 1), turn a knob (`pot1`, 0 to 1), or set `room-light` (0 to 1) or `room-temp` (0 to 40 deg C) for 1 to 5 seconds. Pauses goals until the learner presses Run again. |
| `suggest_code` | `line` integer, `text` string, `why` string | Offer one Serial.print or Serial.println line, added after a line only if the learner clicks Add. |
| `quick_check` | `question` string, `options` array of string, `answer` integer, `why` string | Show a one question quiz with 2 to 4 options. The learner's answer comes back as their next message. |
| `predict` | `question` string, `options` array of string | Ask the learner to guess before you show something. Their guess comes back as their next message. |
| `open_reference` | `tab` enum `overview`, `pinout`, `example`, `specs` | Open a tab of the lesson reference. |
| `recall` | `lesson` string, `step` string | Show the card of an earlier lesson step (ids as in the state). |
| `next_hint` | (no properties) | Show the next hint of the current step, at most up to Show me. |

Tests `test/toolDefs.test.js`: names unique and snake case; every schema is
strict shaped (`additionalProperties: false`, `required` equals the property
names); every name has a handler in `src/tutor/tools.js`.

## 9.3 The server

`server/tutorCore.mjs` (pure, tested) and `server/tutor.mjs` (the HTTP server).

`tutorCore.mjs` exports:

- `SYSTEM_PROMPT` (9.5, exactly).
- `validateRequest(body)` -> `{ ok: true, messages } | { ok: false, error }`:
  - body is `{ messages: [...] }`, nothing else;
  - 1 to 80 messages, roles alternate starting and ending with `user`;
  - user content: an array of `text` blocks (each at most 8000 characters) or
    `tool_result` blocks (`tool_use_id` string, `content` string at most 4000
    characters, optional `is_error` boolean);
  - assistant content: the blocks the API returned, passed through unchanged
    (`text`, `tool_use` with a known tool name, `thinking`,
    `redacted_thinking`, and any fallback blocks the skill says must be echoed
    back); at most 40000 characters per message as JSON;
  - the whole body at most 200 KB.
- `buildApiRequest(messages)`: the request object:
  ```js
  {
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    cache_control: { type: 'ephemeral' },
    system: [{ type: 'text', text: SYSTEM_PROMPT }],
    tools: TOOL_DEFINITIONS,
    messages
  }
  ```
  No `thinking` parameter (Claude Opus 5.5 always thinks adaptively; effort
  is the control). No `temperature`, `top_p` or `top_k`. No forced
  `tool_choice`. The tool list and system prompt never change between
  requests, so the prompt cache hits; the per turn state lives in the
  messages.
- `createRateLimiter({ perTenMinutes: 20, perDay: 300 })` -> `{ allow(key) }`.

`tutor.mjs`:
- `node:http` server on `TUTOR_PORT` (default 7300), only
  `POST /api/tutor`; anything else 404.
- Reads the JSON body (reject over 200 KB with 413), validates, rate limits by
  remote address (429 `{ error: 'rate_limited' }`).
- Calls `client.beta.messages.create(buildApiRequest(messages))` with
  `new Anthropic()` (credentials from the environment or an `ant auth login`
  profile). Non streaming.
- Replies `{ content, stop_reason }` from the response.
- Errors with the SDK's typed classes, most specific first:
  authentication -> 500 `{ error: 'not_configured' }`; rate limit or overload
  -> 503 `{ error: 'busy' }`; anything else -> 502 `{ error: 'failed' }`.
  Missing credentials at start: log one line and answer every request with
  `not_configured`.
- Logs one line per request: time, status, `stop_reason`, token usage. Never
  log message text.
- `TUTOR_FAKE=1`: no API calls. The first request of a conversation gets
  `{ stop_reason: 'tool_use', content: [text 'Let me show you the strips.', tool_use xray {on: true}, tool_use highlight {target: '9-top'}] }`;
  a request whose last user message holds tool results gets
  `{ stop_reason: 'end_turn', content: [text 'Each metal bar joins five holes. Which strip holds the long leg of your LED?'] }`.
  Use it for the browser checks when no key is available.

Tests `test/tutorCore.test.js`: valid and invalid bodies (roles, sizes, unknown
block types, unknown tool names), the request shape, the rate limiter.

## 9.4 Client: state, tools and chat loop

### State block

`src/tutor/context.js` (pure):
`buildState({ lesson, step, view, hintLevel, build, connections, code, codeError, run })`
returns an object, serialized as the first text block of every learner turn:

```
<workbench_state>
{ ...JSON... }
</workbench_state>
```

JSON fields: `lesson` `{ id, title, project }`; `step` `{ id, kind, title, text,
checklist: [{ text, ok }], passed }`; `hints` `{ level, exact_positions_allowed: level >= 2 }`;
`mistake` (text or null); `circuit` `{ parts: [{ id, label, legs }], wires: [{ from, to }],
connections: [[labels]] }`; `code` (the sketch with `N: ` line prefixes, at most
150 lines, or null) and `code_error` (`{ line, message }` or null); `run`
`{ phase, readout, progress }`. The question goes in a second text block.
Tool result turns carry no state block. Never edit an earlier message
(preserved thinking needs an append only history).

Tests `test/tutorContext.test.js`.

### Tool runner

`src/tutor/tools.js`: `createTutorTools(deps)` -> `{ run(name, input) }`
returning `{ content: string, isError: boolean }`. `deps` are the explain
tools, labels, breadboard and board highlights, stage view, code panel,
layout, flow, tracker, workbench (read only), runner, inputs, room and a
`showCard` callback for chat cards. Rules:

- Validate every input against its schema and these limits; a failure returns
  `isError` with a one sentence reason the model can act on.
- `highlight`: info tone for 4 seconds. Parts get a 4 second accent emissive
  glow.
- `pin_label`: ASCII only (drop other characters), 40 characters, 6 seconds.
- `point_to_code`: opens the code panel (or the Code tab in compact mode) and
  marks the line for 8 seconds.
- `show_placement`: only on build and wire steps, only for parts in the step's
  scope, and only when the step's hint level is at least 1; otherwise
  `Show me is not available yet. Give a hint in words first.` On success it
  draws the phase 5 level 2 visuals and raises the level to 2.
- `demo_input`: needs a running sketch; marks the run as a demo like slow
  motion (add `beginDemo()` to `src/sim/runner.js`, reusing the slow motion
  demo flag: goals paused until the next Run),
  sets the input, restores the previous value after `seconds`. Result text
  says goals are paused.
- `suggest_code`: `text` must match
  `/^\s*Serial\.(print|println)\(.*\);\s*$/` and `line` must exist. The code
  panel shows a grey line under that line with an `Add line` button
  (`codePanel.offerLine(afterLine, text)`); clicking inserts it (the code then
  counts as edited, as with any edit). Result: `Offered the line. The learner can add it.`
- `quick_check` and `predict`: 2 to 4 options, `answer` inside the range.
  They render a card in the chat with option buttons; clicking sends
  `My answer: <option>` or `My guess: <option>` as the next learner message.
  Result: `Shown. Wait for the learner to answer.`
- `next_hint`: raises the step's hint level by one, never past 2.
- `recall`: the step must exist; shows its title and body as a quote card.
- Every other tool calls the phase 8 function and returns its text.

Tests `test/tutorTools.test.js` with stub deps: validation failures, the
show_placement gate, the suggest_code pattern, demo_input without a run,
quick_check option limits.

### Chat loop

`src/tutor/chat.js`:
`createChat({ endpoint = '/api/tutor', fetchImpl, runTool, getState })` ->
`{ ask(text), reset(), getTranscript(), isBusy(), subscribe(fn) }`.

- Messages live in memory only, one conversation per lesson (reset on a
  lesson change). Nothing goes to localStorage.
- `ask(text)`: append a user message `[state block, { type: 'text', text }]`,
  then loop (at most 6 requests):
  1. POST `{ messages }`. HTTP errors map to the UI errors in 9.6.
  2. Append the assistant `content` exactly as returned (all blocks, in order).
  3. `stop_reason`:
     - `tool_use`: run the `tool_use` blocks in order. The first 4 run; any
       more get `is_error` with `Too many tools in one reply.` Append one user
       message holding a `tool_result` for every `tool_use` id, then loop.
     - `end_turn` or `stop_sequence`: done.
     - `max_tokens`: done; add `(This answer was cut short.)` in the UI.
     - `refusal`: done; the UI shows `I cannot help with that. Ask me about your circuit, your code or this step.`
     - `pause_turn`: loop again without adding a message.
- When the history passes 60 messages, start a new conversation before the
  next question and show `This chat got long, so it started fresh.`
- `getTranscript()` gives the UI view: learner and helper turns with their
  text, and tool chips (`X-ray`, `Traced the current`, `Scope on D13` ...) under
  the helper turn that called them.

Tests `test/chat.test.js` with a fake fetch: a plain answer; a tool round
trip; five tool uses (one error result); a refusal; each HTTP error; the
history reset; a learner turn carries the state block and a tool result turn
does not.

## 9.5 System prompt (exact text)

```
You are the help chat inside Robo Learn, a browser course that teaches Arduino on a simulated Uno and breadboard. You help one learner with the lesson step they are on. Learners may be young, so keep everything suitable for school.

How to help
- Guide, do not solve. Ask one short question back, point at the right place, or show something with a tool.
- Give exact holes or exact wiring only when the state says exact_positions_allowed is true. Even then, show one way and let the learner do it.
- Keep replies under 80 words, in plain words and short sentences. No emoji, no exclamation marks, no headings, no tables.
- Show instead of describing when a tool can do it. Use at most four tools in one reply.
- Never state a measurement, timing or result that did not come from a tool result or the state. When you need a number, use scope, measure, trace_current or what_if.
- The workbench_state block in each learner message is the truth about the circuit, the code and the progress. If it disagrees with the learner, say what you see in the state.
- Never write a whole sketch or the full answer to a code step. suggest_code is only for Serial.print or Serial.println lines that help find a problem.
- You cannot place parts or edit code. The learner does that.
- When a step passes, say so briefly and point to Continue.

Staying on topic
- Talk about this course, electronics, Arduino and programming. If asked about anything else, say in one sentence that you can only help with the course, then return to the step.
- If the learner mentions mains electricity, lithium batteries or anything else that could hurt them, give a short safety note: the course parts run on 5 V, and they should ask an adult before working with anything stronger.
- Never ask for or repeat personal details such as names, ages, schools or addresses.
```

## 9.6 Ask tab

`src/ui/askPanel.js`, mounted by the guide panel:

- The guide gets WAI-ARIA tabs at the top: `Steps` and `Ask` (reuse
  `nextTabIndex`). In compact mode the bottom sheet has `Steps`, `Code` and
  `Ask`.
- Empty state: `Ask about your circuit, your code or this step. The helper can point at things and run small experiments. Chats are not saved.`
  and up to three suggestion buttons by step kind (clicking one asks it):
  - build and wire: `Where does this part go?`, `Why is my checklist not ticked?`
  - code: `Why does my code not compile?` (only with a code error),
    `What does this line do?`, `How can I see what my sketch is doing?`
  - run and predict: `Why is nothing happening?`, `What should I try next?`
  - learn and explore: `Can you explain this another way?`
- The log is `role="log"` with `aria-live="polite"`. Learner turns on the
  right (ink background, white text), helper turns on the left (soft
  background); tool chips under helper turns; quiz, guess and recall cards
  inline. Scroll to the newest turn.
- Input: a textarea (`id="ask-input"`, label `Your question`, 500 characters
  at most, Enter sends, Shift Enter adds a line) and a `Send` button. While a
  request is running: both disabled and a `Thinking...` row in the log.
- `New chat` button at the top of the tab resets the conversation.
- Errors shown in the log as helper turns in muted text:
  - `not_configured` or a network failure: `The help chat is not available right now.`
  - `rate_limited`: `You have asked a lot of questions. Try again in a few minutes.`
  - `busy`: `The helper is busy. Try again in a moment.`
  - `failed`: `Something went wrong. Try asking again.`

## Browser checks

Run `TUTOR_FAKE=1 npm run tutor` and the dev server with `VITE_TUTOR=on`
(in `.env.local`).

1. Without `VITE_TUTOR`: no Ask tab anywhere.
2. With it: Steps and Ask tabs. Ask shows the empty state and suggestions for
   the step kind.
3. Ask anything (fake server): the reply text shows, the breadboard turns
   see-through, strip 9 lights up, two chips show under the reply, then the
   follow up question arrives.
4. Stop the tutor server and ask: `The help chat is not available right now.`
5. Lesson change: the chat is empty again. Reload: nothing was kept.
6. Compact layout: the Ask tab in the bottom sheet works.
7. If an API key is available: start the real server, ask in lesson 1.2's
   resistor step `where does the resistor go?` and check that the reply asks
   a question or highlights a strip instead of giving holes, that a
   `show_placement` before any hint is refused, and that the server log shows
   no message text. If no key is available, write that this check was not
   done in the progress log.

## Acceptance criteria

- [ ] The Ask tab exists only when enabled.
- [ ] The API key never reaches the browser; the server only accepts the
      validated message format and uses its own prompt and tools.
- [ ] Every tool use gets a tool result; at most four tools run per reply.
- [ ] The chat never edits the build or code and never completes a goal.
- [ ] No chat text is stored or logged.
- [ ] All new modules are tested with fakes; no test calls the real API.

## AGENTS.md updates

New section "Help chat": the flag, the server and its endpoint, request
validation, model and settings (Claude Opus 5.5, effort low, server side
fallbacks on), the tool list and rules, the state block, the chat loop, the
privacy rules, and `TUTOR_FAKE`.

## Decisions made while building

(Write any choice you had to make here.)
