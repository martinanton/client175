Ext.Ajax.disableCaching = false
Ext.namespace('mpd')

appEvents = {
    _events: {},
    _get: function (eventName) {
        if ( Ext.isObject(appEvents._events[eventName]) ) {
            return appEvents._events[eventName]
        }
        appEvents._events[eventName] = {
            callBacks: []
        }
        return appEvents._events[eventName]
    },
    _suspendedEvents: [],
    fire: function (eventName) {
        if (this._suspendedEvents.indexOf(eventName) == -1) {
            var evt = appEvents._get(eventName)
            var cb = evt.callBacks, len = cb.length
            for (var i = 0; i < len; i++) {
                cb[i]()
            }
        }
    },
    resume: function (eventName) {
        var i = this._suspendedEvents.indexOf(eventName)
        if (i >= 0) {
            this._suspendedEvents.splice(i, 1)
        }
    },
    subscribe: function (eventName, fn) {
        if ( !Ext.isFunction(fn) ) return null
        var evt = appEvents._get(eventName)
        evt.callBacks.push(fn)
    },
    suspend: function (eventName) {
        if (this._suspendedEvents.indexOf(eventName) == -1) {
            this._suspendedEvents.push(eventName)
        }
    }
}


function encId (id) {
    if (id != "/" && id.substr(0,1) == "/") id = id.slice(1)
    return encodeURIComponent(id)
}


function hmsFromSec(sec) {
    var hms = "0:00"
    try {
        sec = parseInt(sec)
    } catch (err) {
        return "0:00"
    }
    if (sec > 0) {
        var h = 0
        if (sec >= 3600) {
            h = Math.floor(sec / 3600)
            sec = sec % 3600
        }
        var m = Math.floor(sec / 60)
        var s = sec % 60
        if (h > 0) {
            h = h + ":"
            if (m.toString().length == 1) {
                m = "0" + m
            }
        } else {
            h = ""
        }
        m = m + ":"
        if (s.toString().length == 1) {
            s = "0" + s
        }
        hms = h + m + s
    } else {
        return "0:00"
    }
    return hms
}


mpd.timer_delay = 1500
mpd.status = {}
mpd.checkStatus = new Ext.util.DelayedTask(function() {
    Ext.Ajax.request({
        url: '/status',
        params: mpd.status,
        success: function (req, opt) {
            s = Ext.util.JSON.decode(req.responseText)
            var changed = []
            if (!Ext.isObject(s)) return false
            Ext.iterate(s, function(k, v) {
                if (v != Ext.value(mpd.status[k], null)) {
                    mpd.status[k] = v
                    changed.push(k)
                }
            })
            Ext.each(changed, function(k) {appEvents.fire(k+'changed')} )
            mpd.timer_delay = (mpd.timer_delay > 2950) ? 3000 : mpd.timer_delay * 2
            var t = (mpd.status.state == 'play') ? 300 : mpd.timer_delay
            mpd.checkStatus.delay(t)
        }
    })
})


mpd.cmd = function (aCmd) {
    mpd.timer_delay = 75
    Ext.Ajax.request({
        url: '../' + aCmd.join("/"),
        success: function(response, opts) {
            mpd.checkStatus.delay(200)
        }
    })
}

mpd.setvol_tmr = null
function setvol(v) {
    mpd.setvol_tmr=null
    mpd.cmd(['setvol', v])
    appEvents.resume('volumechanged')
}
mpd.setvol = function(v) {
    if (mpd.setvol_tmr) clearTimeout(mpd.setvol_tmr)
    appEvents.suspend('volumechanged')
    mpd.setvol_tmr = setvol.defer(100, null, [v])
}


mpd.seek_tmr = null
function seek(v) {
    mpd.seek_tmr=null
    mpd.cmd(['seek', mpd.status.song, v])
    appEvents.resume('elapsedchanged')
}
mpd.seek = function(v) {
    if (mpd.seek_tmr) clearTimeout(mpd.seek_tmr)
    appEvents.suspend('elapsedchanged')
    mpd.seek_tmr = seek.defer(100, null, [v])
}