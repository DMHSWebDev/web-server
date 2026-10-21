// Shows the visitor count from the server
async function loadStats() {
    const countBox = document.querySelector('#visitor-count');
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        countBox.textContent = data.visitorCount;
    } catch (err) {
        countBox.textContent = 'unavailable';
    }
}

// Lists the 3D designs people sent from the design page
async function loadDesigns() {
    const list = document.querySelector('#design-list');
    try {
        const response = await fetch('/api/designs');
        const designs = await response.json();
        if (designs.length === 0) {
            list.textContent = 'No designs yet.';
            return;
        }
        for (const design of designs) {
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.href = '/api/designs/' + design.id;
            link.textContent = 'Download STL';

            // textContent keeps any HTML in their name or note from running
            const details = [design.name, design.contact, design.note].filter(Boolean).join(' · ');
            item.textContent = `${new Date(design.createdAt).toLocaleString()} - ${details} `;
            item.append(link);
            list.append(item);
        }
    } catch (err) {
        list.textContent = 'Could not load designs.';
    }
}

document.querySelector('#logout-button').addEventListener('click', async () => {
    try {
        await fetch('/logout', { method: 'POST' });
    } catch (err) {
        // Even if this fails, the home page shows the real state
    }
    window.location.href = '/';
});

loadStats();
loadDesigns();
