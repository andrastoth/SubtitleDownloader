(function() {
    'use strict';
    var videosTabId = null;
    var isCollectEnable = false;
    var data = [];
    chrome.browserAction.onClicked.addListener(function(tab) {
        isCollectEnable = !isCollectEnable;
        setBadgeText(isCollectEnable ? 'css/images/icon16.png' : 'css/images/icon16-gray.png', '');
        if (!isCollectEnable && !videosTabId) {
            chrome.tabs.create({
                url: 'videos.html'
            }, function(tab) {
                videosTabId = tab.id;
                tabCreated();
            });
        } else if (videosTabId) {
            chrome.tabs.remove(videosTabId, function() {
                videosTabId = null;
            });
        }
    });

    function removeParameterFromUrl(url, parameter) {
        var arr = url.split('&');
        return arr.filter(function(a) {
            return a.indexOf(parameter) == -1
        }).join('&');
    }

    function updateUrlParameter(url, param, value) {
        var regex = new RegExp('(' + param + '=)[^\&]+');
        return url.replace(regex, '$1' + value);
    }

    function getFilename(url) {
        try {
            return url.split(/(\\|\/|=|\?)/g).find(function(item) {
                return (/\.(mp4|srt|vtt|avi|webm|flv$|mkv|ogg|mp3|wav)/gi).test(item)
            });
        } catch (e) {
            return "";
        }
    }

    function tabCreated() {
        setTimeout(function() {
            chrome.extension.sendMessage({
                order: 'SendDataToVideoTab',
                data: data
            }, null);
            data = [];
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
                filename: (getFilename(request.url) || 'unknown.mp4'),
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
        if (isCollectEnable && !(/\.(js)/gi).test(details.url) && (/\.(mp4|srt|vtt|avi|webm|flv$|mkv)/gi).test(details.url)) {
            if ((/\.(vtt|srt)/gi).test(details.url)) {
                if (!arrayContains(data, details.url)) {
                    data.push({
                        type: 'subtitle',
                        url: details.url
                    });
                }
            } else {
                if (!arrayContains(data, details.url)) {
                    data.push({
                        type: 'video',
                        url: details.url
                    });
                    setBadgeText('css/images/icon16-red.png', data.length);
                }
            }
        } else if (isCollectEnable && !(/\.(js)/gi).test(details.url) && (/\.(mp3|ogg|wav)/gi).test(details.url)) {
            if (!arrayContains(data, details.url)) {
                data.push({
                    type: 'audio',
                    url: details.url
                });
                setBadgeText('css/images/icon16-red.png', data.length);
            }
        } else if (isCollectEnable && !(/\.(js)/gi).test(details.url) && (/\.(googlevideo.com)/gi).test(details.url) && (/&rbuf/gi).test(details.url)) {
            var url = removeParameterFromUrl(details.url, 'range');
            url = removeParameterFromUrl(url, 'rn');
            url = updateUrlParameter(url, 'rbuf', '4096');
            if (!arrayContains(data, url)) {
                data.push({
                    type: (/mime=audio/gi).test(url) ? 'audio' : 'video',
                    url: url
                });
                setBadgeText('css/images/icon16-red.png', data.length);
            }
        }
    }
    chrome.extension.onMessage.addListener(onMessage);
    chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, {
        urls: ['<all_urls>']
    });
    chrome.tabs.onRemoved.addListener(function(tabid, removed) {
        if (tabid == videosTabId) {
            videosTabId = null;
        }
    });
})();