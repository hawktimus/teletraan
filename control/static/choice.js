// Choices and switches for every page of the control page, so a setting looks the same everywhere. A choice is a row of buttons
// where the chosen one is filled and has a check mark. A switch is a pill with the word On or Off. Both are real radios and
// checkboxes under the look (the real input lies invisible over the button), so Tab, the arrow keys and a screen reader work
// as they do on any form, and code can still read input.checked. The look is choice.css; the state is shown by the CSS from
// :checked, so the markup never has to be redrawn when a choice changes.
//
//   choiceHtml({ name, label, items: [{ value, label, checked, attrs }], multiple })   a string of markup
//   switchHtml({ checked, label, ariaLabel, attrs })                                  a string of markup
//   choiceElement(spec), switchElement(spec)                                          the same as an element
//
// attrs is a ready-made attribute string for the input, such as 'data-mode data-day="3"'. It is written as given, so it must
// not hold anything typed by a person. Every other value is escaped here.

function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function choiceHtml(spec) {
  const kind = spec.multiple ? 'checkbox' : 'radio';
  const group = spec.multiple ? 'group' : 'radiogroup';
  const items = (spec.items || []).map(item =>
    '<label class="choice"><input type="' + kind + '"' + (spec.name ? ' name="' + esc(spec.name) + '"' : '') + ' value="' + esc(item.value) + '"' +
    (item.checked ? ' checked' : '') + (spec.disabled || item.disabled ? ' disabled' : '') + (item.attrs ? ' ' + item.attrs : '') + '>' +
    '<span class="choice-face"><span class="choice-mark" aria-hidden="true"></span><span class="choice-text">' + esc(item.label) + '</span></span></label>').join('');
  return '<div class="choices" role="' + group + '"' + (spec.label ? ' aria-label="' + esc(spec.label) + '"' : '') + (spec.labelledBy ? ' aria-labelledby="' + esc(spec.labelledBy) + '"' : '') +
    (spec.id ? ' id="' + esc(spec.id) + '"' : '') + (spec.groupAttrs ? ' ' + spec.groupAttrs : '') + '>' + items + '</div>';
}

export function switchHtml(spec) {
  return '<label class="switch"><input type="checkbox" role="switch"' + (spec.id ? ' id="' + esc(spec.id) + '"' : '') + (spec.checked ? ' checked' : '') + (spec.disabled ? ' disabled' : '') +
    (spec.ariaLabel ? ' aria-label="' + esc(spec.ariaLabel) + '"' : '') + (spec.attrs ? ' ' + spec.attrs : '') + '>' +
    '<span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span><span class="switch-word" aria-hidden="true"></span>' +
    (spec.label ? '<span class="switch-text">' + esc(spec.label) + '</span>' : '') + '</label>';
}

function elementOf(markup) {
  const holder = document.createElement('div');
  holder.innerHTML = markup;
  return holder.firstElementChild;
}

export function choiceElement(spec) {
  return elementOf(choiceHtml(spec));
}

export function switchElement(spec) {
  return elementOf(switchHtml(spec));
}

// The values that are chosen in a group of choices: one value for a radio group, a list for a group of checkboxes
export function chosen(group, multiple = false) {
  const boxes = Array.from(group.querySelectorAll('input:checked'));
  return multiple ? boxes.map(box => box.value) : (boxes[0] ? boxes[0].value : '');
}

// The words of a switch, for a test or a line of text that has to say what the switch says
export function switchWord(on) {
  return on ? 'On' : 'Off';
}
