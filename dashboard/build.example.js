// The shape of dashboard/build.js, which the control service writes for every release and kiosk.sh writes again when the screen starts. git ignores the real file.
// index.html puts build after ?v= on every file it loads, and core/version-label.js turns version and commit into "v14 · a1b2c3d".
// Without a build.js (a plain web server on a laptop) the page uses the time.
export const build = "0-0000000";
export const version = 0;
export const commit = "";
export const date = "";
