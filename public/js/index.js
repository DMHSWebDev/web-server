const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const status = document.querySelector('#status');
const loginSection = document.querySelector('#login-section');
const logoutButton = document.querySelector('#logout-button');

// Asks the server whether we are logged in, and shows the right buttons
async function checkAuthState() {
    try {
        const response = await fetch('/api/whoami');
        const data = await response.json();

        if (data.loggedIn) {
            status.innerHTML = '<h1>Welcome back!</h1><a href="/dashboard">Dashboard</a>';
            loginSection.hidden = true;
            logoutButton.hidden = false;
        } else {
            status.innerHTML = '<h1>Welcome!</h1>';
            loginSection.hidden = false;
            logoutButton.hidden = true;
        }
    } catch (err) {
        status.innerHTML = '<h1>Welcome!</h1>';
        loginSection.hidden = false;
        logoutButton.hidden = true;
    }
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginMessage.textContent = '';

    const password = document.querySelector('#password').value;
    const rememberMe = event.target.rememberMe.checked;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, rememberMe })
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            loginMessage.textContent = data.error || 'Login failed. Please check your password.';
            return;
        }

        loginForm.reset();
        checkAuthState();
    } catch (err) {
        loginMessage.textContent = 'Could not reach the server. Check your connection.';
    }
});

logoutButton.addEventListener('click', async () => {
    try {
        await fetch('/logout', { method: 'POST' });
    } catch (err) {
        // Even if this fails, reloading the page shows the real state
    }
    window.location.href = '/';
});

checkAuthState();
