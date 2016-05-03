(function() {
    'use strict';

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
        if (!downloadItem.error && id === downloadItem.id && downloadItem.filename.current) {
            chrome.downloads.onChanged.removeListener(downloadStarted);
            startSubDownload(downloadItem.filename.current, lines);
        }
    }

    function clickHandler(index, info, tab) {
        var lines;
        chrome.tabs.sendMessage(tab.id, {
            order: "DownloadVideoAndSub",
            index: index
        }, function(obj) {
            lines = obj.lines;
            chrome.downloads.download({
                url: obj.url,
                filename: (obj.url.split('/').reverse()[0] || 'unknown.webm'),
                saveAs: true
            }, function(id) {
                chrome.downloads.onChanged.addListener(downloadStarted.bind(null, id, lines));
            });
        });
    }
    chrome.extension.onMessage.addListener(onMessage);
})();