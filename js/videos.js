(function() {
    'use strict';
    var dragUrl;
    String.prototype.toDOM = function() {
        var d = document,
            i, a = d.createElement("div"),
            b = d.createDocumentFragment();
        a.innerHTML = this;
        while (i = a.firstChild) b.appendChild(i);
        return b;
    };

    function getFilename(url) {
        try {
            return url.split(/(\\|\/|=|\?)/g).find(function(item) {
                return (/\.(mp4|srt|vtt|avi|webm|flv$|mkv|z)/gi).test(item)
            });
        } catch (e) {
            return "";
        }
    }

    function onMessage(request, sender, sendResponse) {
        if (request.order == 'SendDataToVideoTab' && request.data.video.length != 0) {
            createVideoContainer(request.data);
        }
        if (request.order == 'SendDataToVideoTab' && request.data.subtitle.length != 0) {
            createSubContainer(request.data);
        }
    }

    function httpGet(theUrl, track) {
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                createVTTSub(xmlhttp.responseText, track);
            }
        }
        xmlhttp.open("GET", theUrl, true);
        xmlhttp.send();
    }

    function allowDrop(ev) {
        ev.preventDefault();
    }

    function drag(ev) {
        dragUrl = ev.target.dataset.src;
    }

    function drop(ev) {
        ev.preventDefault();
        if (ev.target.nodeName.toLowerCase() == 'video' && dragUrl != '') {
            var track = ev.target.addTextTrack("captions", "English", "en");
            track.mode = "showing";
            httpGet(dragUrl, track);
            dragUrl = '';
        }
    }

    function createVTTSub(text, track) {
        var srtLines = text.split('\n');
        var cue = null;
        srtLines.forEach(function(line, index) {
            if ((/(-->)/gi).test(line)) {
                var start = new Date('2000-01-01 ' + line.split('-->')[0].replace(',', '.'));
                var end = new Date('2000-01-01 ' + line.split('-->')[1].replace(',', '.'));
                cue = new VTTCue(parseFloat((start.getHours() * 3600 + start.getMinutes() * 60 + start.getSeconds() + start.getMilliseconds() / 1000).toFixed(1)), parseFloat((end.getHours() * 3600 + end.getMinutes() * 60 + end.getSeconds() + end.getMilliseconds() / 1000).toFixed(1)), "");
                track.addCue(cue);
            } else if (cue != null && isNaN(line.trim())) {
                cue.text += line.trim() + '\n';
            }
        });
    }

    function createSubContainer(data) {
        var subtitleContainer = document.querySelector(".sub-container");
        var uniqueSub = data.subtitle.filter(function(item, pos) {
            return data.subtitle.indexOf(item) == pos;
        });
        uniqueSub.forEach(function(sub) {
            var div = document.createElement('div');
            subtitleContainer.appendChild(div);
            div.appendChild(['<h2 draggable="true"  data-src="', sub, '">', getFilename(sub).toString(), '</h2>'].join('').toDOM());
            div.appendChild(['<button class="btn btn-green" data-src="', sub, '"><span>SaveAS</span></button>'].join('').toDOM());
            div.appendChild('<button class="btn btn-orange"><span>Remove</span></button>'.toDOM());
            div.querySelector('.btn-green').addEventListener('click', function() {
                sendMessage(this.dataset.src, null);
            });
            div.querySelector('.btn-orange').addEventListener('click', function() {
                this.parentElement.remove();
            });
            div.querySelector('h2').addEventListener('drag', drag);
        });
    }

    function createVideoContainer(data) {
        var videoContainer = document.querySelector(".video-container");
        var uniqueVideo = data.video.filter(function(item, pos) {
            return data.video.indexOf(item) == pos;
        });
        uniqueVideo.forEach(function(vid) {
            var div = document.createElement('div');
            videoContainer.appendChild(div);
            if (!(/\.(flv)/gi).test(vid)) {
                div.appendChild(['<video controls src="', vid, '"></video>'].join('').toDOM());
                div.querySelector('video').addEventListener('error', function(event) {
                    this.parentElement.remove();
                }, true);
            } else {
                var iframe = document.createElement('iframe');
                div.appendChild(iframe);
                iframe.src = 'http://atandrastoth.co.uk/main/system/FLVHelper/embededflv.php?url=' + decodeURI(vid) + '&width=' + Math.round(div.offsetWidth - div.offsetWidth * 0.1) + '&height=' + Math.round(div.offsetWidth / 16 * 9 - div.offsetWidth / 16 * 9 * 0.1);
            }
            div.appendChild(['<button class="btn btn-green" data-src="', vid, '"><span>SaveAS</span></button>'].join('').toDOM());
            div.appendChild('<button class="btn btn-orange"><span>Remove</span></button>'.toDOM());
            div.querySelector('.btn-green').addEventListener('click', function() {
                sendMessage(this.dataset.src, null);
            });
            div.querySelector('.btn-orange').addEventListener('click', function() {
                this.parentElement.remove();
            });
            div.addEventListener('dragover', allowDrop);
            div.addEventListener('drop', drop);
        });
    }

    function sendMessage(url, lines) {
        chrome.extension.sendMessage({
            order: 'DownloadVideoAndSubResponse',
            url: url,
            lines: lines
        }, null);
    }
    chrome.extension.onMessage.addListener(onMessage);
})();