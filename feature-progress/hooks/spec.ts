import { KINDS, TASK_ID_MAX } from './report'

/** The tool's own name; the engine exposes it as `REPORT_TOOL`. */
export const REPORT_NAME = 'report'

/** The tool as the model calls it. */
export const REPORT_TOOL = `mcp__feature-progress__${REPORT_NAME}` as const

/** The answer to a subagent's call, which the mod does not store (DEC-02). */
export const IGNORED_RESULT = 'Ignored: only the main session reports progress.'

/** Everything the model needs to call the tool, since no system-prompt text carries it (TechSpec, Contracts and data). */
export const REPORT_DESCRIPTION =
  'Report the progress of a feature and its tasks to the feature-progress band and pane. ' +
  'Only the main session calls this tool; subagents do not. ' +
  'Each call merges into the stored feature: send `feature.id` always, `feature.title` on the first call, and only the fields and tasks that changed. ' +
  'A task is matched by `id`; a new id adds it, a known id updates only the fields sent. ' +
  '`remove` deletes tasks by id. ' +
  '`state` is one of: pending, planning, active, review, fixing, qa, waiting, blocked, done. ' +
  'Use `round` for the review, correction or QA round, `group` to group tasks such as "Review #1", `steps` for done/total sub-steps, ' +
  '`note` for a short reason, and `link` for a file path. ' +
  'The tool sets the timestamps.'

const STATE = { type: 'string', enum: [...KINDS] }
const ROUND = { type: ['integer', 'null'], minimum: 1, description: 'The review, correction or QA round; null clears it.' }
const LABEL = { type: 'string', description: 'Shown instead of the state word; an empty string clears it.' }
const NOTE = { type: 'string', description: 'A short reason or remark; an empty string clears it.' }

/** The tool spec `$.tool.register` takes. */
export const REPORT_SPEC = {
  name: REPORT_NAME,
  description: REPORT_DESCRIPTION,
  inputSchema: {
    type: 'object',
    properties: {
      feature: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,63}$', description: 'Lower case letters, digits and -, such as the slug of the feature folder.' },
          title: { type: 'string', description: 'Required on the first call for this id.' },
          state: STATE,
          label: LABEL,
          round: ROUND,
          note: NOTE,
        },
        required: ['id'],
      },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', maxLength: TASK_ID_MAX },
            title: { type: 'string', description: 'Required for a new task.' },
            state: STATE,
            label: LABEL,
            round: ROUND,
            group: { type: 'string', description: 'Groups tasks in the pane, such as "Review #1"; an empty string clears it.' },
            steps: {
              type: ['object', 'null'],
              properties: { done: { type: 'integer', minimum: 0 }, total: { type: 'integer', minimum: 1 } },
              required: ['done', 'total'],
              description: 'Sub-steps done out of total; null clears it.',
            },
            note: NOTE,
            link: { type: 'string', description: 'A file path, relative to the working directory or absolute; an empty string clears it.' },
          },
          required: ['id'],
        },
      },
      remove: { type: 'array', items: { type: 'string' }, description: 'Ids of tasks to delete.' },
    },
    required: ['feature'],
  },
  isDeferred: false,
} as const
