// Only used by ?stress. It fills the small panel area with a panel of the
// real size and the widest numbers, so the hardware test sees the whole
// screen moving and not just one panel.

export function mount(host) {
  host.innerHTML = `
    <section class="page stand-in-tile">
      <div class="tile-label" data-slat="label">OPEN TASKS</div>
      <div class="tile-content" data-slat="content">
        <div class="tile-count">[8]</div>
        <div class="tile-lines">
          <div>[2 blocked]</div>
          <div>[2 up next]</div>
        </div>
      </div>
    </section>`;
}
