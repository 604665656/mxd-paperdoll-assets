/* The snapshot is for display. Protected requests authenticate independently. */
(function (window) {
    'use strict';

    var identity = window.UIV8_MEMBER_PAGE_IDENTITY || {};
    var userid = String(identity.userid || '');
    var expires = Number(identity.expires || 0) * 1000;
    var region = (window.MXD_REGION_DEFAULT || {}).datasetKey || '';
    var key = 'mxd-member-display-v1:' + region;
    var changeKey = 'mxd-member-display-changed';
    var ttl = 5 * 60000;
    var snapshot = null;
    var inFlight = null;
    var generation = 0;
    var failedAt = 0;

    function removeSnapshot() {
        try { window.sessionStorage.removeItem(key); } catch (ignore) {}
    }

    function isFresh(at, duration) {
        var age = Date.now() - at;
        return at > 0 && age >= 0 && age < duration;
    }

    function displayResponse() {
        return snapshot && (!expires || expires > Date.now()) ? snapshot.response : null;
    }

    try {
        var saved = JSON.parse(window.sessionStorage.getItem(key) || 'null');
        if (saved && isFresh(saved.at, ttl) && saved.response && saved.response.data &&
            String(saved.response.data.userid || '') === userid && (!expires || expires > Date.now())) {
            snapshot = saved;
        } else {
            removeSnapshot();
        }
    } catch (ignore) {
        removeSnapshot();
    }

    function clear() {
        generation += 1;
        snapshot = null;
        inFlight = null;
        failedAt = 0;
        window.UIV8_MEMBER_AUTH_STATE = null;
        removeSnapshot();
    }

    function invalidate() {
        clear();
        try { window.localStorage.setItem(changeKey, String(Date.now()) + ':' + Math.random()); } catch (ignore) {}
    }

    window.addEventListener('storage', function (event) {
        if (event.key !== changeKey) return;
        clear();
        window.dispatchEvent(new CustomEvent('uiv8:member-display-invalidated'));
    });

    function request(force) {
        if (inFlight) return inFlight;
        var cached = displayResponse();
        if (!force && cached && isFresh(snapshot.at, ttl)) {
            window.UIV8_MEMBER_AUTH_STATE = cached;
            return Promise.resolve(cached);
        }
        if (!force && isFresh(failedAt, 30000)) {
            return Promise.reject(new Error('Member state unavailable'));
        }

        var revision = generation;
        var pending = fetch('/member/auth_state.php', {credentials: 'include', cache: 'no-store'})
            .then(function (response) {
                if (!response.ok) throw new Error('Member state unavailable');
                return response.json();
            }).then(function (response) {
                if (revision !== generation) throw new Error('Member identity changed');
                if (Number(response && response.state) !== 1 || !response.data) throw new Error('Invalid member state');
                var nextUserid = Number(response.data.is_login) === 1 ? String(response.data.userid || '') : '';
                if (nextUserid !== userid) expires = 0;
                userid = nextUserid;
                failedAt = 0;
                snapshot = {at: Date.now(), response: response};
                window.UIV8_MEMBER_AUTH_STATE = response;
                try { window.sessionStorage.setItem(key, JSON.stringify(snapshot)); } catch (ignore) {}
                return response;
            }).catch(function (error) {
                if (revision === generation) failedAt = Date.now();
                throw error;
            }).finally(function () {
                if (inFlight === pending) inFlight = null;
            });
        inFlight = pending;
        return pending;
    }

    window.UIV8MemberState = {request: request, invalidate: invalidate, snapshot: displayResponse};
})(window);
