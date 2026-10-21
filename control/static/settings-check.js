// Checks a value against a field of the form spec (studio/tools/schema-spec.js), in plain words. The page uses it while a
// field is typed in, and the control service uses the same file before it writes anything, so both say the same thing.
// The custom rules of the schema are functions and are kept only on the server (field.validation.customs), so the page
// cannot run them; the server runs them and answers with the reason.

function nothing(value) {
  return value === undefined || value === null || value === '';
}

function isDate(field) {
  return field.widget === 'date' || field.widget === 'datetime';
}

// The size a limit is compared with: characters of a text, items of a list, the number itself, or the time of a date
function sizeOf(field, value) {
  if (typeof value === 'string') return isDate(field) ? Date.parse(value) : value.length;
  if (Array.isArray(value)) return value.length;
  return value;
}

function limitOf(field, limit) {
  return isDate(field) && typeof limit === 'string' ? Date.parse(limit) : limit;
}

function lengthWords(field, value, limit, over) {
  if (isDate(field)) return field.title + (over ? ' is too late.' : ' is too early.');
  if (typeof value === 'string') return field.title + (over ? ' is too long. Up to ' + limit + ' characters fit.' : ' is too short. Use at least ' + limit + ' characters.');
  if (Array.isArray(value)) return over ? field.title + ' can have ' + limit + ' items at most.' : field.title + ' needs at least ' + limit + ' items.';
  return field.title + (over ? ' is too high. The most is ' + limit + '.' : ' is too low. The least is ' + limit + '.');
}

function wrongKind(field, value) {
  const widget = field.widget;
  if (widget === 'switch') return typeof value === 'boolean' ? '' : field.title + ' should be on or off.';
  if (field.type === 'number') return typeof value === 'number' && isFinite(value) ? '' : field.title + ' should be a number.';
  if (isDate(field)) return typeof value === 'string' && !isNaN(Date.parse(value)) ? '' : field.title + ' should be a date.';
  if (['text', 'textarea', 'color', 'radio', 'select'].includes(widget)) return typeof value === 'string' ? '' : field.title + ' should be text.';
  return '';
}

function listProblem(field, value) {
  if (!field.options || nothing(value)) return '';
  const allowed = field.options.list.map(item => item.value);
  const picked = Array.isArray(value) ? value : [value];
  return picked.every(item => allowed.includes(item)) ? '' : 'Pick from the choices of ' + field.title.toLowerCase() + '.';
}

// The first problem of a plain value (not a group or a list of items): '' when it is fine. level is error, or warning
// for the advice the schema marks as a warning.
export function problemWith(field, value, parent, level = 'error') {
  const rules = field.validation || {};
  const own = level === 'error' ? rules : rules.warn || {};
  const say = (name, fallback) => (own.messages && own.messages[name]) || fallback;
  const empty = nothing(value) || (Array.isArray(value) && value.length === 0 && field.widget === 'tags');

  if (nothing(value) || (Array.isArray(value) && value.length === 0 && rules.required)) {
    if (rules.required && level === 'error') return say('required', 'Add ' + field.title.toLowerCase() + '.');
  }
  if (empty) return level === 'error' ? custom(rules, value, parent, level) : '';

  if (level === 'error') {
    const kind = wrongKind(field, value);
    if (kind) return kind;
    if (field.widget === 'tags' && !Array.isArray(value)) return field.title + ' should be a list.';
    if (field.widget === 'checks' && !Array.isArray(value)) return field.title + ' should be a list.';
  }

  const limits = level === 'error' ? rules : rules.warn || {};
  if (limits.integer && !Number.isInteger(value)) return say('integer', field.title + ' should be a whole number.');
  if (limits.positive && !(value > 0)) return say('positive', field.title + ' should be more than 0.');
  if (limits.min !== undefined && sizeOf(field, value) < limitOf(field, limits.min)) return say('min', lengthWords(field, value, limits.min, false));
  if (limits.max !== undefined && sizeOf(field, value) > limitOf(field, limits.max)) return say('max', lengthWords(field, value, limits.max, true));
  if (limits.length !== undefined && sizeOf(field, value) !== limits.length) return say('length', field.title + ' should be ' + limits.length + ' long.');
  for (const rule of limits.regex || []) {
    if (typeof value === 'string' && new RegExp(rule.source, rule.flags).test(value) === Boolean(rule.invert)) return rule.message || field.title + ' is not in the right form.';
  }
  if (level === 'error') {
    if (rules.valid && !Array.isArray(value) && !rules.valid.includes(value)) return say('valid', 'Pick from the choices of ' + field.title.toLowerCase() + '.');
    const choice = listProblem(field, value);
    if (choice) return choice;
    if (limits.unique && Array.isArray(value) && new Set(value).size !== value.length) return say('unique', field.title + ' has a repeat. Remove it.');
  }
  return custom(rules, value, parent, level);
}

