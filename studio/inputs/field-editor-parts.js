// The parts of the plain field editor that need no Studio (field-editor.js draws them). A page of the Studio that
// is not a document (Today, Look, Competition) shows some fields of Dashboard Settings as plain rows. The row
// takes its title, description, choices and limits from the field in the schema, so a field is written once.
// The limits are read by running the validation of the field on a Rule that only writes down what it is asked.

const ruleMethods = ['required', 'min', 'max', 'length', 'integer', 'positive', 'regex', 'uri', 'email', 'custom', 'unique', 'valid', 'error', 'warning', 'info'];

function recorder(constraints) {
  const rule = { constraints: constraints };
  ruleMethods.forEach(name => {
    rule[name] = (...args) => recorder(constraints.concat([{ name: name, args: args }]));
  });
  return rule;
}

// What a field asks of its value, in order. A limit that is only a warning is left out, because it does not stop a save.
export function constraintsOf(field) {
  if (!field || typeof field.validation !== 'function') return [];
  const result = field.validation(recorder([]));
  const rules = Array.isArray(result) ? result : [result];
  const all = rules.reduce((list, rule) => list.concat(rule && rule.constraints ? rule.constraints : []), []);
  return all.filter((constraint, index) => !(all[index + 1] && all[index + 1].name === 'warning'));
}

// The field of a list of fields by a name such as motion or alert.on (an object, then the field inside it)
export function fieldNamed(fields, name) {
  const parts = name.split('.');
  let found = (fields || []).filter(field => field.name === parts[0])[0];
  for (let i = 1; found && i < parts.length; i++) found = (found.fields || []).filter(field => field.name === parts[i])[0];
  return found || null;
}

// How a field is drawn: a switch, a choice of buttons, a number, a line of text, longer text, a date and time or a date
export function kindOf(field) {
  if (field.type === 'boolean') return 'switch';
  if (field.type === 'number') return 'number';
  if (field.type === 'datetime') return 'datetime';
  if (field.type === 'date') return 'date';
  if (field.type === 'text') return 'longtext';
  if (field.options && Array.isArray(field.options.list)) return 'choice';
  return 'text';
}

// A row for one field. The name may be a path such as alert.on, which is stored inside the object alert.
export function specOf(fields, name, prefix = '') {
  const field = fieldNamed(fields, name);
  if (!field) throw new Error('The field ' + name + ' is not in the schema.');

  const constraints = constraintsOf(field);
  const named = constraintName => constraints.filter(constraint => constraint.name === constraintName);
  const kind = kindOf(field);
  const spec = {
    id: prefix + name,
    path: name.split('.'),
    title: field.title,
    description: field.description || '',
    kind: kind,
    initial: field.initialValue,
    required: named('required').length > 0,
    integer: named('integer').length > 0,
    choices: kind === 'choice' ? field.options.list.map(item => ({ title: item.title, value: item.value })) : [],
    rows: field.rows || 3,
    custom: named('custom').map(constraint => constraint.args[0]).filter(check => typeof check === 'function'),
  };

  // The messages the schema words for each limit
  const withMessage = (constraintName, fallback) => {
    const index = constraints.indexOf(named(constraintName)[0]);
    if (index < 0) return fallback;
    const next = constraints[index + 1];
    return next && next.name === 'error' && next.args[0] ? String(next.args[0]) : fallback;
  };
  const longest = named('max')[0];
  const shortest = named('min')[0];
  if (kind === 'number') {
    if (shortest) spec.min = shortest.args[0];
    if (longest) spec.max = longest.args[0];
  } else if (kind === 'text' || kind === 'longtext') {
    if (longest) spec.maxLength = longest.args[0];
  }
  spec.patterns = constraints
    .map((constraint, index) => ({ constraint: constraint, next: constraints[index + 1] }))
    .filter(item => item.constraint.name === 'regex')
    .map(item => ({ pattern: item.constraint.args[0], message: item.next && item.next.name === 'error' && item.next.args[0] ? String(item.next.args[0]) : 'Use the right form.' }));
  spec.rangeMessage = withMessage('max', '') || withMessage('min', '');
  spec.requiredMessage = withMessage('required', 'Fill this in.');
  spec.lengthMessage = withMessage('max', 'Too long. Up to ' + spec.maxLength + ' characters fit.');
  spec.integerMessage = withMessage('integer', 'Use a whole number.');
  return spec;
}

export function specsOf(fields, names, prefix) {
  return names.map(name => specOf(fields, name, prefix));
}

// The stored value of a row, or the starting value of its field when nothing is stored yet
export function valueOf(spec, document) {
  let value = document;
  for (let i = 0; i < spec.path.length; i++) value = value && typeof value === 'object' ? value[spec.path[i]] : undefined;
  return value === undefined || value === null ? spec.initial : value;
}

// The message that says what to fix, or empty text when the value can be saved. Empty text is a value for a
// field that is not required.
export function problemWith(spec, value) {
  const empty = value === undefined || value === null || value === '' || (typeof value === 'number' && isNaN(value));
  if (empty) return spec.required ? spec.requiredMessage : '';

  if (spec.kind === 'number') {
    if (typeof value !== 'number') return 'Enter a number.';
    if (spec.integer && Math.floor(value) !== value) return spec.integerMessage;
    if ((spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max)) {
      return spec.rangeMessage || 'Use a number from ' + (spec.min === undefined ? '' : spec.min) + ' to ' + (spec.max === undefined ? '' : spec.max) + '.';
    }
  }
  if ((spec.kind === 'text' || spec.kind === 'longtext') && spec.maxLength !== undefined && String(value).length > spec.maxLength) return spec.lengthMessage;
  if (spec.kind === 'choice' && spec.choices.map(choice => choice.value).indexOf(value) === -1) return 'Pick one of the choices.';

  for (let i = 0; i < spec.patterns.length; i++) {
    if (typeof value === 'string' && !spec.patterns[i].pattern.test(value)) return spec.patterns[i].message;
  }
  for (let i = 0; i < spec.custom.length; i++) {
    let answer = true;
    try {
      answer = spec.custom[i](value, {});
    } catch (error) {
      answer = true;
    }
    if (answer !== true && typeof answer === 'string') return answer;
  }
  return '';
}

// What to write to the draft for a new value of the row: the fields to set and the names to remove. A value inside
// an object is written as the whole object with that one value changed, so its other values are kept. An empty value
// removes the stored value, which is how a field that is not required goes back to empty.
export function changeFor(spec, document, value) {
  const empty = value === undefined || value === null || value === '' || (typeof value === 'number' && isNaN(value));
  const top = spec.path[0];

  if (spec.path.length === 1) return empty ? { set: {}, unset: [top] } : { set: { [top]: value }, unset: [] };

  const inside = Object.assign({}, document && typeof document[top] === 'object' && document[top] ? document[top] : {});
  if (empty) delete inside[spec.path[1]];
  else inside[spec.path[1]] = value;
  return { set: { [top]: inside }, unset: [] };
}

// A date and time as the box of the browser writes it (2026-10-17T14:30, in the local time of the computer), and back
function two(number) {
  return (number < 10 ? '0' : '') + number;
}

export function toLocalInput(isoText) {
  const date = new Date(isoText);
  if (!isoText || isNaN(date.getTime())) return '';
  return date.getFullYear() + '-' + two(date.getMonth() + 1) + '-' + two(date.getDate()) + 'T' + two(date.getHours()) + ':' + two(date.getMinutes());
}

export function fromLocalInput(localText) {
  const date = new Date(localText);
  return !localText || isNaN(date.getTime()) ? '' : date.toISOString();
}
