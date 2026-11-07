(function () {
    var cfg = window.BOOKLET_SECURE_API || {};
    var readyPromise = null;

    function supportsSecureTransport() {
        return !!(window.Promise && window.WebAssembly && window.XMLHttpRequest);
    }

    function importModule(url) {
        try {
            return (new Function('u', 'return import(u);'))(url);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    function ensureWasm() {
        if (!cfg.enabled || !supportsSecureTransport()) {
            return Promise.resolve(null);
        }
        if (!readyPromise) {
            readyPromise = importModule(cfg.wasmUrl).then(function (mod) {
                if (!mod || !mod.default) return null;
                return mod.default().then(function () {
                    return mod;
                });
            }).catch(function () {
                return null;
            });
        }
        return readyPromise;
    }

    function secureUrl(url) {
        return appendParam(url, cfg.trialParam || '_secure', '1');
    }

    function legacyUrl(url) {
        return appendParam(url, cfg.legacyParam || '_legacy', '1');
    }

    function canonicalPath(url) {
        var a = document.createElement('a');
        a.href = url;
        if (a.pathname && a.pathname.charAt(0) !== '/') {
            return '/' + a.pathname + (a.search || '');
        }
        return (a.pathname || url.split('?')[0]) + (a.search || (url.indexOf('?') !== -1 ? '?' + url.split('?').slice(1).join('?') : ''));
    }

    function appendParam(url, key, value) {
        var sep = url.indexOf('?') === -1 ? '?' : '&';
        return url + sep + encodeURIComponent(key) + '=' + encodeURIComponent(value);
    }

    function requestRawText(url, done, fail, holder) {
        var xhr = new XMLHttpRequest();
        if (holder) holder.xhr = xhr;
        xhr.open('GET', url, true);
        xhr.timeout = 10000;
        xhr.onreadystatechange = function () {
            if (holder) holder.readyState = xhr.readyState;
            if (xhr.readyState !== 4) return;
            if (xhr.status < 200 || xhr.status >= 300) {
                fail(new Error('request failed'));
                return;
            }
            done(xhr.responseText);
        };
        xhr.onerror = function () {
            fail(new Error('request failed'));
        };
        xhr.ontimeout = function () {
            fail(new Error('request timeout'));
        };
        xhr.send();
        return xhr;
    }

    function requestLegacyText(url, done, fail, holder) {
        if (!cfg.legacyFallback || !window.XMLHttpRequest) {
            fail(new Error('secure api unavailable'));
            return null;
        }
        return requestRawText(legacyUrl(url), done, fail, holder);
    }

    function randomNonce() {
        var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        var out = '';
        var bytes;
        if (window.crypto && window.crypto.getRandomValues) {
            bytes = new Uint8Array(18);
            window.crypto.getRandomValues(bytes);
            for (var i = 0; i < bytes.length; i++) out += chars.charAt(bytes[i] % chars.length);
            return out;
        }
        for (var j = 0; j < 18; j++) out += chars.charAt(Math.floor(Math.random() * chars.length));
        return out;
    }

    function signedUrl(url, mod) {
        var signed = secureUrl(url);
        if (!cfg.requireSignature) return signed;
        if (!mod || !mod.fxSignRequest) throw new Error('secure signer unavailable');

        var ts = String(Math.floor(Date.now() / 1000));
        var nonce = randomNonce();
        var sign = mod.fxSignRequest(canonicalPath(url), ts, nonce);
        if (!sign) throw new Error('secure sign failed');

        signed = appendParam(signed, '_ts', ts);
        signed = appendParam(signed, '_nonce', nonce);
        signed = appendParam(signed, '_sign', sign);
        return signed;
    }

    function decryptEnvelope(text) {
        var parsed;
        try {
            parsed = JSON.parse(text);
        } catch (err) {
            return Promise.resolve(text);
        }

        if (!parsed || Number(parsed.enc) !== 1 || !parsed.data || !parsed.iv) {
            return Promise.resolve(text);
        }

        return ensureWasm().then(function (mod) {
            if (!mod || !mod.fxRenderCache) {
                if (cfg.forceOnline) throw new Error('secure wasm unavailable');
                return text;
            }

            var plain = mod.fxRenderCache(String(parsed.data), String(parsed.iv));
            if (!plain) throw new Error('secure decrypt failed: empty response');
            return plain;
        });
    }

    function requestText(url, done, fail) {
        if (!cfg.enabled) return null;
        if (!supportsSecureTransport()) {
            var legacyOnly = {
                readyState: 0,
                xhr: null,
                abort: function () {
                    if (legacyOnly.xhr) legacyOnly.xhr.abort();
                }
            };
            requestLegacyText(url, done, fail, legacyOnly);
            return legacyOnly;
        }

        var request = {
            readyState: 0,
            xhr: null,
            abort: function () {
                request.aborted = true;
                if (request.xhr) request.xhr.abort();
            }
        };

        function fallbackOrFail(err) {
            if (request.aborted) return;
            if (cfg.legacyFallback) {
                requestLegacyText(url, done, fail, request);
                return;
            }
            fail(err);
        }

        function secureDone(text) {
            if (request.aborted) return;
            decryptEnvelope(text).then(done).catch(fallbackOrFail);
        }

        function secureFail(err) {
            fallbackOrFail(err || new Error('secure request failed'));
        }

        ensureWasm().then(function (mod) {
            if (request.aborted) return;
            if (!mod || (cfg.requireSignature && !mod.fxSignRequest)) {
                fallbackOrFail(new Error('secure wasm unavailable'));
                return;
            }
            requestRawText(signedUrl(url, mod), secureDone, secureFail, request);
        }).catch(fallbackOrFail);

        return request;
    }

    function plainRequestJson(url, options) {
        if (window.fetch) {
            return fetch(url, options).then(function (response) {
                if (!response.ok) {
                    throw new Error('request failed');
                }
                return response.json();
            });
        }

        return new Promise(function (resolve, reject) {
            requestRawText(url, function (text) {
                try {
                    resolve(JSON.parse(text));
                } catch (err) {
                    reject(err);
                }
            }, reject);
        });
    }

    function requestJson(url, options) {
        options = options || {};

        if (cfg.enabled) {
            return new Promise(function (resolve, reject) {
                var signal = options.signal || null;
                var request = null;
                var settled = false;
                var abortHandler = null;

                function cleanup() {
                    if (signal && abortHandler) {
                        signal.removeEventListener('abort', abortHandler);
                    }
                }

                function finishResolve(value) {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    resolve(value);
                }

                function finishReject(error) {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    reject(error);
                }

                request = requestText(url, function (text) {
                    try {
                        finishResolve(JSON.parse(text));
                    } catch (err) {
                        finishReject(err);
                    }
                }, finishReject);

                if (!request) {
                    finishReject(new Error('secure api unavailable'));
                    return;
                }

                if (signal) {
                    abortHandler = function () {
                        request.abort();
                        var error = new Error('request aborted');
                        error.name = 'AbortError';
                        finishReject(error);
                    };
                    if (signal.aborted) {
                        abortHandler();
                    } else {
                        signal.addEventListener('abort', abortHandler, { once: true });
                    }
                }
            });
        }

        return plainRequestJson(url, options);
    }

    window.BookletSecureApi = {
        enabled: function () {
            return !!cfg.enabled;
        },
        ensureWasm: ensureWasm,
        requestText: requestText,
        requestJson: requestJson
    };
})();
