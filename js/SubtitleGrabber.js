var SubtitleGrabber = function(selectedVideo) {
    var video = Q(selectedVideo);
    var srtLines = [];

    function getTextTracks() {
        if (video.textTracks.length) {
            return Array.prototype.slice.call(video.textTracks).filter(function(track) {
                return track.kind == 'subtitles'
            });
        }
        return [];
    }

    function initTextTracks(type, index, encoding, param) {
        if (video.textTracks.length && index >= 0 && index < video.textTracks.length) {
            var tracks = Array.prototype.slice.call(video.textTracks).filter(function(track) {
                return track.kind == 'subtitles'
            });
            tracks[index].mode = 'showing';
            textTrackChanged(tracks[index], type, index, encoding, param);
        } else {
            throw new SubtitleGrabberError('Text Track is not found.');
        }
    }

    function textTrackChanged(track, type, index, encoding, param) {
        if (track.cues && track.cues.length) {
            if (type == 'downloadSrt') {
                downloadSrt(index, encoding, param);
            }
            if (type == 'getSrtLines' && typeof param == 'function') {
                param(getSrtLines(index, encoding));
            }
        } else {
            setTimeout(textTrackChanged.bind(null, track, type, index, encoding, param), 100);
        }
    }

    function createStrLines(trackIndex) {
        srtLines = [];
        var tracks = getTextTracks()[trackIndex];
        var cues = tracks.cues ? Array.prototype.slice.call(tracks.cues) : [];
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

    function downloadSrt(index, encoding, filename) {
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

    function SubtitleGrabberError(message) {
        this.name = 'SubtitleGrabberError';
        this.message = message || 'An error occurred!';
        this.stack = (new Error()).stack;
    }
    SubtitleGrabberError.prototype = Object.create(Error.prototype);
    SubtitleGrabberError.prototype.constructor = SubtitleGrabberError;

    function Q(el) {
        if (typeof el === 'string') {
            el = document.querySelectorAll(el)[0];
        }
        if (el && el instanceof HTMLVideoElement) {
            return el;
        } else {
            throw new SubtitleGrabberError('Element must be instance of HTMLVideoElement!');
        }
    }
    return {
        getTextTracks: function() {
            return getTextTracks();
        },
        downloadSrt: function(index, encoding, filename) {
            initTextTracks('downloadSrt', index, encoding, filename);
        },
        downloadVideo: function() {
            downloadVideo();
        },
        getSrtLines: function(index, encoding, callBack) {
            initTextTracks('getSrtLines', index, encoding, callBack);
        }
    };
};