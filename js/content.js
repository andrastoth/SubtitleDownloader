(function() {
    'use strict';
    var ripper = null,
        vid = null;

    function mouseDown(e) {
        if (e.button == 2 && e.target.nodeName.toLowerCase() == 'video') {
            var arr = [];
            vid = e.target;
            ripper = new SubtitleGrabber(e.target);
            ripper.getTextTracks().forEach(function(trk, index) {
                arr.push({
                    index: index,
                    label: trk.label,
                    language: trk.language
                });
            });
            chrome.extension.sendMessage({
                order: 'setContextMenu',
                tracks: arr
            }, null);
        }
    }

    function sendMessage(url, lines) {
        chrome.extension.sendMessage({
            order: 'DownloadVideoAndSubResponse',
            url: url,
            lines: lines
        }, null);
    }

    function onMessage(request, sender, sendResponse) {
        if (request.order == 'DownloadVideoAndSub' && vid) {
            if (request.index === -1) {
                sendMessage(vid.src || vid.querySelector('source').src, []);
            } else {
                ripper.getSrtLines(request.index, 'utf-8', sendMessage.bind(null, vid.src || vid.querySelector('source').src));
                vid = null;
            }
        }
    }
    window.document.addEventListener('mousedown', mouseDown, false);
    chrome.extension.onMessage.addListener(onMessage);
})();