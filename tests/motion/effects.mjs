// The name glitch and the hawk flap never run while a transition has the screen (dashboard/core/busy.js). The hook
// makes both come due every second, so they would run all the time if nothing held them back.

const round = value => Math.round(value);

// One run: effects due every second, the busy flag held or a transition played, watched every frame
async function watch(ctx, how, seconds) {
  const page = await ctx.open({}, undefined, { settleMs: 1000 });
  try {
    await page.evaluate(() => {
      window.__motion.armEffects();
      window.teletraanTest.play('name-glitch');
      window.teletraanTest.play('hawk-flap');
    });

    if (how === 'hold') {
      await page.evaluate(() => window.teletraanTest.hold(true));
      await page.waitForTimeout(seconds * 1000);
      await page.evaluate(() => window.teletraanTest.hold(false));
      // Free again: they must come back, or the rule would pass by never playing
      await page.waitForFunction(() => {
        const events = window.__motion.effects.events;
        return events.some(event => !event.busy && event.name) && events.some(event => !event.busy && event.hawk !== '');
      }, null, { timeout: 30000 }).catch(() => {});
    } else {
      // Both effects are running when the transition starts, so it has something to stop
      await page.waitForFunction(() => {
        const events = window.__motion.effects.events;
        return events.some(event => event.name) && events.some(event => event.hawk !== '');
      }, null, { timeout: 30000 });
      await page.evaluate(name => window.teletraanTest.play(name), how);
      await page.waitForFunction(() => window.__motion.effects.events.some(event => event.busy), null, { timeout: 40000 });
      await page.waitForFunction(() => {
        const events = window.__motion.effects.events;
        return events.some(event => event.busy) && !events[events.length - 1].busy;
      }, null, { timeout: 60000 });
      await page.waitForTimeout(500);
    }
    return await page.evaluate(() => window.__motion.effects);
  } catch (error) {
    return { error: 'no transition took the screen within the time of the run (' + how + ')' };
  } finally {
    await page.close();
  }
}

// The events say how the state was from each one to the next. Whatever runs while busy is a failure.
function whileBusy(log, which) {
  const failures = [];
  const label = which === 'name' ? 'name glitch' : 'hawk flap';

  log.events.forEach((event, index) => {
    const running = which === 'name' ? event.name : event.hawk !== '';
    if (!(event.busy && running)) return;

    const next = log.events[index + 1];
    const length = next ? next.at - event.at : 0;
    failures.push(label + ' at ' + round(event.at) + ' ms: runs while the screen is busy, for ' + round(length) + ' ms');
  });
  return failures;
}

// The effect has to run when the screen is free, or "never while busy" would hold for an effect that never plays
function playsWhenFree(log, which) {
  const free = log.events.some(event => !event.busy && (which === 'name' ? event.name : event.hawk !== ''));
  return free ? [] : [(which === 'name' ? 'name glitch' : 'hawk flap') + ' at 0 ms: never ran, even when the screen was free'];
}

function rule(how, which) {
  return {
    name: 'busy/' + (how === 'hold' ? 'held' : how) + '/' + (which === 'name' ? 'name-glitch' : 'hawk-flap') + '-never-runs-while-busy',
    async run(ctx) {
      const log = await ctx.scenario('busy ' + how, () => watch(ctx, how, 4));
      if (log.error) return [log.error];
      return whileBusy(log, which).concat(playsWhenFree(log, which));
    },
  };
}

export const tests = ['hold', 'team-swap', 'blue-screen'].flatMap(how => [rule(how, 'name'), rule(how, 'hawk')]);
