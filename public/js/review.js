/* ==========================================================
   JavaScript Review pages — shared helper
   Save as: public/js/review.js

   This file gives you ONE helper function so you don't have to
   retype the same output code on every card.

       show('out-1', 'Hello', 42);

   ...puts   Hello 42   inside <pre id="out-1" class="output">.

   Everything else on your review page you write yourself.
   ========================================================== */

/**
 * Print one or more values into an output box on the page.
 * @param {string} outputId - the id of the <pre class="output"> element
 * @param {...*} values - any values you want displayed
 */
function show(outputId, ...values) {
    const box = document.getElementById(outputId);

    if (!box) {
        console.error('show(): no element found with id "' + outputId + '"');
        return;
    }

    // Turn each value into readable text, then join with spaces
    const text = values
        .map(v => (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v))
        .join(' ');

    // textContent (not innerHTML) so typed characters stay plain text
    box.textContent = text;
}

/**
 * Add a line to an output box instead of replacing what is there.
 * Useful for loops.
 */
function showLine(outputId, ...values) {
    const box = document.getElementById(outputId);
    if (!box) return;

    const text = values
        .map(v => (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v))
        .join(' ');

    box.textContent += (box.textContent ? '\n' : '') + text;
}

/** Empty an output box. */
function clearOutput(outputId) {
    const box = document.getElementById(outputId);
    if (box) box.textContent = '';
}
