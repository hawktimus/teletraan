// The first script of the page (index.html loads it before anything else). It is a plain script, not a module, so that
// it runs even when a module fails to load.
//
// On a wall nobody reads an error message: it only spoils the screen. A script error, a promise nobody caught and a
// request that failed are written to the console, where a person at a laptop can read them, and nowhere else. This
// file draws nothing and the page never reads what it logs.
(function () {
  window.onerror = function (message, source, line) {
    console.error('A script error was kept off the screen:', message, source, line);
    return true;
  };

  window.addEventListener('unhandledrejection', function (event) {
    console.error('A promise error was kept off the screen:', event && event.reason);
    if (event && event.preventDefault) event.preventDefault();
  });

  if (typeof window.fetch === 'function') {
    var original = window.fetch.bind(window);
    window.fetch = function () {
      var request = original.apply(null, arguments);
      // This watches the request. The caller still gets the same promise and the same failure.
      request.catch(function (error) {
        console.error('A request failed, kept off the screen:', error && error.message);
      });
      return request;
    };
  }
})();
