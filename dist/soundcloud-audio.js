(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.SoundCloudAudio = f()}})(function(){var define,module,exports;return (function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
'use strict';

var anchor;
var keys = 'protocol hostname host pathname port search hash href'.split(' ');
function _parseURL (url) {
  if (!anchor) {
    anchor = document.createElement('a');
  }

  var result = {};

  anchor.href = url || '';

  for (var i = 0, len = keys.length; i < len; i++) {
    var key = keys[i];
    result[key] = anchor[key];
  }

  return result;
}

function _appendQueryParam (url, param, value) {
  var U = _parseURL(url);
  var regex = /\?(?:.*)$/;
  var chr = regex.test(U.search) ? '&' : '?';
  var result = U.protocol + '//' +  U.host + U.port + U.pathname + U.search + chr + param + '=' + value + U.hash;

  return result;
}

function SoundCloud (clientId) {
  if (!(this instanceof SoundCloud)) {
    return new SoundCloud(clientId);
  }

  if (!clientId) {
    console.info('SoundCloud API requires clientId, get it at https://developers.soundcloud.com');
  }

  this._events = {};

  this._clientId = clientId;
  this._baseUrl = 'https://api.soundcloud.com';

  this.playing = false;
  this.duration = 0;

  this.audio = document.createElement('audio');
}

SoundCloud.prototype.resolve = function (url, callback) {
  var resolveUrl = this._baseUrl + '/resolve.json?url=' + encodeURIComponent(url) + '&client_id=' + this._clientId;

  this._json(resolveUrl, function (data) {
    this.cleanData();

    if (Array.isArray(data)) {
      var tracks = data;
      data = {tracks: tracks};
      this._playlist = data;
    } else if (data.tracks) {
      this._playlist = data;
    } else {
      this._track = data;

      // save timings
      var U = _parseURL(url);
      this._track.stream_url += U.hash;
    }

    this.duration = data.duration && !isNaN(data.duration) ?
      data.duration / 1000 : // convert to seconds
      0; // no duration is zero

    callback(data);
  }.bind(this));
};

// deprecated
SoundCloud.prototype._jsonp = function (url, callback) {
  var target = document.getElementsByTagName('script')[0] || document.head;
  var script = document.createElement('script');
  var id = 'jsonp_callback_' + (new Date()).valueOf() + Math.floor(Math.random() * 1000);

  window[id] = function (data) {
    if (script.parentNode) {
      script.parentNode.removeChild(script);
    }
    window[id] = function () {};
    callback(data);
  };

  script.src = _appendQueryParam(url, 'callback', id);
  target.parentNode.insertBefore(script, target);
};

SoundCloud.prototype._json = function (url, callback) {
  var xhr = new XMLHttpRequest();

  xhr.open('GET', url);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        var resp = {};
        try {
          resp = JSON.parse(xhr.responseText);
        } catch (err) {
          // fail silently
        }
        callback(resp);
      }
    }
  };

  xhr.send(null);
};

SoundCloud.prototype.on = function (e, fn) {
  this._events[e] = fn;
  this.audio.addEventListener(e, fn, false);
};

SoundCloud.prototype.off = function (e, fn) {
  this._events[e] = null;
  this.audio.removeEventListener(e, fn);
};

SoundCloud.prototype.unbindAll = function () {
  for (var e in this._events) {
    var fn = this._events[e];
    if (fn) {
      this.off(e, fn);
    }
  }
};

SoundCloud.prototype.preload = function (streamUrl, preloadType) {
  this._track = {stream_url: streamUrl};

  if (preloadType) {
    this.audio.preload = preloadType;
  }

  this.audio.src = this._clientId ?
    _appendQueryParam(streamUrl, 'client_id', this._clientId) :
    streamUrl;
};

SoundCloud.prototype.play = function (options) {
  options = options || {};
  var src;

  if (options.streamUrl) {
    src = options.streamUrl;
  } else if (this._playlist) {
    var length = this._playlist.tracks.length;
    if (length) {
      if (options.playlistIndex === undefined) {
        this._playlistIndex = this._playlistIndex || 0;
      } else {
        this._playlistIndex = options.playlistIndex;
      }

      // be silent if index is out of range
      if (this._playlistIndex >= length || this._playlistIndex < 0) {
        this._playlistIndex = 0;
        return;
      }
      src = this._playlist.tracks[this._playlistIndex].stream_url;
    }
  } else if (this._track) {
    src = this._track.stream_url;
  }

  if (!src) {
    throw new Error('There is no tracks to play, use `streamUrl` option or `load` method');
  }

  if (this._clientId) {
    src = _appendQueryParam(src, 'client_id', this._clientId);
  }

  if (src !== this.audio.src) {
    this.audio.src = src;
  }

  this.playing = src;

  return this.audio.play();
};

SoundCloud.prototype.pause = function () {
  this.audio.pause();
  this.playing = false;
};

SoundCloud.prototype.stop = function () {
  this.audio.pause();
  this.audio.currentTime = 0;
  this.playing = false;
};

SoundCloud.prototype.next = function (options) {
  options = options || {};
  var tracksLength = this._playlist.tracks.length;

  if (this._playlistIndex >= tracksLength - 1) {
    if (options.loop) {
      this._playlistIndex = -1;
    } else {
      return;
    }
  }

  if (this._playlist && tracksLength) {
    return this.play({playlistIndex: ++this._playlistIndex});
  }
};

SoundCloud.prototype.previous = function () {
  if (this._playlistIndex <= 0) {
    return;
  }

  if (this._playlist && this._playlist.tracks.length) {
    return this.play({playlistIndex: --this._playlistIndex});
  }
};

SoundCloud.prototype.seek = function (e) {
  if (!this.audio.readyState) {
    return false;
  }

  var percent = e.offsetX / e.target.offsetWidth || (e.layerX - e.target.offsetLeft) / e.target.offsetWidth;

  this.audio.currentTime = percent * (this.audio.duration || 0);
};

SoundCloud.prototype.cleanData = function () {
  this._track = void 0;
  this._playlist = void 0;
};

SoundCloud.prototype.setVolume = function (volumePercentage) {
  if (!this.audio.readyState) {
    return;
  }

  this.audio.volume = volumePercentage;
};

SoundCloud.prototype.setTime = function (seconds) {
  if (!this.audio.readyState) {
    return;
  }

  this.audio.currentTime = seconds;
};

module.exports = SoundCloud;

},{}]},{},[1])(1)
});