(function() {
    'use strict';
    var dragUrl, ripper = null,
        vid = null;
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
            var name = url.split(/(\\|\/|=|\?)/g).find(function(item) {
                return (/\.(mp4|srt|vtt|avi|webm|flv$|mkv|ogg|mp3|wav)/gi).test(item)
            });
            return name ? name : 'unknown.mp4';
        } catch (e) {
            return "unknown.mp4";
        }
    }

    function onMessage(request, sender, sendResponse) {
        if (request.order == 'SendDataToVideoTab' && request.data.length != 0) {
            createContainer(request.data);
        }
        if (request.order == 'DownloadVideoAndSub' && vid) {
            if (request.index === -1) {
                sendMessage(0, vid.src || vid.querySelector('source').src, []);
            } else {
                ripper.getSrtLines(request.index, 'utf-8', sendMessage.bind(null, 0, vid.src || vid.querySelector('source').src));
                vid = null;
            }
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

    function drag(sub, ev) {
        dragUrl = sub;
        document.querySelector('#video-tab-lnk').click();
    }

    function drop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        if (e.target.nodeName.toLowerCase() == 'video' && dragUrl != '') {
            var track = e.target.addTextTrack("captions", "English", "en");
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
                var start = (new Date('2000-01-01 ' + line.split('-->')[0].replace(',', '.')) - new Date('2000-01-01 00:00:00.000')) / 1000;
                var end = (new Date('2000-01-01 ' + line.split('-->')[1].replace(',', '.')) - new Date('2000-01-01 00:00:00.000')) / 1000;
                cue = new VTTCue(start, end, "");
                track.addCue(cue);
            } else if (cue != null && isNaN(line.trim())) {
                cue.text += line.trim() + '\n';
            }
        });
    }

    function isExistsUrl(data) {
        return [].find.call(document.querySelectorAll('[data-url]'), function(item) {
            return data.find(function(d) {
                return d.url == item.dataset.url;
            });
        });
    }

    function createContainer(data) {
        if (!isExistsUrl(data)) {
            var subtitleContainer = document.querySelector(".sub-container");
            var videoContainer = document.querySelector(".video-container");
            data.filter(function(item) {
                return item.type == 'subtitle';
            }).forEach(function(item) {
                var dom;
                dom = createCard(['<div style="cursor: -webkit-grab;" class="w3-panel w3-blue w3-card-2" draggable="true"><p>', getFilename(item.url), '</p></div>'].join(''), '#subtitle-tab', item.url, false);
                dom.querySelector('.w3-panel').addEventListener('drag', drag.bind(null, item.url));
                dom.querySelector('.w3-green').addEventListener('click', function() {
                    var url = item.url;
                    sendMessage(0, url, null);
                });
                dom.querySelector('.w3-red').addEventListener('click', function() {
                    this.parentElement.parentElement.parentElement.parentElement.parentElement.remove();
                    setBadgeForTabs();
                });
            });
            data.filter(function(item) {
                return item.type == 'audio';
            }).forEach(function(item) {
                var dom;
                dom = createCard(['<audio controls src="', item.url, '"></audio>'].join(''), '#audio-tab', item.url, 'audio');
                dom.querySelector('audio').addEventListener('error', function(event) {
                    this.parentElement.parentElement.remove();
                    setBadgeForTabs();
                }, true);
                dom.querySelector('.w3-green').addEventListener('click', function() {
                    var url = item.url;
                    sendMessage(0, url, null);
                });
                dom.querySelector('.w3-red').addEventListener('click', function() {
                    this.parentElement.parentElement.parentElement.parentElement.parentElement.remove();
                    setBadgeForTabs();
                });
                dom.querySelector('[name="syncaudio"]').addEventListener('change', function() {
                    var self = this;
                    [].forEach.call(document.querySelectorAll('[name="syncaudio"]'), function(au) {
                        if (au != self) {
                            au.checked = false;
                        }
                    });
                });
            });
            data.filter(function(item) {
                return item.type == 'video';
            }).forEach(function(item) {
                var dom;
                if (!(/\.(flv)/gi).test(item.url)) {
                    dom = createCard(['<video controls src="', item.url, '"></video>'].join(''), '#video-tab', item.url, 'video');
                    dom.querySelector('video').addEventListener('error', function(event) {
                        this.parentElement.parentElement.remove();
                        setBadgeForTabs();
                    }, true);
                    dom.querySelector("video").addEventListener("play", function() {
                        var arb = document.querySelector('[name="syncaudio"]:checked');
                        if (arb != null) {
                            var ad = arb.parentElement.parentElement.firstChild;
                            ad.currentTime = this.currentTime;
                            ad.play();
                        }
                    });
                    dom.querySelector("video").addEventListener("pause", function() {
                        var arb = document.querySelector('[name="syncaudio"]:checked');
                        if (arb != null) {
                            var ad = arb.parentElement.parentElement.firstChild;
                            ad.currentTime = this.currentTime;
                            ad.pause();
                        }
                    });
                    dom.querySelector('video').addEventListener('dragover', allowDrop);
                    dom.querySelector('video').addEventListener('drop', drop);
                } else {
                    dom = createCard('<iframe></iframe>', '#video-tab', item.url, 'video');
                    var parent = dom.querySelector('iframe');
                    dom.querySelector('iframe').src = 'http://atandrastoth.co.uk/main/system/FLVHelper/embededflvv2.php?url=' + decodeURI(item.url) + '&width=' + Math.round(parent.offsetWidth) + '&height=' + Math.round(parent.offsetHeight * 0.98);
                }
                dom.querySelector('[name="syncvideo"]').addEventListener('change', function() {
                    var self = this;
                    [].forEach.call(document.querySelectorAll('[name="syncvideo"]'), function(au) {
                        if (au != self) {
                            au.checked = false;
                        }
                    });
                });
                dom.querySelector('.w3-green').addEventListener('click', function() {
                    var url = item.url;
                    sendMessage(0, url, null);
                });
                dom.querySelector('.w3-red').addEventListener('click', function() {
                    this.parentElement.parentElement.parentElement.parentElement.parentElement.remove();
                    setBadgeForTabs();
                });
            });
            setBadgeForTabs();
        }
    }

    function sendMessage(ev, url, lines) {
        chrome.extension.sendMessage({
            order: 'DownloadVideoAndSubResponse',
            url: url,
            lines: lines
        }, null);
    }

    function changeTab(index, ev) {
        var tablinks = document.querySelectorAll('.tablink');
        [].forEach.call(tablinks, function(item) {
            if (item == ev.target) {
                item.classList.add('w3-red');
            } else {
                item.classList.remove('w3-red');
            }
        });
        var tabs = document.querySelectorAll(".media-types, .content-types");
        [].forEach.call(tabs, function(item, i) {
            if (index == i) {
                item.classList.remove('w3-hide');
            } else {
                item.classList.add('w3-hide');
            }
        });
    }

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

    function setBadgeForTabs() {
        var tablinks = document.querySelectorAll('#video-tab-lnk, #audio-tab-lnk, #subtitle-tab-lnk');
        [].forEach.call(tablinks, function(item) {
            item.querySelector('span').innerText = document.querySelector('#' + item.id.replace('-lnk', '')).children.length;
        });
    }

    function createCard(item, appendto, url, ch) {
        var dom = ['<div class="w3-third w3-section"><div class="w3-card-8 w3-white" data-url="', url, '">', item, '<div class="w3-container w3-white"><h4>', getFilename(url), '</h4>', ch ? '<input class="w3-checkbox" type="checkbox" name="sync' + ch + '"><label class="w3-validate">Synchronized play</label>' : '', '<div class="w3-container w3-center"><p><button class="w3-btn w3-green w3-margin">SaveAs</button><button class="w3-btn w3-red w3-margin">Remove</button></p></div></div></div></div>'].join("").toDOM();
        document.querySelector(appendto).appendChild(dom);
        var childs = document.querySelector(appendto).children;
        return childs[childs.length - 1];
    }

    function openBrowser() {
        var input = document.querySelector('#url-input');
        var iframe = document.querySelector('#iframe-tab iframe');
        if (isValidURL(input.value)) {
            iframe.src = input.value;
            document.querySelector('#iframe-tab-lnk').click();
        }
    }

    function isValidURL(str) {
        var regex = /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
        return regex.test(str);
    }
    chrome.extension.onMessage.addListener(onMessage);
    document.querySelector('#video-tab-lnk').addEventListener('click', changeTab.bind(null, 0));
    document.querySelector('#audio-tab-lnk').addEventListener('click', changeTab.bind(null, 1));
    document.querySelector('#subtitle-tab-lnk').addEventListener('click', changeTab.bind(null, 2));
    document.querySelector('#iframe-tab-lnk').addEventListener('click', changeTab.bind(null, 3));
    document.querySelector('.fa-arrow-right').addEventListener('click', openBrowser);
    window.document.addEventListener('mousedown', mouseDown, false);
    document.querySelector('.fa-close').addEventListener('click', function() {
        document.querySelector('#url-input').value = '';
        document.querySelector('#iframe-tab iframe').removeAttribute('src');
    });
})();