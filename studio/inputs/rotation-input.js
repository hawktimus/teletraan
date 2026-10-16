// The input of the Rotation list in Dashboard Settings (schemas/settingsRotationRows.js). It shows the list the way Studio
// always does, with drag to reorder, and adds one thing. When the form opens with the list empty it fills it once with the
// default rotation (tools/default-rotation.js), fifteen blocks, so the editors see the order the screen follows and can drag
// it from there. Nothing is saved until Publish all.
//
// It is written without JSX, so it reads as plain JavaScript.

import { useEffect } from 'react';
import { set } from 'sanity';
import { migrateRotationRows } from '../tools/rotation-migrate.js';

export function RotationInput(props) {
  useEffect(() => {
    const filled = Array.isArray(props.value) && props.value.length > 0;
    if (props.readOnly || filled) return;

    props.onChange(set(migrateRotationRows()));
  }, []);

  return props.renderDefault(props);
}
