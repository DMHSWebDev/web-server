/* ==========================================================
   JavaScript Review — STARTER SCRIPT
   Copy this file to:  public/js/review-d__.js
   (match your page, e.g. review-d2a.js for d2a.html)

   Then link it at the bottom of your HTML page:
       <script src="/js/review.js"></script>
       <script src="/js/review-d2a.js"></script>

   Helpers available from review.js:
       show(outputId, value)       replaces the output box
       showLine(outputId, value)   adds a line (good for loops)
       clearOutput(outputId)       empties it first

   RULE: no inline JavaScript. Every line of code lives in this file,
   and the HTML only points at it with a src attribute.
   ========================================================== */


// ---- Card 1 ----
document.getElementById('btn-one').addEventListener('click', () => {

    // --- your demo code goes here ---
    let example = 10;

    show('out-one', 'example is ' + example);
});


// ---- Card 2 (with an input) ----
document.getElementById('btn-two').addEventListener('click', () => {

    // .value is ALWAYS a string — convert it if you need a number
    const typed = document.getElementById('input-two').value;

    show('out-two', 'You typed: ' + typed + ' (type: ' + typeof typed + ')');
});


// ---- Card 3 ----
// document.getElementById('btn-three').addEventListener('click', () => {
//
//     show('out-three', '...');
// });


// ---- Card 4 ----


// ---- Card 5 ----


/* ==========================================================
   TROUBLESHOOTING

   "Cannot read properties of null (reading 'addEventListener')"
       The id in this file does not match an id in your HTML.
       Check the spelling, and make sure every id is unique.

   Nothing happens when you click
       Open DevTools (F12) and look at the Console tab.
       Also confirm the <script src> path matches this file's name.

   "show is not defined"
       review.js is missing, or it is listed AFTER this file.
       review.js must load first.
   ========================================================== */
