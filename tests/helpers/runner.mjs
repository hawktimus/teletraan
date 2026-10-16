// A few lines shared by the control tests: collect tests, run them, print one line each and a closing line
// the runner reads ("N of N passed").

const tests = [];

export function test(name, body) {
  tests.push({ name: name, body: body });
}

export async function finish() {
  let failures = 0;
  for (const entry of tests) {
    try {
      await entry.body();
      console.log('ok   ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL ' + entry.name + '\n' + (error && error.stack ? error.stack.split('\n').slice(0, 6).join('\n') : error));
    }
  }
  if (failures > 0) {
    console.log(failures + ' failed');
    process.exit(1);
  }
  console.log(tests.length + ' of ' + tests.length + ' passed');
}