function custom(rules, value, parent, level) {
  for (const rule of rules.customs || []) {
    if ((rule.level === 'warning' ? 'warning' : 'error') !== level) continue;
    let answer;
    try {
      answer = rule.fn(value, { parent: parent || {}, document: parent || {} });
    } catch (error) {
      continue;
    }
    if (typeof answer === 'string') return answer;
    if (answer && typeof answer === 'object' && typeof answer.message === 'string') return answer.message;
  }
  return '';
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

const systemKeys = ['_key', '_type'];

// Every problem of a set of values against a list of fields: [{ path: 'crt.everySeconds', message }]. A key that is not a
// field is a problem too, so a name that the form does not have is never stored. Fields not in values are not checked, as a
// save sends only what changed; pass whole: true to check the required ones as well.
export function problemsIn(fields, values, trail = '', whole = false) {
  const found = [];
  const known = fields.map(field => field.name);
  Object.keys(values || {}).forEach(key => {
    if (!known.includes(key) && !systemKeys.includes(key)) found.push({ path: trail + key, message: 'There is no setting called ' + key + ' here.' });
  });

  fields.forEach(field => {
    const path = trail + field.name;
    const has = values && Object.prototype.hasOwnProperty.call(values, field.name);
    if (!has && !whole) return;
    const value = has ? values[field.name] : undefined;
    if (field.readOnly && has) {
      found.push({ path: path, message: field.title + ' cannot be changed here.' });
      return;
    }
    found.push(...problemsOf(field, value, values, path, whole));
  });
  return found;
}

function problemsOf(field, value, parent, path, whole) {
  if (field.widget === 'group') {
    if (nothing(value)) return [];
    if (!isObject(value)) return [{ path: path, message: field.title + ' should be a group of settings.' }];
    return problemsIn(field.fields, value, path + '.', whole);
  }

  if (field.widget === 'list') {
    if (nothing(value)) return field.validation && field.validation.required ? [{ path: path, message: 'Add ' + field.title.toLowerCase() + '.' }] : [];
    if (!Array.isArray(value)) return [{ path: path, message: field.title + ' should be a list.' }];
    const found = [];
    const own = problemWith(Object.assign({}, field, { widget: 'tags' }), value, parent);
    if (own) found.push({ path: path, message: own });
    value.forEach((item, index) => {
      const at = path + '[' + index + ']';
      if (!isObject(item)) return found.push({ path: at, message: 'An item of ' + field.title.toLowerCase() + ' should be a group of settings.' });
      const member = field.members.length === 1 ? field.members[0] : field.members.filter(one => one.type === item._type)[0];
      if (!member) return found.push({ path: at, message: 'An item of ' + field.title.toLowerCase() + ' has a kind the form does not know.' });
      found.push(...problemsIn(member.fields, item, at + '.', true));
    });
    return found;
  }

  if (field.widget === 'team') {
    if (nothing(value)) return [];
    const ok = isObject(value) && value._type === 'reference' && typeof value._ref === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value._ref);
    return ok ? [] : [{ path: path, message: field.title + ' should be Both or one of the teams.' }];
  }

  const message = problemWith(field, value, parent);
  return message ? [{ path: path, message: message }] : [];
}
