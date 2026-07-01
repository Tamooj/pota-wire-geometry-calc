// Minimal in-browser test harness — no dependencies, no build step.
// Open a tests/*.html file directly in a browser (or via a local static
// server) and read the pass/fail dashboard rendered on the page.
(function () {
  const queue = [];
  let currentSuite = '';

  function suite(name) {
    currentSuite = name;
  }

  function test(desc, fn) {
    queue.push({ suite: currentSuite, desc, fn });
  }

  function fail(message) {
    throw new Error(message);
  }

  const assert = {
    equal(actual, expected, message) {
      if (actual !== expected) {
        fail(message || `expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
      }
    },
    notEqual(actual, expected, message) {
      if (actual === expected) {
        fail(message || `expected ${JSON.stringify(actual)} to not equal ${JSON.stringify(expected)}`);
      }
    },
    close(actual, expected, tolerance, message) {
      tolerance = tolerance === undefined ? 1e-6 : tolerance;
      if (Math.abs(actual - expected) > tolerance) {
        fail(message || `expected ${actual} to be within ${tolerance} of ${expected}`);
      }
    },
    isTrue(value, message) {
      if (value !== true) fail(message || `expected true, got ${JSON.stringify(value)}`);
    },
    isFalse(value, message) {
      if (value !== false) fail(message || `expected false, got ${JSON.stringify(value)}`);
    },
    isAbove(value, floor, message) {
      if (!(value > floor)) fail(message || `expected ${value} to be above ${floor}`);
    },
  };

  async function run() {
    const results = [];
    for (const item of queue) {
      try {
        await item.fn();
        results.push({ ...item, pass: true });
      } catch (err) {
        results.push({ ...item, pass: false, error: err.message || String(err) });
      }
    }
    render(results);
    return results;
  }

  function render(results) {
    const root = document.getElementById('results') || document.body;
    const passCount = results.filter(r => r.pass).length;
    const failCount = results.length - passCount;
    let html = `<div style="font:14px monospace; margin-bottom:12px;">
      <strong>${passCount}/${results.length} passed</strong>
      ${failCount ? `<span style="color:#c0392b;"> — ${failCount} FAILED</span>` : ''}
    </div>`;
    let lastSuite = null;
    results.forEach(r => {
      if (r.suite !== lastSuite) {
        html += `<div style="font:bold 13px monospace; margin-top:10px;">${r.suite}</div>`;
        lastSuite = r.suite;
      }
      html += `<div style="font:12px monospace; color:${r.pass ? '#2e7d32' : '#c0392b'};">
        ${r.pass ? 'PASS' : 'FAIL'} — ${r.desc}${r.pass ? '' : ' :: ' + r.error}
      </div>`;
    });
    root.innerHTML = html;
    // Expose a simple machine-readable summary for automated checking (e.g. preview_eval).
    window.__TEST_SUMMARY__ = { total: results.length, passed: passCount, failed: failCount };
  }

  window.suite = suite;
  window.test = test;
  window.assert = assert;
  window.runTests = run;
})();
