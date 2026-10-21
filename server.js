require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const LOG_FILE = path.join(__dirname, 'server.log');
const GUESTBOOK_FILE = path.join(__dirname, 'guestbook.json');
const DESIGNS_DIR = path.join(__dirname, 'designs');

let visitorCount = 0;

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Reads the guestbook file, or returns an empty list if nobody has posted yet
function getGuestbookMessages() {
    if (!fs.existsSync(GUESTBOOK_FILE)) return [];
    return JSON.parse(fs.readFileSync(GUESTBOOK_FILE, 'utf8'));
}

// Returns an error message string, or null if the entry is valid
function validateEntry(name, msg) {
    if (typeof name !== 'string' || typeof msg !== 'string') {
        return 'Name and message must be text.';
    }
    if (name.trim().length < 1 || name.trim().length > 40) {
        return 'Name must be 1 to 40 characters.';
    }
    if (msg.trim().length < 1 || msg.trim().length > 280) {
        return 'Message must be 1 to 280 characters.';
    }
    return null;
}

// Returns an error message, or null if the date is OK
function validateApodDate(date) {
    if (date === undefined) return null; // no date means today

    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return 'Date must look like YYYY-MM-DD.';
    }

    // new Date() quietly rolls Feb 30 over to Mar 2, so convert it
    // back to text and check that it did not change
    const parsed = new Date(date + 'T00:00:00Z');
    if (isNaN(parsed) || parsed.toISOString().slice(0, 10) !== date) {
        return 'That is not a real date.';
    }

    if (date < '1995-06-16') {
        return 'The first picture is from 1995-06-16.';
    }

    const today = new Date().toISOString().slice(0, 10);
    if (date > today) {
        return 'That date is in the future.';
    }

    return null;
}

// The design page has a small inline <script type="importmap">. Our security
// headers block inline scripts, so we allow that one by its fingerprint
// (hash). It's worked out here at startup, so editing the map just works.
function getImportMapHash() {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, 'design.html'), 'utf8');
    const match = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    if (!match) return null;
    const hash = crypto.createHash('sha256').update(match[1]).digest('base64');
    return `'sha256-${hash}'`;
}

// Returns an error message, or null if the bytes look like a binary STL file.
// A binary STL is an 80-byte header, a 4-byte triangle count, then 50 bytes
// per triangle - so the size has to match the count exactly.
function validateStl(body) {
    if (!Buffer.isBuffer(body) || body.length < 84) {
        return 'That is not an STL file.';
    }
    const triangles = body.readUInt32LE(80);
    if (triangles === 0 || body.length !== 84 + triangles * 50) {
        return 'That is not an STL file.';
    }
    return null;
}

// Returns an error message, or null if the sender's details are OK
function validateDesignInfo(name, contact, note) {
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 40) {
        return 'Name must be 1 to 40 characters.';
    }
    if (typeof contact !== 'string' || contact.length > 100) {
        return 'Contact must be 100 characters or less.';
    }
    if (typeof note !== 'string' || note.length > 500) {
        return 'Notes must be 500 characters or less.';
    }
    return null;
}

// ==========================================
// MIDDLEWARE SETUP
// Each function below runs on every request, then calls next() to pass
// it along - like a checkpoint before your routes.
// ==========================================

// Trust the X-Forwarded-For header set by hosts like Render, so the rate
// limiter sees each visitor's real IP instead of the proxy's
app.set('trust proxy', 1);

// Security headers on every response. NASA's image server is allowed
// so the space page can show pictures, and the design page's import map
// is allowed by its hash.
const scriptSources = ["'self'"];
const importMapHash = getImportMapHash();
if (importMapHash) scriptSources.push(importMapHash);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            'img-src': ["'self'", 'data:', 'https://assets.science.nasa.gov'],
            'script-src': scriptSources
        }
    }
}));

// Parse incoming form data and JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Logs every request to the console and to server.log
app.use((req, res, next) => {
    const logLine = `[${new Date().toISOString()}] ${req.method} ${req.path}\n`;
    console.log(logLine.trim());
    fs.appendFile(LOG_FILE, logLine, (err) => {
        if (err) console.error('Log write failed:', err);
    });
    next();
});

