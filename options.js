document.getElementById('save').addEventListener('click', function () {
    const whitelist = document.getElementById('whitelist').value.split(',').map(url => url.trim());
    chrome.storage.sync.set({ whitelist }, function () {
    });
});


// Load existing whitelist on page load
chrome.storage.sync.get('whitelist', function (data) {
    if (data.whitelist) {
        document.getElementById('whitelist').value = data.whitelist.join(', ');
    }
});

