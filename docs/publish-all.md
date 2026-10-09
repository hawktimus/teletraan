# Publish all

Studio saves each change as a draft, and the TV shows nothing until the draft is
published. Publish all is a page in the Studio's top bar, next to the editing
screen, that publishes many drafts at once instead of opening each document and
clicking Publish.

## Use it

1. Click Publish all in the top bar. The page lists every document that has a
   draft, with its kind (such as Tasks) above its own name. Each box starts
   ticked.
2. Untick what should stay a draft. Tick all and Untick all do the whole list.
3. Click Publish selected. The number in the button is how many are ticked.
4. Read the summary: what was published, what was skipped and why, and what
   failed.

If there are no drafts, the page says so. Refresh list loads the drafts again,
for when someone else has been editing.

## What it does, in order

For each ticked document, one at a time:

1. It checks the draft with the Studio's own validation, the same check the
   Publish button uses. Required fields, character limits, the rule that two
   locations cannot share a name, and every other rule in `studio/schemas/` all
   apply. A warning does not stop a publish, just as it does not stop the button.
2. If the check finds an error, the document is skipped. Nothing is written, it
   stays a draft, and the summary says which field and what is wrong.
3. If it passes, one transaction runs in Sanity: check that the draft is still
   the one that was listed, write the published copy over the old one, and delete
   the draft. The copy has the draft's content. It does not carry the draft's
   revision or updated time, which Sanity sets itself.
4. Then the next document. One document that does not publish never stops the
   others.

Nothing else is ever deleted: the only delete in a transaction is the draft that
was just published.

## Skipped and failed

- **Skipped** means the document was not written. Either it would fail the
  Publish button (fix the field named in the reason, then publish it again), or it
  cannot be published at all: its kind is not in this Studio, or it is a page that
  exists once but its draft has an unexpected id. Skipped documents are still
  drafts.
- **Failed** means the document was valid but something went wrong: the check
  could not run, you do not have permission, the network dropped, or Sanity said
  no. The error is shown as Sanity gave it. A failed document is still a draft,
  because the transaction either happens completely or not at all.

A draft that someone changed after the page loaded its list is a failed document
too, with a note to refresh and try again. The transaction starts by checking the
draft's revision, so a newer change is never published over by older content and
never deleted.

## Pages that exist once

Dashboard Settings, Look and Test the screen each exist once, with the fixed ids
`dashboardSettings`, `theme` and `demo` (`studio/structure.js`). Their drafts are
`drafts.dashboardSettings` and so on, so removing `drafts.` gives the fixed id,
and publishing keeps it. A draft of one of these kinds with any other id is
skipped instead of being published as a second copy.

## Documents that point at each other

A task can point at a location. If both are new drafts, the location is published
first, and the task is checked after that, so the task sees a published location. A
reference made with Create new while editing the task is changed from weak to
ordinary when it is published, as the Publish button does. If the location is not
ticked, the task fails on its own at the write, with Sanity's message, and stays
a draft.

## Why Releases was not used

Sanity Releases publish a group of documents as one set, and one invalid
document blocks the whole release. This tool is for the opposite case: a few
students saved several unrelated changes, and one bad document should not hold
up the rest. So it publishes each document in its own transaction. The cost is
that a batch is not all-or-nothing: if the page is closed halfway, the documents
done so far stay published.

## Where the code is

- `studio/publish-all.js`: the logic, with no Studio or React in it. Choosing and
  naming the drafts, building each transaction, the order, the reasons and the
  summary. `tools/test-publish-all.mjs` runs it with node
  (`node tools/test-publish-all.mjs`).
- `studio/publish-all-tool.js`: the page itself, written without JSX, and the
  calls to Sanity. It reads the drafts with `client.fetch` (raw perspective, which
  is what includes drafts), checks each one with `validateDocument` from `sanity`
  and writes with `client.mutate`.
- `studio/sanity.config.js` adds the tool to the top bar.
- `studio/check-schemas.mjs` checks that the tool is registered, that the three
  pages that exist once keep their fixed ids, and that every kind of document has
  a title in the list.

To add a new page that exists once, add it to `singletonTypes` in
`studio/structure.js` and to the list in `studio/publish-all-tool.js`, which
`check-schemas.mjs` compares.

The Studio is not started by the tests, so the page itself has been checked only
by reading the code and by running it against a pretend Sanity. After a deploy,
try it once with two harmless drafts, one of them invalid, before relying on it.
