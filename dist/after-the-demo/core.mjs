/** Pure measurement and export helpers. No network or browser APIs. */
export const VERSION = 1;
export const STORAGE_KEY = 'after-the-demo:v1';
export const MAX_TRIALS = 500;
export const MAX_MINUTES = 100000;
export const MAX_COST = 1000000;
export const STAGES = Object.freeze(['prompting', 'generation', 'review', 'rework']);
export const SAMPLE = Object.freeze({
  id: 'synthetic-example', createdAt: '2026-01-01T12:00:00.000Z',
  task: 'Turn meeting notes into a project brief', baseline: 45,
  prompting: 6, generation: 4, review: 12, rework: 9, cost: 0.8,
  quality: 'pass', notes: 'Synthetic example only. Same scope, all decisions checked, ready to share.'
});

function numeric(value, name, max, positive = false) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') {
    throw new Error(`${name} is required.`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max || (positive && number < 0.01)) {
    throw new Error(`${name} must be ${positive ? 'at least 0.01' : 'zero or more'} and no more than ${max.toLocaleString('en-US')}.`);
  }
  return number;
}

export function validateTrial(input) {
  if (!input || typeof input !== 'object') throw new Error('A trial must be an object.');
  const task = typeof input.task === 'string' ? input.task.trim() : '';
  if (!task || task.length > 100) throw new Error('Use a task name between 1 and 100 characters.');
  if (!['pass', 'fail'].includes(input.quality)) throw new Error('Choose whether the result passed your quality check.');
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (notes.length > 500) throw new Error('Keep the quality notes to 500 characters.');
  const output = {
    task, baseline: numeric(input.baseline, 'Baseline time', MAX_MINUTES, true),
    prompting: numeric(input.prompting, 'Prompting time', MAX_MINUTES),
    generation: numeric(input.generation, 'Generation / waiting time', MAX_MINUTES),
    review: numeric(input.review, 'Review time', MAX_MINUTES),
    rework: numeric(input.rework, 'Rework time', MAX_MINUTES),
    cost: numeric(input.cost, 'Tool cost', MAX_COST), quality: input.quality, notes
  };
  if (assistedMinutes(output) <= 0) throw new Error('Enter some time for the AI-assisted attempt. At least one stage must be greater than zero.');
  return output;
}

export function assistedMinutes(trial) {
  return STAGES.reduce((sum, stage) => sum + trial[stage], 0);
}

export function summarize(trials, hourlyValue = null) {
  if (!Array.isArray(trials) || trials.length > MAX_TRIALS) throw new Error('Invalid trial list.');
  const value = hourlyValue === null || hourlyValue === '' ? null : numeric(hourlyValue, 'Hourly value', MAX_COST);
  const clean = trials.map(validateTrial);
  const baseline = clean.reduce((sum, trial) => sum + trial.baseline, 0);
  const assisted = clean.reduce((sum, trial) => sum + assistedMinutes(trial), 0);
  const saved = baseline - assisted;
  const cost = clean.reduce((sum, trial) => sum + trial.cost, 0);
  const passed = clean.filter(trial => trial.quality === 'pass').length;
  return {
    count: clean.length, baseline, assisted, saved, cost, passed,
    passRate: clean.length ? passed / clean.length : null,
    savedPercent: baseline ? saved / baseline * 100 : null,
    breakEvenHourly: clean.length && saved > 0 ? cost / (saved / 60) : null,
    netValue: value === null || !clean.length ? null : saved / 60 * value - cost,
    stages: Object.fromEntries(STAGES.map(stage => [stage, clean.reduce((sum, trial) => sum + trial[stage], 0)]))
  };
}

export function parseStored(raw) {
  const value = JSON.parse(raw);
  if (!value || value.version !== VERSION || !Array.isArray(value.trials) || value.trials.length > MAX_TRIALS) {
    throw new Error('This browser’s saved data has an unsupported format.');
  }
  const ids = new Set();
  const trials = value.trials.map(trial => {
    if (!trial || typeof trial.id !== 'string' || !trial.id || trial.id.length > 100 || trial.id === SAMPLE.id || ids.has(trial.id)) {
      throw new Error('The saved trial IDs are invalid.');
    }
    if (typeof trial.createdAt !== 'string' || !Number.isFinite(Date.parse(trial.createdAt))) {
      throw new Error('A saved trial date is invalid.');
    }
    ids.add(trial.id);
    return {id: trial.id, createdAt: new Date(trial.createdAt).toISOString(), ...validateTrial(trial)};
  });
  const hourlyValue = value.hourlyValue === null || value.hourlyValue === undefined || value.hourlyValue === ''
    ? null : numeric(value.hourlyValue, 'Hourly value', MAX_COST);
  return {version: VERSION, trials, hourlyValue};
}

export function toJSON(trials, hourlyValue = null) {
  const payload = parseStored(JSON.stringify({version: VERSION, trials, hourlyValue}));
  return JSON.stringify({...payload, currency: 'USD', methodology: 'Saved minutes = baseline - prompting - generation/waiting - review - rework. All trials, including quality failures, are counted. Costs are incremental tool costs. This is a descriptive log, not a forecast.'}, null, 2);
}

function csvCell(value) {
  // Prevent user-authored task names/notes being interpreted as spreadsheet formulas.
  let text = String(value);
  if (typeof value === 'string' && /^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCSV(trials) {
  const clean = parseStored(JSON.stringify({version: VERSION, trials})).trials;
  const header = ['id', 'recorded_at', 'task', 'baseline_minutes', 'prompting_minutes', 'generation_waiting_minutes', 'review_minutes', 'rework_minutes', 'ai_assisted_minutes', 'saved_minutes', 'quality', 'tool_cost_usd', 'notes'];
  const rows = clean.map(trial => [trial.id, trial.createdAt, trial.task, trial.baseline, trial.prompting, trial.generation, trial.review, trial.rework, assistedMinutes(trial), trial.baseline - assistedMinutes(trial), trial.quality, trial.cost, trial.notes]);
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
