/* ==========================================================
   Domain 1, Part A — Operators & Best Practices
   Save as: public/js/review-d1a.js

   Loaded by: public/review/d1a.html
   Requires:  public/js/review.js  (for show / showLine / clearOutput)

   NOTE: this file is loaded at the END of <body>, so every element
   already exists by the time this code runs.
   ========================================================== */


// ---- Card 1: the five arithmetic operators ----
document.getElementById('btn-arith').addEventListener('click', () => {
    const a = 23;
    const b = 5;

    show('out-arith',
        `${a} + ${b} = ${a + b}\n` +
        `${a} - ${b} = ${a - b}\n` +
        `${a} * ${b} = ${a * b}\n` +
        `${a} / ${b} = ${a / b}\n` +
        `${a} % ${b} = ${a % b}   <-- remainder`
    );
});


// ---- Card 2: modulus finds even and odd ----
document.getElementById('btn-even').addEventListener('click', () => {
    // .value is always a string, so convert before doing math
    const num = Number(document.getElementById('num-input').value);

    if (isNaN(num)) {
        show('out-even', 'That is not a number.');
        return;
    }

    const remainder = num % 2;
    const label = remainder === 0 ? 'EVEN' : 'ODD';

    show('out-even', `${num} % 2 = ${remainder}  ->  ${num} is ${label}`);
});


// ---- Card 3: the + problem ----
document.getElementById('btn-plus').addEventListener('click', () => {
    const first = document.getElementById('val-1').value;    // string
    const second = document.getElementById('val-2').value;   // string

    show('out-plus',
        `'${first}' + '${second}' = ${first + second}      <-- joined\n` +
        `'${first}' - '${second}' = ${first - second}\n` +
        `'${first}' * '${second}' = ${first * second}\n` +
        `Number() + Number() = ${Number(first) + Number(second)}   <-- the fix`
    );
});


// ---- Card 4: prefix vs. postfix increment ----
document.getElementById('btn-inc').addEventListener('click', () => {
    let x = 5;
    const a = x++;      // postfix: hand back the old value, THEN add

    let y = 5;
    const b = ++y;      // prefix: add first, THEN hand back

    show('out-inc',
        `postfix:  let a = x++;   a is ${a}, x is ${x}\n` +
        `prefix:   let b = ++y;   b is ${b}, y is ${y}`
    );
});


// ---- Card 5: compound assignment ----
document.getElementById('btn-compound').addEventListener('click', () => {
    let x = 20;

    clearOutput('out-compound');

    showLine('out-compound', `start:   x = ${x}`);
    x += 5;  showLine('out-compound', `x += 5   x = ${x}`);
    x -= 3;  showLine('out-compound', `x -= 3   x = ${x}`);
    x *= 2;  showLine('out-compound', `x *= 2   x = ${x}`);
    x /= 4;  showLine('out-compound', `x /= 4   x = ${x}`);
    x %= 4;  showLine('out-compound', `x %= 4   x = ${x}`);
});


// ---- Card 6: = vs == vs === ----
document.getElementById('btn-equals').addEventListener('click', () => {
    const level = 5;

    show('out-equals',
        `level is the number ${level}\n\n` +
        `level == '5'   ->  ${level == '5'}    (value only)\n` +
        `level === '5'  ->  ${level === '5'}   (value AND type)\n` +
        `level === 5    ->  ${level === 5}\n\n` +
        `typeof level is '${typeof level}', typeof '5' is '${typeof '5'}'`
    );
});


// ---- Card 7: naming and best practices ----
document.getElementById('btn-names').addEventListener('click', () => {
    const MAX_TRIES = 3;    // never reassigned -> const
    let attempts = 0;       // changes as we go -> let

    attempts++;
    attempts++;

    show('out-names',
        `MAX_TRIES is ${MAX_TRIES}  (const — reassigning it throws an error)\n` +
        `attempts is ${attempts}  (let — safe to change)\n` +
        `tries left: ${MAX_TRIES - attempts}`
    );
});
