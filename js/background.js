(function() {
    'use strict';
    var videosTabId = null,
        state = 0,
        isCollectEnable = false,
        data = [];
    chrome.browserAction.onClicked.addListener(function(tab) {
        switch (++state) {
            case 1:
                isCollectEnable = true;
                setBadgeText('css/images/icon48.png', '');
                videosTabId = null;
                break;
            case 2:
                isCollectEnable = true;
                setBadgeText('css/images/icon48-blue.png', '');
                chrome.tabs.create({
                    url: 'videos.html'
                }, function(tab) {
                    videosTabId = tab.id;
                    updateVideoTab();
                });
                break;
            case 3:
                setBadgeText('css/images/icon48-gray.png', '');
                chrome.tabs.remove(videosTabId, null);
                break;
        }
    });

    function removeUrlParameters(url, parameters) {
        var arr = url.split('&');
        return arr.filter(function(u) {
            return !parameters.find(function(p) {
                return u.indexOf(p) == 0
            });
        }).join('&');
    }

    function updateUrlParameter(url, param, value) {
        var regex = new RegExp('(' + param + '=)[^\&]+');
        return url.replace(regex, '$1' + value);
    }

    function getFilename(url) {
        try {
            var name = url.split(/(\\|\/|=|\?)/g).find(function(item) {
                return (/\.(mp4|srt|vtt|avi|webm|flv$|mkv|ogg|mp3|wav)/gi).test(item)
            });
            return name ? name : 'unknown.mp4';
        } catch (e) {
            return "unknown.mp4";
        }
    }

    function updateVideoTab(dt) {
        setTimeout(function() {
            chrome.extension.sendMessage({
                order: 'SendDataToVideoTab',
                data: dt ? [dt] : data
            }, null);
            if (!dt) {
                data = [];
            }
        }, 300);
    }

    function onMessage(request, sender, sendResponse) {
        if (request.order == 'setContextMenu') {
            chrome.contextMenus.removeAll(function() {
                chrome.contextMenus.create({
                    "title": "Download video only",
                    "contexts": ["video"],
                    "onclick": clickHandler.bind(null, -1)
                });
                request.tracks.forEach(function(trk, index) {
                    chrome.contextMenus.create({
                        "title": "Download video and " + (trk.language ? trk.language : trk.label) + " subtitle",
                        "contexts": ["video"],
                        "onclick": clickHandler.bind(null, index)
                    });
                });
            });
        }
        if (request.order == 'DownloadVideoAndSubResponse') {
            var lines = request.lines;
            chrome.downloads.download({
                url: request.url,
                filename: getFilename(request.url),
                saveAs: true
            }, function(id) {
                chrome.downloads.onChanged.addListener(downloadStarted.bind(null, id, lines));
            });
        }
    }

    function startSubDownload(filename, lines) {
        if (lines && lines.length) {
            var blob = window.URL.createObjectURL(new Blob([lines.join('\n')], {
                type: 'text/plain;charset=utf-8;'
            }));
            var fileName = filename.split('\\').reverse()[0];
            chrome.downloads.download({
                url: blob,
                filename: fileName.split('.')[0].concat('.srt'),
                saveAs: true
            });
        }
    }

    function downloadStarted(id, lines, downloadItem) {
        if (!downloadItem.error && id === downloadItem.id && downloadItem.filename && downloadItem.filename.current) {
            chrome.downloads.onChanged.removeListener(downloadStarted);
            startSubDownload(downloadItem.filename.current, lines);
        }
    }

    function clickHandler(index, info, tab) {
        var lines;
        chrome.tabs.sendMessage(tab.id, {
            order: "DownloadVideoAndSub",
            index: index
        }, null);
    }

    function setBadgeText(icon, txt) {
        chrome.browserAction.setIcon({
            path: icon
        });
        chrome.browserAction.setBadgeText({
            text: txt.toString()
        });
    }

    function arrayContains(array, item) {
        return array.length != 0 && array.find(function(elem) {
            return elem.url.indexOf(item) > -1
        });
    }

    function onBeforeRequest(details) {
        if (isCollectEnable || videosTabId) {
            if (!(/\.(js)/gi).test(details.url) && (/\.(mp4|srt|vtt|avi|webm|flv$|mkv)/gi).test(details.url)) {
                if ((/\.(vtt|srt)/gi).test(details.url)) {
                    if (!arrayContains(data, details.url)) {
                        data.push({
                            date: new Date().getTime(),
                            type: 'subtitle',
                            url: details.url
                        });
                        if (videosTabId) {
                            updateVideoTab(data[data.length - 1]);
                        }
                        setBadgeText('css/images/icon48-red.png', data.length);
                    }
                } else {
                    if (!arrayContains(data, details.url)) {
                        data.push({
                            date: new Date().getTime(),
                            type: 'video',
                            url: details.url
                        });
                        if (videosTabId) {
                            updateVideoTab(data[data.length - 1]);
                        }
                        setBadgeText('css/images/icon48-red.png', data.length);
                    }
                }
            } else if (!(/\.(js)/gi).test(details.url) && (/\.(mp3|ogg|wav)/gi).test(details.url)) {
                if (!arrayContains(data, details.url)) {
                    data.push({
                        date: new Date().getTime(),
                        type: 'audio',
                        url: details.url
                    });
                    if (videosTabId) {
                        updateVideoTab(data[data.length - 1]);
                    }
                    setBadgeText('css/images/icon48-red.png', data.length);
                }
            } else if (!(/\.(js)/gi).test(details.url) && (/\.(googlevideo.com)/gi).test(details.url) && (/&rbuf/gi).test(details.url)) {
                var url = removeUrlParameters(details.url, ['range=', 'rn=', 'rbuf=', 'cpn=', 'c=', 'cver=']);
                if (!arrayContains(data, url)) {
                    data.push({
                        date: new Date().getTime(),
                        type: (/mime=audio/gi).test(url) ? 'audio' : 'video',
                        url: url
                    });
                    if (videosTabId) {
                        updateVideoTab(data[data.length - 1]);
                    }
                    setBadgeText('css/images/icon48-red.png', data.length);
                }
            }
        }
    }
    chrome.extension.onMessage.addListener(onMessage);
    chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, {
        urls: ['<all_urls>']
    });
    chrome.tabs.onRemoved.addListener(function(tabid, removed) {
        if (tabid == videosTabId) {
            setBadgeText('css/images/icon48-gray.png', '');
            isCollectEnable = false;
            state = 0;
            videosTabId = null;
            data = [];
        }
    });
    chrome.webRequest.onHeadersReceived.addListener(function(info) {
        if (info.tabId == videosTabId) {
            var headers = info.responseHeaders;
            for (var i = headers.length - 1; i >= 0; --i) {
                var header = headers[i].name.toLowerCase();
                if (header == 'x-frame-options' || header == 'frame-options') {
                    headers.splice(i, 1);
                }
            }
            return {
                responseHeaders: headers
            };
        }
    }, {
        urls: ['*://*/*'],
        types: ['sub_frame']
    }, ['blocking', 'responseHeaders']);
})();