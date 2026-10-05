# CSV templates

These files are made by a script from the schemas in `studio/schemas/`. Do not
edit them by hand: the next run would write them again. To write them again
after a schema changes, run this in the `studio` folder:

    node scripts/make-templates.mjs

To fill one in and add the items to the Studio, see docs/importing-from-csv.md.
Copy the files out of this folder first.
