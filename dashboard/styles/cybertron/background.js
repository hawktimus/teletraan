// The background of the Cybertron theme (core/theme-bg.js puts it in #theme-bg): a near black ground, a grid of
// 64 pixels that drifts upward on a 16 second loop, and a scan line that passes every 9 seconds. Styled in
// theme.css, and moved by frame.css in this folder.

export function backgroundMarkup() {
  return `<div class="bg-group bg-cybertron">
    <div class="cy-ground"></div>
    <div class="cy-grid"></div>
    <div class="cy-scan"></div>
  </div>`;
}
