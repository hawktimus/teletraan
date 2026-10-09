// The input of the Panel order list in Dashboard Settings (schemas/settingsRotation.js).
// It shows the list the way Studio always does, with one addition. A page saved
// before the list existed has two older lists, Large panels and Small panels,
// and the new list is empty. When the form opens with the new list empty, this
// input fills it from the older two, once, so the editors see the order the
// screen already follows and can drag it from there.
//
// dashboard/core/panel-order.js builds the same list for a screen whose page was
// never opened in Studio. check-schemas.mjs compares the two.
//
// It is written without JSX, so it reads as plain JavaScript.

import { useEffect } from 'react';
import { set, useFormValue } from 'sanity';

// The older lists as one: the large panels, then the small panels. Every row
// needs a key of its own, which the older rows' keys cannot give because the two
// lists could share one.
export function orderFromLists(large, small) {
  const rows = list => (Array.isArray(list) ? list : []).filter(step => step && step.panel);

  return rows(large).concat(rows(small)).map((step, index) => {
    const row = { _key: 'panel-' + index, panel: step.panel, show: step.show !== false };
    if (typeof step.seconds === 'number' && step.seconds > 0) row.seconds = step.seconds;
    return row;
  });
}

export function PanelOrderInput(props) {
  const large = useFormValue(['rotation', 'grid1']);
  const small = useFormValue(['rotation', 'grid2']);

  useEffect(() => {
    const filled = Array.isArray(props.value) && props.value.length > 0;
    const order = orderFromLists(large, small);
    if (!props.readOnly && !filled && order.length > 0) props.onChange(set(order));
  }, []);

  return props.renderDefault(props);
}
