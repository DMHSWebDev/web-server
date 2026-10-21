# Express Server Starter

This is a working web server that includes everything from the lessons so far:

- Login with a password, "Remember me", and log out
- A protected guestbook with names, dates, server validation and safe rendering
- A 404 page and an error handler
- Security headers with Helmet, and all page scripts in `public/js/`
- A NASA Space Picture of the Day page, with your API key kept on the server

Use it to catch up, then pick up where the class is:

1. **Calling an Outside API with a Secret Key:** Part 6 (cache) and Part 7 (route limiter)
2. **Production Readiness Checkup**

## Setup

1. **Check Node.** Run `node -v`. You need version 18 or higher.
2. **Install packages.** In this folder, run:

   ```bash
   npm install
   ```

3. **Create your `.env` file.** Copy `.env.example` to a new file named `.env`, then fill in real values:
   - `SESSION_SECRET`: any long random string
   - `APP_PASSWORD`: the password you will use to log in
   - `NASA_API_KEY`: your free key from api.nasa.gov

4. **Start the server:**

   ```bash
   npm start
   ```

5. **Open** http://localhost:3000 and log in with your `APP_PASSWORD`.

## Make it yours

The pages in `public/` are plain on purpose. Restyle `styles.css`, rewrite the page text, and add your own pages. Keep the element `id`s (like `#guestbook-list` and `#form-error`) the same, because the scripts in `public/js/` use them, and so do the next lessons.

## Deploying to Render

1. Push this folder to a GitHub repo. `.gitignore` already keeps `.env`, `node_modules`, `guestbook.json` and `server.log` out of GitHub.
2. In Render, set the **Build Command** to `npm install` and the **Start Command** to `npm start`.
3. Add `SESSION_SECRET`, `APP_PASSWORD` and `NASA_API_KEY` in Render's **Environment** settings.

## Notes for the next lessons

- **Production Readiness Checkup, Part 6:** this starter has no practice routes, so there is nothing to hide. Read the part, then skip its steps.
- On Render's free plan, `guestbook.json` is erased whenever the server restarts. That is expected, and it gets fixed when we move to a database.