// Rate limiter - blocks an IP with a 429 response if it sends too many
// requests within the time window
const limiter = rateLimit({
    windowMs: 10 * 1000, // 10 second window
    limit: 100,          // max requests per window, per IP
    message: '<h1>429 Too Many Requests</h1><p>Please wait 10 seconds.</p>'
});
app.use(limiter);

// Tracks logged-in users with a signed cookie. Requires SESSION_SECRET in .env.
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 15 * 60 * 1000 } // session expires after 15 minutes
}));

// Route guard - use this on any route that should require login
function requireAuth(req, res, next) {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ error: 'Please log in first.' });
    }
    next();
}

// ==========================================
// ROUTES
// ==========================================

// ----- Pages -----

app.get('/', (req, res) => {
    visitorCount++;
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
});

app.get('/guestbook', requireAuth, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'guestbook.html'));
});

app.get('/design', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'design.html'));
});

// ----- Logging in and out -----

// Checks the password against .env; marks the session logged in if correct
app.post('/login', (req, res) => {
    const { password, rememberMe } = req.body;
    if (password === process.env.APP_PASSWORD) {
        req.session.isAuthenticated = true;
        if (rememberMe) {
            req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        }
        return res.json({ success: true });
    }
    res.status(401).json({ success: false, error: 'Incorrect password' });
});

// Destroys the session, so the user is logged out
app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// Tells the frontend whether the visitor is logged in
app.get('/api/whoami', (req, res) => {
    res.json({ loggedIn: !!req.session.isAuthenticated });
});

// ----- Site stats -----

app.get('/api/stats', (req, res) => {
    res.set('Cache-Control', 'no-store'); // always get a fresh count
    res.json({ visitorCount });
});

// ----- Guestbook API -----

app.get('/api/guestbook', requireAuth, (req, res) => {
    res.json(getGuestbookMessages());
});

app.post('/api/guestbook', requireAuth, (req, res) => {
    const { name, msg } = req.body;

    const error = validateEntry(name, msg);
    if (error) {
        return res.status(400).json({ error: error });
    }

    const entry = {
        id: crypto.randomUUID(),
        name: name.trim(),
        msg: msg.trim(),
        createdAt: new Date().toISOString()
    };

    const messages = getGuestbookMessages();
    messages.push(entry);
    fs.writeFileSync(GUESTBOOK_FILE, JSON.stringify(messages.slice(-50), null, 2));

    res.status(201).json(entry);
});

// ----- 3D designs sent in for printing -----

// Sending a design is open to everyone, so keep it to a few per visitor
const designLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minute window
    limit: 5,
    message: { error: 'You have sent a lot of designs. Please wait a few minutes.' }
});

// The STL file is the request body; name, contact, and note are in the query
app.post('/api/designs', designLimiter, express.raw({ type: 'model/stl', limit: '20mb' }), (req, res) => {
    const { name, contact = '', note = '' } = req.query;

    const infoError = validateDesignInfo(name, contact, note);
    if (infoError) {
        return res.status(400).json({ error: infoError });
    }
    const stlError = validateStl(req.body);
    if (stlError) {
        return res.status(400).json({ error: stlError });
    }

    const design = {
        id: crypto.randomUUID(),
        name: name.trim(),
        contact: contact.trim(),
        note: note.trim(),
        sizeBytes: req.body.length,
        createdAt: new Date().toISOString()
    };

    // Each design is saved as two files: the model, and its details
    fs.mkdirSync(DESIGNS_DIR, { recursive: true });
    fs.writeFileSync(path.join(DESIGNS_DIR, design.id + '.stl'), req.body);
    fs.writeFileSync(path.join(DESIGNS_DIR, design.id + '.json'), JSON.stringify(design, null, 2));

    res.status(201).json({ id: design.id });
});

// Lists the designs people have sent, newest first
app.get('/api/designs', requireAuth, (req, res) => {
    if (!fs.existsSync(DESIGNS_DIR)) return res.json([]);

    const designs = fs.readdirSync(DESIGNS_DIR)
        .filter((file) => file.endsWith('.json'))
        .map((file) => JSON.parse(fs.readFileSync(path.join(DESIGNS_DIR, file), 'utf8')))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(designs);
});

