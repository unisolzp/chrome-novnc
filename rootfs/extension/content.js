let pageLoadData = {};
let isReady = false;

const maxLoadPage = 10000;

const interval = setInterval(function () {
    pageLoadData.force = true;
    sendMessage();
}, maxLoadPage);

chrome.runtime.onMessage.addListener(function (responce) {
    pageLoadData = responce;
    update();
    return true;
});

document.addEventListener('DOMSubtreeModified', update, false);

function update()
{
    if (isReady) {
        return;
    }

    if (!pageLoadData.selector) {
        return;
    }

    if (!document.querySelector(pageLoadData.selector) || !document.querySelector(pageLoadData.selector).textContent.trim()) {
        return;
    }

    isReady = true;

    const isCf = document.querySelector('#cf-content');
    if (isCf) {
        const refreshTime = document.querySelector('meta[http-equiv="refresh"]');
        if (refreshTime) {
            return;
        }
    }


    if (document.title === 'StackPath') {
        return;
    }

    const delay = pageLoadData.delay || 0;
    if (!delay) {
        sendMessage();
    } else {
        setTimeout(sendMessage, delay);
    }
}

function sendMessage()
{
    isReady = true;
    document.removeEventListener('DOMSubtreeModified', update, false);
    clearInterval(interval);

    const obj = {};
    obj.html = document.documentElement.innerHTML;
    obj.href = window.location.href;
    obj.pageLoadData = pageLoadData;

    chrome.extension.sendMessage(obj);
}
