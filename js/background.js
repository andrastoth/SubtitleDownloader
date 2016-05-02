(function() {
    'use strict';
    var lines = [];

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

    function downloadStarted(downloadItem) {
        if (lines.length) {
            var blob = window.URL.createObjectURL(new Blob([lines.join('\n')], {
                type: 'text/plain;charset=utf-8;'
            }));
            var fileName = downloadItem.filename.current.split('\\').reverse()[0];
            chrome.downloads.download({
                url: blob,
                filename: fileName.split('.')[0].concat('.srt'),
                saveAs: true
            });
            lines = null;
            chrome.downloads.onChanged.removeListener(downloadStarted);
        }
    }

    function clickHandler(index, info, tab) {
        chrome.tabs.sendMessage(tab.id, {
            order: "DownloadVideoAndSub",
            index: index
        }, function(obj) {
            lines = obj.lines;
            chrome.downloads.download({
                url: obj.url,
                filename: (obj.url.split('/').reverse()[0] || 'unknown.webm'),
                saveAs: true
            });
            chrome.downloads.onChanged.addListener(downloadStarted);
        });
    }
    chrome.extension.onMessage.addListener(onMessage);
})();
