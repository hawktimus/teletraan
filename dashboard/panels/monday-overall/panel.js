// The overall progress panel of a Monday row, for both teams: a ring of the hours done over all the hours (a task with
// no hours counts as one), a bar for each team, the next three milestones with their own progress, and under
// all of it the tasks done, the overdue ones and the stuck ones. The ring is drawn once, as one arc of a
// path that is 100 long, so the number of its dash is the percent. frame.css draws it in when the panel arrives.

import { boardEmptyMarkup, boardHeader, countersMarkup, pageMarkup } from '../../core/monday-draw.js';
import { daysWords, overallView } from '../../core/monday-views.js';
import { escapeHtml } from '../../core/text.js';

// Red under this many days, and the green from this percent
const soonDays = 7;
const nearlyDone = 80;

export function hasContent(content) {
  return overallView(content, new Date()) !== null;
}

// The accent of a team as a color for its bar, from its Team document. Anything that is not a hex color is the accent
// of the screen.
function accentOf(team) {
  const color = team && team.colors ? team.colors.accent : '';
  return typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : 'var(--team-accent)';
}

function ringMarkup(percent) {
  return `<div class="ring"><svg viewBox="0 0 300 300" width="300" height="300" aria-hidden="true"><circle class="ring-rule" cx="150" cy="150" r="136"/><path class="ring-arc" pathLength="100" stroke-dasharray="${percent} 100" d="M150 14 a136 136 0 1 1 0 272 a136 136 0 1 1 0 -272"/></svg><span class="ring-percent">${percent}%</span></div>`;
}

function teamRow(entry) {
  const color = accentOf(entry.team);
  const share = entry.hours.total > 0 ? Math.round((entry.hours.done / entry.hours.total) * 100) : 0;
  return `<div class="team-row"><span class="team-name" style="background: ${color}">${escapeHtml(entry.name)}</span><span class="track"><i class="fill" style="width: ${share}%; background: ${color}"></i></span><span class="hours">${entry.hours.done}/${entry.hours.total} HRS</span></div>`;
}

function milestoneRow(milestone) {
  const green = milestone.percent >= nearlyDone;
  const soon = milestone.daysLeft < soonDays;
  return `<div class="milestone"><span class="milestone-name">${escapeHtml(milestone.name)}</span><span class="milestone-date">${escapeHtml(milestone.date)}</span><span class="milestone-days${soon ? ' soon' : ''}">${escapeHtml(daysWords(milestone.daysLeft))}</span><span class="milestone-track"><i class="milestone-fill${green ? ' green' : ''}" style="width: ${milestone.percent}%"></i></span></div>`;
}

export function markupFor(content, now) {
  const view = overallView(content, now);
  if (!view) return pageMarkup('monday-overall', boardHeader('OVERALL PROGRESS', '', content, now, 'HOURS WEIGHTED'), boardEmptyMarkup(content));

  const inner = `
      <div class="left">${ringMarkup(view.percent)}
        <div class="hours-done">HOURS DONE</div>
        <div class="hours-of">${view.hours.done} OF ${view.hours.total} HOURS</div>
        <div class="hours-of">${view.hours.unestimated} UNESTIMATED</div>
      </div>
      <div class="right">
        <div class="teams">${view.teams.map(teamRow).join('')}</div>
        <div class="milestones-head">NEXT MILESTONES</div>
        <div class="milestones">${view.milestones.map(milestoneRow).join('')}</div>
      </div>
      ${countersMarkup([{ label: 'TASKS DONE', value: view.counts.done + '/' + view.counts.total }, { label: 'OVERDUE', value: view.counts.overdue }, { label: 'STUCK', value: view.counts.stuck }])}`;

  return pageMarkup('monday-overall', boardHeader('OVERALL PROGRESS', '', content, now, 'HOURS WEIGHTED'), inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
