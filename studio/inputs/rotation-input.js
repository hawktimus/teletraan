// The input of the Rotation list in Dashboard Settings (schemas/settingsRotationRows.js). It shows the list the way Studio
// always does, with drag to reorder, and adds one thing. When the form opens with the list empty it fills it once from the
// lists of the views, in the order of the views, so the editors see the order the screen already follows and can drag it
// from there. Nothing is saved until Publish all.
//
// It is written without JSX, so it reads as plain JavaScript.

import { useEffect, useRef } from 'react';
import { set, useClient, useFormValue } from 'sanity';
import { migrateRotationRows } from '../tools/rotation-migrate.js';

const apiVersion = '2025-02-19';
const viewKeys = ['general', 'prime', 'nova', 'family'];

// The view documents as the migration wants them: { general: { panels }, ... }
export async function readViews(client) {
  try {
    const found = await client.fetch('*[_type == "view"]{ _id, panels }', {}, { perspective: 'published' });
    const views = {};
    (Array.isArray(found) ? found : []).forEach(doc => {
      const key = viewKeys.filter(item => 'view-' + item === doc._id)[0];
      if (key) views[key] = doc;
    });
    return views;
  } catch (error) {
    return null;
  }
}

export function RotationInput(props) {
  const client = useClient({ apiVersion: apiVersion });
  const order = useFormValue(['viewOrder']);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const filled = Array.isArray(props.value) && props.value.length > 0;
    if (props.readOnly || filled) return;

    readViews(client).then(views => {
      const now = latest.current;
      if (views === null || now.readOnly || (Array.isArray(now.value) && now.value.length > 0)) return;
      now.onChange(set(migrateRotationRows(order, views)));
    });
  }, []);

  return props.renderDefault(props);
}
