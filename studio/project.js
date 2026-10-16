// The Sanity project the Studio and the command line tool both use. The same
// project ID is in dashboard/config.js, and tests/schemas.test.mjs fails if the two
// differ. The ID is public, since it is part of every address the screen asks
// for, so it is fine in the repository.
export const projectId = 'ybfqe345';
export const dataset = 'production';

// Set only when the Mini builds the Studio (control/lib/studio-build.js), which serves it at /studio/. The hosted
// copy (npm run deploy) has none. Sanity puts SANITY_STUDIO_ values into the build.
export const studioBasePath = process.env.SANITY_STUDIO_BASE_PATH || '';
