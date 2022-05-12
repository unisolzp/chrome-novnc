(async function () {

    let serverName = 'Chrome1';
    const socket = await initSocket();
    const socket1 = socket;

    const data = {};
    const ignoreDomains = [
        'connect.facebook.net',
        'www.gstatic.com',
        'www.google.com',
        'www.google-analytics.com',
        'www.googletagmanager.com',
        'trackcmp.net'
    ];

    async function setServerName()
    {
        try {
            const ip = (await fetch('https://api.ipify.org/?format=json').then(response => response.json())).ip;
            if (ip) {
                serverName = ip;
            }
        } catch (e) {
            console.log(e);
        }
    }

    async function initSocket()
    {
        await setServerName();
        // const url = 'http://localhost:3008';
        const url = 'http://206.81.24.142:3008';

        const socketOptions = {
            reconnection        : true,
            reconnectionDelay   : 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 10,
            query               : {
                serverName: serverName,
            },
        };

        const socket = io.connect(url, socketOptions);
        socket.on('connect', function (m) {
            console.log("socket.io connection open");
        });
        socket.on('connect_failed', function () {
            console.log("connect_failed, Sorry, there seems to be an issue with the connection!");
        });
        socket.on('connect_error', function (m) {
            console.log("connect_error, Sorry, there seems to be an issue with the connection!");
        });
        socket.on("disconnect", (reason) => {

        });
        socket.on("parsePage", scrapeUrl);

        return socket;
    }

    function scrapeUrl(json)
    {
        const _data = JSON.parse(json);

        const tabParams = {
            url   : _data.url,
            active: false,
        };

        const {hostname} = new URL(tabParams.url);

        chrome.windows.create({
            focused: false,
            width  : 600,
            height : 400,
            left   : 0,
            top    : 100,
            url    : _data.url,
            type   : "popup"
        }, function (popup) {

            const tabId = popup.tabs[0].id;

            socket.emit('chromeTabInfo', JSON.stringify({
                'chrome_extension_url_id': _data.chrome_extension_url_id,
                'server_name'            : serverName,
                'count_tabs'             : Object.keys(data).length,
                'open_tab'               : {
                    'tabId'    : tabId,
                    'init_time': Date.now()
                },
            }));

            const chromeDefaultParams = {
                chrome_params: {
                    delay          : 50,
                    selector       : 'html',
                    blockingRequest: true,
                    originPage     : false,
                }
            }

            _data.chrome_params = {...chromeDefaultParams.chrome_params, ..._data.chrome_params};

            if (_data.chrome_params.blockingRequest === 'false') {
                _data.chrome_params.blockingRequest = false;
            }

            const origin = {
                ..._data, ...{originUrl: tabParams.url, hostname: hostname}
            }

            data[tabId] = {
                origin: origin
            };

            data[tabId].forceTabId = setTimeout(() => {
                nodeChromeTabRequest({href: tabParams.url, forceClose: true, origin: origin}, tabId);
            }, 1000 * 13);
        });
    }

    function nodeChromeTabRequest(pageData, tabId)
    {

        const tabData = data[tabId];

        try {
            const _data = {...tabData, ...pageData};
            if (!_data['responseHeaders']) {
                _data['responseHeaders'] = [];
            }

            const chromeExtensionUrlId = _data && _data.origin && _data.origin.chrome_extension_url_id;

            _data.status = (_data['responseHeaders'][_data['responseHeaders'].length - 1] || [])['statusCode'] || 200;
            _data.serverName = serverName;

            socket.emit('nodeChromeTabRequest', JSON.stringify(_data));

            delete data[tabId];

            if (!pageData.tabClose) {
                chrome.tabs.remove(tabId);
            }

            if (tabData && tabData.forceTabId) {
                clearTimeout(tabData.forceTabId);
            }

            socket.emit('chromeTabInfo', JSON.stringify({
                'chrome_extension_url_id': chromeExtensionUrlId,
                'count_tabs'             : Object.keys(data).length,
                'server_name'            : serverName,
                'remove_tab'             : {
                    'tabId'      : tabId,
                    'init_time'  : Date.now(),
                    'tabClose'   : pageData.tabClose,
                    'forceClose' : pageData.forceClose,
                    'tabReplaced': pageData.tabReplaced
                },

            }));

        } catch (e) {
            const sendData = {
                'error'      : e.message,
                'pageData'   : pageData,
                'data'       : data,
                'server_name': serverName,
            };
            socket.emit('chromeTabInfo', JSON.stringify(sendData));
        }

        return true;
    }

    function fillHeaders(e)
    {
        const _tab = data[e.tabId];
        if (!_tab) {
            return;
        }
        if (!_tab['responseHeaders']) {
            _tab['responseHeaders'] = [];
        }
        _tab['responseHeaders'].push(e);
    }

    function blockingRequest(e)
    {
        const _tab = data[e.tabId];
        if (!_tab) {
            return;
        }

        const _origin = _tab.origin;

        if (_origin.chrome_params.originPage) {
            return;
        }

        if (["image", "font", "ping", "stylesheet", "other"].indexOf(e.type) !== -1) {
            return {
                cancel: true
            };
        }

        const {hostname} = new URL(e.url);
        let originHost = _tab.origin.hostname;

        if (e.type === 'main_frame') {
            e.hostname = hostname;
            _origin.mainFrame = e;
        }

        if (_origin.mainFrame && _origin.mainFrame.hostname) {
            originHost = _origin.mainFrame.hostname;
        }

        if (ignoreDomains.indexOf(hostname) > -1) {
            return {
                cancel: true
            };
        }

        if (["xmlhttprequest", 'script'].indexOf(e.type) !== -1 && originHost !== hostname && hostname.indexOf(originHost.replace('www.', '')) === -1) {

            // console.log(originHost, hostname);

            if (_origin.chrome_params.blockingRequest) {
                return {
                    cancel: true
                };
            }
        }

        // console.log(details.type + '  ' + details.url);
    }

    function tabUpdated(tabId, changeInfo, tab)
    {
        const tabData = data[tabId];

        if (!tabData) {
            return;
        }

        if ("complete" === changeInfo.status) {

            chrome.browserAction.enable(tabId);

            const delay = tabData.origin.chrome_params.delay;
            const selector = tabData.origin.chrome_params.selector;

            chrome.tabs.sendMessage(tab.id, {selector, delay});

        } else if ("loading" === changeInfo.status) {
            chrome.browserAction.disable(tabId);
        }
    }

    chrome.webRequest.onCompleted.addListener(fillHeaders,
        {
            urls : ["http://*/*", "https://*/*"],
            types: ["main_frame"]
        },
        ["responseHeaders"]
    );

    chrome.webRequest.onBeforeRequest.addListener(blockingRequest,
        {
            urls: ["http://*/*", "https://*/*"],
        },
        ["blocking"]
    );

    chrome.extension.onMessage.addListener(function (pageData, sender, sendResponse) {
        nodeChromeTabRequest(pageData, sender.tab.id)
    });

    chrome.browserAction.onClicked.addListener(function (tab) {
        scrapeUrl(JSON.stringify({url: tab.url, fnName: 'fake', chrome_params: {d: 540}}));
    });

    chrome.webNavigation.onTabReplaced.addListener(function (e) {
        if (data[e.replacedTabId]) {
            nodeChromeTabRequest({tabReplaced: true}, e.replacedTabId);
        }
    });

    chrome.tabs.onRemoved.addListener(function (tabId) {
        if (data[tabId]) {
            nodeChromeTabRequest({tabClose: true}, tabId);
        }
    });

    chrome.tabs.onUpdated.addListener(tabUpdated);

})()
