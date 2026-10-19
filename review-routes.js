// ==========================================================
// JAVASCRIPT REVIEW ROUTES
//
// Paste this block into server.js in the ROUTES section,
// above the express.static line at the bottom.
//
// These routes are UNPROTECTED on purpose — no requireAuth —
// so classmates can view your review pages without logging in.
// ==========================================================

// The hub page that links to all of your unit pages
app.get('/review', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'review', 'index.html'));
});

// One route that serves every unit page: /review/d1a -> public/review/d1a.html
app.get('/review/:unit', (req, res) => {

    // path.basename() strips any folder characters a visitor might type,
    // so '/review/../../.env' cannot escape the review folder.
    const unit = path.basename(req.params.unit);

    const filePath = path.join(PUBLIC_DIR, 'review', unit + '.html');

    // sendFile's callback runs if the file is missing — send a 404 instead
    // of letting the server throw.
    res.sendFile(filePath, (err) => {
        if (err) {
            res.status(404).send('<h1>404</h1><p>No review page named "' + unit + '" yet.</p>');
        }
    });
});


// ==========================================================
// FOLDER LAYOUT this expects:
//
// public/
// ├── css/
// │   ├── styles.css
// │   └── review.css
// ├── js/
// │   └── review.js
// └── review/
//     ├── index.html      -> /review
//     ├── d1a.html        -> /review/d1a
//     ├── d1b.html        -> /review/d1b
//     ├── d2a.html        -> /review/d2a
//     └── ... one per unit
// ==========================================================
