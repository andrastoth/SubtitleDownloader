(function() {
    'use strict';
    var videosTabId = 0;
    var isCollectEnable = false;
    var data = {
        video: [],
        subtitle: []
    };
    chrome.browserAction.onClicked.addListener(function(tab) {
        isCollectEnable = !isCollectEnable;
        chrome.browserAction.setIcon({
            path: isCollectEnable ? 'css/images/icon16.png' : 'css/images/icon16-gray.png'
        });
        chrome.browserAction.setBadgeText({
            text: ''
        });
        if (!isCollectEnable && videosTabId === 0) {
            chrome.tabs.onCreated.addListener(tabCreated);
            chrome.tabs.create({
                url: 'videos.html'
            });
        } else if (videosTabId !== 0) {
            chrome.tabs.remove(videosTabId, function() {
                videosTabId = 0;
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
                return (/\.(mp4|srt|vtt|avi|webm|flv$|mkv|z)/gi).test(item)
            });
        } catch (e) {
            return "";
        }
    }

    function tabCreated(tab) {
        videosTabId = tab.id;
        chrome.tabs.onCreated.removeListener(tabCreated);
        setTimeout(function() {
            chrome.extension.sendMessage({
                order: 'SendDataToVideoTab',
                data: data
            }, null);
            data.video = [];
            data.subtitle = [];
        }, 1000);
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

    function arrayContains(array, item) {
        return (array.length != 0 && array.indexOf(item) > -1);
    }
    chrome.extension.onMessage.addListener(onMessage);
    chrome.webRequest.onBeforeRequest.addListener(function(details) {
        if (isCollectEnable && !(/\.(js)/gi).test(details.url) && (/\.(mp4|srt|vtt|avi|webm|flv$|mkv)/gi).test(details.url)) {
            if ((/\.(vtt|srt)/gi).test(details.url)) {
                if (!arrayContains(data.subtitle, details.url)) {
                    data.subtitle.push(details.url);
                }
            } else {
                if (!arrayContains(data.video, details.url)) {
                    data.video.push(details.url);
                    chrome.browserAction.setIcon({
                        path: 'css/images/icon16-red.png'
                    });
                    chrome.browserAction.setBadgeText({
                        text: data.video.length.toString()
                    });
                }
            }
        } else if (isCollectEnable && !(/\.(js)/gi).test(details.url) && (/\.(googlevideo.com)/gi).test(details.url) && (/&range/gi).test(details.url)) {
            var url = removeParameterFromUrl(details.url, 'range');
            url = removeParameterFromUrl(url, 'rn');
            url = updateUrlParameter(url, 'rbuf', '4096');
            if (!arrayContains(data.video, url)) {
                data.video.push(url);
                chrome.browserAction.setIcon({
                    path: 'css/images/icon16-red.png'
                });
                chrome.browserAction.setBadgeText({
                    text: data.video.length.toString()
                });
            }
        }
    }, {
        urls: ['<all_urls>']
    });
    chrome.tabs.onRemoved.addListener(function(tabid, removed) {
        if (tabid == videosTabId) {
            videosTabId = 0;
        }
    });
})();