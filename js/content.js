(function() {
    'use strict';
    var ripper = null,
        vid = null;
    var SubtitleGrabber = function(selectedVideo) {
        var video = Q(selectedVideo);
        var textTrackList = Array.prototype.slice.call(video.textTracks);
        var srtLines = [];

        function getTracks(callBack) {
            if (typeof callBack === 'function') {
                callBack(textTrackList.filter(function(track) {
                    return track.kind == 'subtitles'
                }));
            }
        }

        function createStrLines(trackIndex) {
            var cues = Array.prototype.slice.call(textTrackList[trackIndex].cues);
            cues.forEach(function(cue, index) {
                processCue(cue, index);
            });
            return srtLines;
        }

        function processCue(cue, index) {
            var startTime = getTimeStr(cue.startTime * 1000);
            var endTime = getTimeStr(cue.endTime * 1000);
            var textLines = cue.text.split('\n');
            srtLines.push(parseInt(index) + 1);
            srtLines.push([startTime, endTime].join(' --> '));
            for (var line in textLines) {
                srtLines.push(textLines[line]);
            }
            srtLines.push('');
        }

        function getTimeStr(time) {
            return new Date(time).toISOString().match(/(\d{2}:\d{2}:\d{2}.\d{3})/)[0].replace('.', ',');
        }

        function downloadSrt(index, filename, encoding) {
            encoding = !!encoding ? encoding : 'utf-8';
            var a = window.document.createElement('a');
            a.href = window.URL.createObjectURL(new Blob([createStrLines(index).join('\n')], {
                type: 'text/plain;charset=' + encoding + ';'
            }));
            a.download = filename;
            a.click();
        }

        function getSrtLines(index, encoding) {
            encoding = !!encoding ? encoding : 'utf-8';
            return index !== -1 ? createStrLines(index) : [];
        }

        function downloadVideo() {
            var save = document.createElement('a');
            save.href = video.src || video.querySelector('source').src;
            save.download = (save.href.split('/').reverse()[0] || 'unknown');
            save.click();
            return save.download;
        }

        function Q(el) {
            if (typeof el === 'string') {
                return document.querySelectorAll(el)[0];
            }
            return el;
        }
        return {
            getTracks: function(callBack) {
                return getTracks(callBack);
            },
            downloadSrt: function(trackIndex, filename, encoding) {
                return downloadSrt(trackIndex, filename, encoding);
            },
            downloadVideo: function() {
                return downloadVideo();
            },
            getSrtLines: function(index, encoding) {
                return getSrtLines(index, encoding);
            }
        };
    };

    function mouseDown(e) {
        if (e.button == 2 && e.target.nodeName.toLowerCase() == 'video') {
            vid = e.target;
            ripper = new SubtitleGrabber(e.target);
            ripper.getTracks(function(tracks) {
                var arr = [];
                tracks.forEach(function(trk, index) {
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
            });
        }
    }

    function onMessage(request, sender, sendResponse) {
        if (request.order == 'DownloadVideoAndSub') {
            var lines = ripper.getSrtLines(request.index, 'utf-8');
            sendResponse({
                url: vid.src || vid.querySelector('source').src,
                lines: lines
            });
        }
    }
    window.document.addEventListener('mousedown', mouseDown, false);
    chrome.extension.onMessage.addListener(onMessage);
})();