// Downloads one design's STL file
app.get('/api/designs/:id', requireAuth, (req, res) => {
    // Only allow real IDs, so nobody can ask for ../server.js
    if (!/^[0-9a-f-]{36}$/.test(req.params.id)) {
        return res.status(404).json({ error: 'Not found' });
    }
    const file = path.join(DESIGNS_DIR, req.params.id + '.stl');
    if (!fs.existsSync(file)) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.download(file, `design-${req.params.id.slice(0, 8)}.stl`);
});

// ----- NASA picture of the day -----

app.get('/api/space', async (req, res) => {
    const { date } = req.query;

    const dateError = validateApodDate(date);
    if (dateError) {
        return res.status(400).json({ error: dateError });
    }

    if (!process.env.NASA_API_KEY) {
        throw new Error('NASA_API_KEY is missing from .env');
    }

    // NASA has one address for the latest pictures, and another for one day.
    // The one-day address uses the date as YYMMDD: 2025-07-04 becomes 250704
    let address = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic/';
    if (date) {
        const shortDate = date.slice(2).replaceAll('-', '');
        address = address + shortDate;
    }

    // Add the secret key on the server
    const nasaUrl = new URL(address);
    nasaUrl.searchParams.set('api_key', process.env.NASA_API_KEY);

    let nasaResponse;
    try {
        // Give up if NASA takes longer than 8 seconds
        nasaResponse = await fetch(nasaUrl, { signal: AbortSignal.timeout(8000) });
    } catch (err) {
        return res.status(502).json({ error: 'Could not reach NASA. Try again later.' });
    }

    if (nasaResponse.status === 404) {
        return res.status(404).json({ error: 'NASA has no picture for that date.' });
    }
    if (!nasaResponse.ok) {
        console.error('NASA error:', nasaResponse.status);
        return res.status(502).json({ error: 'NASA could not send a picture right now.' });
    }

    const data = await nasaResponse.json();

    // With a date, NASA sends one picture. Without one, it sends a list,
    // and the first item is the newest.
    const picture = Array.isArray(data) ? data[0] : data;

    // Send back only what our page needs, with names we chose
    res.json({
        title: picture.title,
        date: picture.date,
        imageUrl: picture.hdurl,
        description: picture.alt,
        nasaPage: picture.permalink
    });
});

// ==========================================
// STATIC FILES
// Serves everything in /public (put this AFTER your routes)
// `extensions: ['html']` lets /space find space.html without the extension
// ==========================================
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// The 3D libraries the design page loads, straight from node_modules
const NODE_MODULES = path.join(__dirname, 'node_modules');
app.use('/vendor/three/build', express.static(path.join(NODE_MODULES, 'three/build')));
app.use('/vendor/three/examples/jsm', express.static(path.join(NODE_MODULES, 'three/examples/jsm')));
app.use('/vendor/three-mesh-bvh/build', express.static(path.join(NODE_MODULES, 'three-mesh-bvh/build')));
app.use('/vendor/three-bvh-csg/build', express.static(path.join(NODE_MODULES, 'three-bvh-csg/build')));

// ==========================================
// 404 HANDLER - runs only if no route or static file answered
// ==========================================
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

// ==========================================
// ERROR HANDLER - the 4 parameters tell Express this handles errors
// ==========================================
app.use((err, req, res, next) => {
    // Full details go to YOU, in the console and the log file
    const time = new Date().toISOString();
    console.error(`[${time}] ERROR ${req.method} ${req.path}`, err);
    fs.appendFile(LOG_FILE, `[${time}] ERROR ${req.method} ${req.path}: ${err.message}\n`, () => {});

    // If a response already started sending, let Express finish up
    if (res.headersSent) return next(err);

    // Errors with a status under 500 are the user's fault and safe to explain.
    // Anything else is our fault, so hide the details.
    const status = err.status || 500;
    const message = status < 500 ? err.message : 'Something went wrong on our end.';

    if (req.path.startsWith('/api/')) {
        return res.status(status).json({ error: message });
    }
    res.status(status).send('<h1>Something went wrong</h1><p>Please try again later.</p><a href="/">Back to home</a>');
});

app.listen(PORT, () => console.log(`Server live on http://localhost:${PORT}`));
