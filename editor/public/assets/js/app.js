document.addEventListener('DOMContentLoaded', function () {
    var root = document.documentElement;
    var themeToggleList = document.querySelectorAll('[data-theme-toggle]');
    var backdrop = document.querySelector('[data-side-backdrop]');
    var panel = document.querySelector('[data-side-panel]');
    var openButtons = document.querySelectorAll('[data-side-open]');
    var closeButtons = document.querySelectorAll('[data-side-close]');
    var accordionTriggers = document.querySelectorAll('[data-side-section]');
    var sideCascadeTriggers = document.querySelectorAll('[data-side-cascade-trigger]');
    var dropdownRoots = document.querySelectorAll('[data-dropdown]');
    var hoverCloseTimers = new WeakMap();

    function normalizeTheme(theme) {
        return theme === 'dark' ? 'dark' : 'light';
    }

    function getDefaultDarkBackground() {
        var value = String(window.MXD_DARK_BG_DEFAULT || '#282828').trim();
        return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value.toLowerCase() : '#282828';
    }

    function normalizeDarkBackground(value) {
        value = String(value || '').trim();
        if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
            return value.toLowerCase();
        }

        return getDefaultDarkBackground();
    }

    function readSavedDarkBackground() {
        var saved = String(localStorage.getItem('mxd-dark-bg') || '').trim();
        return saved.toLowerCase() === '#181818' ? '' : saved;
    }

    function applyDarkBackground(value) {
        value = normalizeDarkBackground(value);
        root.style.setProperty('--mxd-dark-bg', value);
        document.querySelectorAll('[data-dark-bg-input]').forEach(function (input) {
            input.value = value;
        });
        document.querySelectorAll('[data-dark-bg-color]').forEach(function (input) {
            input.value = value.length === 4
                ? '#' + value.charAt(1) + value.charAt(1) + value.charAt(2) + value.charAt(2) + value.charAt(3) + value.charAt(3)
                : value;
        });
        return value;
    }

    function saveDarkBackground(value) {
        value = applyDarkBackground(value);
        localStorage.setItem('mxd-dark-bg', value);
        return value;
    }

    function initAppearanceSettings() {
        var saved = readSavedDarkBackground() || getDefaultDarkBackground();
        var controls = document.querySelectorAll('[data-dark-bg-input], [data-dark-bg-color]');
        var presetButtons = document.querySelectorAll('[data-dark-bg-preset]');
        var resetButtons = document.querySelectorAll('[data-dark-bg-reset]');

        applyDarkBackground(saved);

        controls.forEach(function (control) {
            control.addEventListener('input', function () {
                var value = String(control.value || '').trim();
                if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
                    saveDarkBackground(value);
                }
            });
        });

        presetButtons.forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                saveDarkBackground(button.dataset.darkBgPreset);
            });
        });

        resetButtons.forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                localStorage.removeItem('mxd-dark-bg');
                applyDarkBackground(getDefaultDarkBackground());
            });
        });
    }

    function syncThemeToggleState(theme) {
        themeToggleList.forEach(function (button) {
            button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
            button.setAttribute('title', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        });
    }

    function applyTheme(theme) {
        theme = normalizeTheme(theme);
        root.classList.toggle('dark', theme === 'dark');
        root.classList.toggle('tw-dark', theme === 'dark');
        root.dataset.theme = theme;
        localStorage.setItem('xcz-theme', theme);
        applyDarkBackground(readSavedDarkBackground() || getDefaultDarkBackground());
        syncThemeToggleState(theme);
    }

    function normalizeRegionState(state) {
        var fallback = window.MXD_REGION_DEFAULT || {};

        state = state && typeof state === 'object' ? state : {};

        return {
            region: String(state.region || fallback.region || 'CMS').toUpperCase(),
            datasetKey: String(state.datasetKey || fallback.datasetKey || 'cms-225'),
            datasetLabel: String(state.datasetLabel || fallback.datasetLabel || 'CMS-225'),
            basewzSuffix: String(state.basewzSuffix || ''),
            dbMxdVersionField: String(state.dbMxdVersionField || '')
        };
    }

    function readRegionState() {
        var raw = '';

        try {
            raw = localStorage.getItem('mxd-current-dataset') || '';
            if (raw) {
                return normalizeRegionState(JSON.parse(raw));
            }
        } catch (error) {
            try { localStorage.removeItem('mxd-current-dataset'); } catch (storageError) {}
        }

        try {
            raw = localStorage.getItem('mxd-region') || '';
            if (raw) {
                return normalizeRegionState({ region: raw });
            }
        } catch (error) {}

        return normalizeRegionState(null);
    }

    function writeRegionState(state) {
        state = normalizeRegionState(state);

        try {
            localStorage.setItem('mxd-region', state.region);
            localStorage.setItem('mxd-current-dataset', JSON.stringify(state));
            document.cookie = 'USER_REGION=' + encodeURIComponent(state.region) + '; path=/; max-age=31536000; samesite=lax';
            document.cookie = 'MXD_DATASET=' + encodeURIComponent(state.datasetKey) + '; path=/; max-age=31536000; samesite=lax';
        } catch (error) {}

        return state;
    }

    function setCurrentTag(item, active) {
        var tag = item.querySelector('.tag-blue, .tag-red');

        if (active) {
            if (!tag) {
                tag = document.createElement('span');
                tag.className = 'tag-blue';
                item.appendChild(tag);
            }

            tag.textContent = '当前';
            tag.setAttribute('title', '当前');
            tag.setAttribute('aria-label', '当前');
            tag.innerHTML = '<span class="tw-icon-[mdi--check-bold]"></span>';
            return;
        }

        if (tag) {
            tag.remove();
        }
    }

    function applyRegionState(state) {
        var badges = document.querySelectorAll('[data-region-current-badge]');
        var options = document.querySelectorAll('[data-region-option]');

        state = normalizeRegionState(state);
        root.dataset.region = state.region;
        root.dataset.datasetKey = state.datasetKey;
        root.dataset.datasetLabel = state.datasetLabel;

        badges.forEach(function (badge) {
            badge.textContent = state.region;
        });

        options.forEach(function (item) {
            setCurrentTag(item, String(item.dataset.region || '').toUpperCase() === state.region);
        });
    }

    function regionStateFromOption(item, fallbackState) {
        fallbackState = normalizeRegionState(fallbackState);

        if (!item) {
            return fallbackState;
        }

        return normalizeRegionState({
            region: item.dataset.region || fallbackState.region,
            datasetKey: item.dataset.datasetKey || fallbackState.datasetKey,
            datasetLabel: item.dataset.datasetLabel || fallbackState.datasetLabel,
            basewzSuffix: item.dataset.basewzSuffix || fallbackState.basewzSuffix,
            dbMxdVersionField: item.dataset.dbMxdVersionField || fallbackState.dbMxdVersionField
        });
    }

    function regionNavigationUrl(state) {
        var url = new URL(window.location.href);
        url.searchParams.set('region', state.region);
        if (/\/tools\/maptools(?:\/|$)/i.test(url.pathname) && state.datasetKey) {
            url.searchParams.set('dataset', state.datasetKey);
        }
        return url.toString();
    }

    function initRegionSwitcher() {
        var options = Array.prototype.slice.call(document.querySelectorAll('[data-region-option]'));
        var defaultState = normalizeRegionState(window.MXD_REGION_DEFAULT || {});
        var hasSavedState = false;
        var savedState = readRegionState();
        var savedOption = options.find(function (item) {
            return String(item.dataset.region || '').toUpperCase() === savedState.region;
        });

        try {
            hasSavedState = !!(localStorage.getItem('mxd-current-dataset') || localStorage.getItem('mxd-region'));
        } catch (error) {}

        if (savedOption) {
            savedState = regionStateFromOption(savedOption, savedState);
        } else {
            savedState = normalizeRegionState(null);
        }

        // An explicit region already determined the server-rendered page. Never
        // reload that URL to apply a conflicting browser preference.
        if (new URL(window.location.href).searchParams.has('region')) {
            savedState = writeRegionState(defaultState);
        } else if (hasSavedState && (savedState.region !== defaultState.region || savedState.datasetKey !== defaultState.datasetKey)) {
            writeRegionState(savedState);
            // Carry the selection in the URL so this converges even if cookies
            // are blocked or cannot be written.
            window.location.replace(regionNavigationUrl(savedState));
            return;
        }

        applyRegionState(savedState);

        options.forEach(function (item) {
            item.addEventListener('click', function (event) {
                var state;

                event.preventDefault();
                state = writeRegionState(regionStateFromOption(item, null));
                applyRegionState(state);
                closeAllDropdowns();
                window.dispatchEvent(new CustomEvent('mxd:region-change', { detail: state }));

                // Update explicit region and MapTools dataset parameters together.
                window.location.assign(regionNavigationUrl(state));
            });
        });
    }

    function openSide() {
        if (!backdrop || !panel) {
            return;
        }

        backdrop.classList.add('is-open');
        panel.classList.add('is-open');
        document.body.classList.add('tw-overflow-hidden');
    }

    function closeSide() {
        if (!backdrop || !panel) {
            return;
        }

        backdrop.classList.remove('is-open');
        panel.classList.remove('is-open');
        document.body.classList.remove('tw-overflow-hidden');
    }

    function resetPanelPosition(panelElement) {
        panelElement.classList.remove('is-align-left', 'is-align-right');
    }

    function adjustPanelPosition(panelElement) {
        var rect;
        var viewportWidth = window.innerWidth;

        resetPanelPosition(panelElement);
        rect = panelElement.getBoundingClientRect();

        if (rect.right > viewportWidth - 8) {
            panelElement.classList.add('is-align-right');
            rect = panelElement.getBoundingClientRect();
        }

        if (rect.left < 8) {
            panelElement.classList.remove('is-align-right');
            panelElement.classList.add('is-align-left');
        }
    }

    function adjustCascadePanelPosition(panelElement, anchorElement, shellElement) {
        var shellRect;
        var anchorRect;
        var panelRect;
        var top;
        var overflowBottom;

        if (!panelElement || !anchorElement || !shellElement) {
            return;
        }

        shellRect = shellElement.getBoundingClientRect();
        anchorRect = anchorElement.getBoundingClientRect();
        top = Math.max(0, Math.round(anchorRect.top - shellRect.top));

        panelElement.style.top = top + 'px';
        panelRect = panelElement.getBoundingClientRect();
        overflowBottom = panelRect.bottom - (window.innerHeight - 8);

        if (overflowBottom > 0) {
            top = Math.max(0, top - Math.ceil(overflowBottom));
            panelElement.style.top = top + 'px';
        }
    }

    function closeDropdown(rootElement) {
        var trigger = rootElement.querySelector('[data-dropdown-trigger]');
        var panelElement = rootElement.querySelector('[data-dropdown-panel]');
        var timer = hoverCloseTimers.get(rootElement);

        if (timer) {
            clearTimeout(timer);
            hoverCloseTimers.delete(rootElement);
        }

        if (trigger) {
            trigger.classList.remove('is-open', 'dropdown-trigger', 'nav-link-active');
            trigger.setAttribute('aria-expanded', 'false');
        }

        if (panelElement) {
            panelElement.classList.remove('is-open');
            resetPanelPosition(panelElement);
        }
    }

    function closeAllDropdowns(exceptRoot) {
        dropdownRoots.forEach(function (rootElement) {
            if (exceptRoot && rootElement === exceptRoot) {
                return;
            }

            closeDropdown(rootElement);
        });
    }

    function openDropdown(rootElement) {
        var trigger = rootElement.querySelector('[data-dropdown-trigger]');
        var panelElement = rootElement.querySelector('[data-dropdown-panel]');
        var timer = hoverCloseTimers.get(rootElement);

        if (!trigger || !panelElement) {
            return;
        }

        if (timer) {
            clearTimeout(timer);
            hoverCloseTimers.delete(rootElement);
        }

        closeAllDropdowns(rootElement);
        trigger.classList.add('is-open', 'dropdown-trigger', 'nav-link-active');
        trigger.setAttribute('aria-expanded', 'true');
        panelElement.classList.add('is-open');
        adjustPanelPosition(panelElement);
    }

    function bindCascade(rootElement) {
        var tabs = rootElement.querySelectorAll('[data-cascade-tab]');
        var panels = rootElement.querySelectorAll('[data-cascade-panel]');
        var panelWrap = rootElement.querySelector('[data-cascade-panels]');
        var shell = rootElement.querySelector('[data-cascade-shell]');
        var tabsWrap = rootElement.querySelector('[data-cascade-tabs]');
        var isSideCascade = rootElement.closest('[data-side-panel]') !== null;
        var closeTimer = null;

        function resetCascade() {
            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }

            tabs.forEach(function (item) {
                item.classList.remove('is-active', 'nav-link-active');
                item.setAttribute('aria-expanded', 'false');
            });

            panels.forEach(function (item) {
                item.classList.add('tw-hidden');
                item.classList.remove('is-open');

                if (!isSideCascade) {
                    item.style.top = '';
                }
            });

            if (panelWrap && !isSideCascade) {
                panelWrap.classList.add('tw-hidden');
            }
        }

        tabs.forEach(function (tab) {
            function activateTab() {
                var target = rootElement.querySelector(tab.dataset.cascadeTarget);

                resetCascade();

                tab.classList.add('is-active', 'nav-link-active');
                tab.setAttribute('aria-expanded', 'true');

                if (target) {
                    if (panelWrap && !isSideCascade) {
                        panelWrap.classList.remove('tw-hidden');
                    }

                    target.classList.remove('tw-hidden');
                    target.classList.add('is-open');

                    if (!isSideCascade && shell) {
                        adjustCascadePanelPosition(target, tab, shell);
                    }
                }
            }

            tab.addEventListener('mouseenter', activateTab);
            tab.addEventListener('focus', activateTab);
            tab.addEventListener('click', function (event) {
                event.preventDefault();
                activateTab();
            });
        });

        if (!isSideCascade) {
            function scheduleReset() {
                if (closeTimer) {
                    clearTimeout(closeTimer);
                }

                closeTimer = setTimeout(function () {
                    resetCascade();
                }, 160);
            }

            function cancelReset() {
                if (closeTimer) {
                    clearTimeout(closeTimer);
                    closeTimer = null;
                }
            }

            rootElement.addEventListener('mouseenter', cancelReset);
            rootElement.addEventListener('mouseleave', function () {
                scheduleReset();
            });

            rootElement.addEventListener('mousemove', function (event) {
                var activePanel = rootElement.querySelector('[data-cascade-panel].is-open');
                var activeTab = rootElement.querySelector('[data-cascade-tab].is-active');
                var hoveredTab = event.target.closest('[data-cascade-tab]');
                var hoveredPanel = event.target.closest('[data-cascade-panel]');
                var hoveredItem = event.target.closest('.nav-drop-item');
                var activeTabRect;
                var panelRect;
                var isInBridgeZone = false;

                if (hoveredTab || hoveredPanel) {
                    cancelReset();
                    return;
                }

                if (tabsWrap && tabsWrap.contains(event.target)) {
                    if (!activeTab || !hoveredItem || hoveredItem !== activeTab) {
                        resetCascade();
                        return;
                    }
                }

                if (activePanel && activeTab) {
                    activeTabRect = activeTab.getBoundingClientRect();
                    panelRect = activePanel.getBoundingClientRect();
                    isInBridgeZone = event.clientX > activeTabRect.right
                        && event.clientX < panelRect.left
                        && event.clientY >= Math.min(activeTabRect.top, panelRect.top) - 6
                        && event.clientY <= Math.max(activeTabRect.bottom, panelRect.bottom) + 6;
                }

                if (!isInBridgeZone) {
                    resetCascade();
                }
            });

            panels.forEach(function (panelElement) {
                panelElement.addEventListener('mouseenter', cancelReset);
                panelElement.addEventListener('mouseleave', scheduleReset);
            });
        }
    }

    function scheduleCloseDropdown(rootElement, delay) {
        var timer = hoverCloseTimers.get(rootElement);

        if (timer) {
            clearTimeout(timer);
        }

        hoverCloseTimers.set(rootElement, setTimeout(function () {
            closeDropdown(rootElement);
        }, delay));
    }

    themeToggleList.forEach(function (button) {
        button.addEventListener('click', function () {
            applyTheme(root.classList.contains('tw-dark') ? 'light' : 'dark');
        });
    });

    syncThemeToggleState(normalizeTheme(root.dataset.theme));
    initAppearanceSettings();
    initRegionSwitcher();

    openButtons.forEach(function (button) {
        button.addEventListener('click', openSide);
    });

    closeButtons.forEach(function (button) {
        button.addEventListener('click', closeSide);
    });

    if (backdrop) {
        backdrop.addEventListener('click', closeSide);
    }

    accordionTriggers.forEach(function (button) {
        button.addEventListener('click', function () {
            var target = document.querySelector(button.dataset.sideTarget);
            var isOpen = button.getAttribute('aria-expanded') === 'true';

            if (!target) {
                return;
            }

            button.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            target.classList.toggle('tw-hidden', isOpen);
        });
    });

    sideCascadeTriggers.forEach(function (button) {
        button.addEventListener('click', function () {
            var target = document.querySelector(button.dataset.sideTarget);
            var parent = button.closest('.side-cascade-node');
            var siblings;
            var isOpen = button.getAttribute('aria-expanded') === 'true';

            if (!target || !parent) {
                return;
            }

            siblings = parent.parentElement.querySelectorAll('.side-cascade-node');

            siblings.forEach(function (node) {
                var siblingButton = node.querySelector('[data-side-cascade-trigger]');
                var siblingTarget = node.querySelector('.side-third-panel');

                if (!siblingButton || !siblingTarget || siblingButton === button) {
                    return;
                }

                siblingButton.setAttribute('aria-expanded', 'false');
                siblingTarget.classList.add('tw-hidden');
            });

            button.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            target.classList.toggle('tw-hidden', isOpen);
        });
    });

    dropdownRoots.forEach(function (rootElement) {
        var trigger = rootElement.querySelector('[data-dropdown-trigger]');
        var panelElement = rootElement.querySelector('[data-dropdown-panel]');
        var mode = rootElement.dataset.dropdownMode || 'hover';

        if (!trigger || !panelElement) {
            return;
        }

        bindCascade(rootElement);

        if (mode === 'hover') {
            rootElement.addEventListener('mouseenter', function () {
                openDropdown(rootElement);
            });

            rootElement.addEventListener('mouseleave', function () {
                scheduleCloseDropdown(rootElement, 140);
            });

            trigger.addEventListener('focus', function () {
                openDropdown(rootElement);
            });

            panelElement.addEventListener('mouseenter', function () {
                var timer = hoverCloseTimers.get(rootElement);

                if (timer) {
                    clearTimeout(timer);
                    hoverCloseTimers.delete(rootElement);
                }
            });
        }

        trigger.addEventListener('click', function (event) {
            var isOpen = trigger.getAttribute('aria-expanded') === 'true';
            var href = trigger.getAttribute('href');

            if (mode === 'hover' && trigger.tagName !== 'BUTTON' && href && href !== '#') {
                return;
            }

            if (trigger.tagName === 'A' || href === '#') {
                event.preventDefault();
            }

            if (isOpen) {
                closeDropdown(rootElement);
            } else {
                openDropdown(rootElement);
            }
        });
    });

    document.addEventListener('click', function (event) {
        dropdownRoots.forEach(function (rootElement) {
            if (!rootElement.contains(event.target)) {
                closeDropdown(rootElement);
            }
        });
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeAllDropdowns();
            closeSide();
        }
    });

    window.addEventListener('resize', function () {
        dropdownRoots.forEach(function (rootElement) {
            var panelElement = rootElement.querySelector('[data-dropdown-panel]');
            var trigger = rootElement.querySelector('[data-dropdown-trigger]');

            if (panelElement && trigger && trigger.getAttribute('aria-expanded') === 'true') {
                adjustPanelPosition(panelElement);
            }
        });
    });

    initMemberSystem();
});

function initMemberSystem() {
    var defaultAvatar = window.TOPHEADER_DEFAULT_AVATAR || 'https://u2.dvg.cn/static/images/default_avatar.png';
    var loginButton = document.querySelector('[data-member-login-open]');
    var menuWrap = document.querySelector('[data-member-menu-wrap]');
    var menuAvatar = document.querySelector('[data-member-avatar]');
    var menuName = document.querySelector('[data-member-name]');
    var avatarOpenButton = document.querySelector('[data-member-avatar-open]');
    var profileButton = document.querySelector('[data-member-profile-open]');
    var logoutButton = document.querySelector('[data-member-logout]');
    var drawer = document.querySelector('[data-member-drawer]');
    var drawerOverlay = document.querySelector('[data-member-drawer-overlay]');
    var drawerClose = document.querySelector('[data-member-drawer-close]');
    var drawerTitle = document.querySelector('[data-member-drawer-title]');
    var drawerIcon = document.querySelector('[data-member-drawer-icon]');
    var profileView = document.querySelector('[data-profile-view]');
    var forgotView = document.querySelector('[data-forgot-view]');
    var forgotForm = document.querySelector('[data-forgot-form]');
    var forgotActions = document.querySelector('[data-forgot-actions]');
    var forgotSuccess = document.querySelector('[data-forgot-success]');
    var authModal = document.querySelector('[data-auth-modal]');
    var authClose = document.querySelector('[data-auth-close]');
    var authTabs = document.querySelectorAll('[data-auth-tab]');
    var drawerFooter = document.querySelector('[data-member-drawer-foot]');
    var memberState = window.UIV8MemberState;
    var authTrigger = null;
    var profileCache = null;
    var profileRequest = null;
    var profileGeneration = 0;
    var activeRefresh = null;
    var activeStateRequest = null;
    var displayedState = null;
    var state = {
        isLogin: 0,
        userid: '',
        username: '',
        nickname: '',
        email: '',
        userfen: null,
        level: null,
        levelBadge: 'Lv.1 初心者',
        emailBound: 0,
        hasPassword: 0,
        canChangeUsername: 0,
        isWechatAccount: 0,
        canMergeWechat: 0,
        avatar: defaultAvatar,
        resetTimer: null,
        resetCountdown: 0,
        registerTimer: null,
        registerCountdown: 0
    };

    if (!loginButton || !drawer || !authModal || !memberState) {
        return;
    }

    function $(selector) {
        return document.querySelector(selector);
    }

    function setHidden(element, hidden) {
        if (element) {
            element.classList.toggle('tw-hidden', !!hidden);
        }
    }

    function toast(message, type) {
        var text = String(message || '');
        var errorPattern = /失败|错误|不正确|不合法|不存在|不能为空|不能|不一致|至少|请|过期|已注册|未知接口|异常|网络|failed|error|invalid|expired/i;
        var successPattern = /成功|完成|已发送|已保存|已更新|已复制|通过|success/i;
        var toastType = type || (errorPattern.test(text) ? 'error' : (successPattern.test(text) ? 'success' : 'info'));
        if (window.UI && typeof window.UI.toast === 'function') {
            window.UI.toast({ type: toastType, message: text, placement: 'center' });
            return;
        }
        if (window.Swal && typeof window.Swal.fire === 'function') {
            window.Swal.fire(text);
            return;
        }
        window.alert(text);
    }

    function notifyAccountMergeResult() {
        var params;
        var stateValue;
        var message;
        try {
            params = new URLSearchParams(window.location.search || '');
        } catch (error) {
            return;
        }
        stateValue = params.get('member_merge');
        if (!stateValue) {
            return;
        }
        message = params.get('member_merge_msg') || (stateValue === 'success' ? '账号合并完成' : '账号合并失败');
        toast(message, stateValue === 'success' ? 'success' : 'error');
        params.delete('member_merge');
        params.delete('member_merge_msg');
        window.history.replaceState({}, document.title, window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash);
    }

    function formData(payload) {
        var data = new FormData();
        Object.keys(payload || {}).forEach(function (key) {
            data.append(key, payload[key] == null ? '' : payload[key]);
        });
        return data;
    }

    function requestAuthAction(payload) {
        return fetch('/member/auth_action.php', {
            method: 'POST',
            body: payload instanceof FormData ? payload : formData(payload),
            credentials: 'include'
        }).then(function (response) {
            return response.json();
        });
    }

    function requestLocalLogout() {
        return fetch('/member/auth_logout.php', {
            method: 'POST',
            credentials: 'include'
        }).then(function (response) {
            return response.json();
        });
    }

    function requestMemberProxy(payload) {
        var type = Number(payload instanceof FormData ? payload.get('type') : payload.type);
        return fetch('/member/api_proxy.php', {
            method: 'POST',
            body: payload instanceof FormData ? payload : formData(payload),
            credentials: 'include'
        }).then(function (response) {
            return response.json();
        }).then(function (res) {
            if (type !== 1 && Number(res && res.state) === 1) invalidateMemberDisplay();
            return res;
        });
    }

    function requestAccountMerge(payload) {
        return fetch('/member/account_merge.php', {
            method: 'POST',
            body: formData(payload),
            credentials: 'include'
        }).then(function (response) {
            return response.json();
        });
    }

    function clearMemberProfile() {
        profileGeneration += 1;
        profileCache = null;
        profileRequest = null;
    }

    function clearPendingMemberDisplay() {
        activeRefresh = null;
        activeStateRequest = null;
        displayedState = null;
        clearMemberProfile();
    }

    function invalidateMemberDisplay() {
        clearPendingMemberDisplay();
        memberState.invalidate();
    }

    function requestFreshMemberProfile() {
        var uid = String(state.userid);
        var age = profileCache ? Date.now() - profileCache.at : -1;
        if (profileCache && profileCache.userid === uid && age >= 0 && age < 300000) {
            return Promise.resolve(profileCache.response);
        }
        if (profileRequest && profileRequest.userid === uid) return profileRequest.promise;
        var revision = profileGeneration;
        var pending = requestMemberProxy({type: 1}).then(function (res) {
            if (revision !== profileGeneration || uid !== String(state.userid) ||
                Number(res && res.state) !== 1 || String(res.data && res.data.userid) !== uid) return null;
            profileCache = {userid: uid, at: Date.now(), response: res};
            return res;
        }).catch(function () {
            return null;
        }).finally(function () {
            if (profileRequest && profileRequest.promise === pending) profileRequest = null;
        });
        profileRequest = {userid: uid, promise: pending};
        return pending;
    }

    function memberAssetOrigin() {
        return String(window.TOPHEADER_MEMBER_ASSET_ORIGIN || 'https://u2.dvg.cn').replace(/\/+$/, '');
    }

    function normalizeMemberAssetUrl(url) {
        url = String(url || '').trim();
        if (!url) return '';
        var origin = memberAssetOrigin();
        var paths = ['/upload/avatar/', '/static/images/'];
        for (var i = 0; i < paths.length; i += 1) {
            var path = paths[i];
            if (url.indexOf(path) === 0) {
                return origin + url;
            }
        }
        return url;
    }

    function setButtonLoading(button, text, loading) {
        if (!button) {
            return;
        }
        if (!button.dataset.idleText) {
            button.dataset.idleText = button.textContent;
        }
        button.disabled = !!loading;
        button.textContent = loading ? text : button.dataset.idleText;
    }

    function normalizeUser(data) {
        data = data || {};
        var sameAccount = !!data.userid && String(data.userid) === String(state.userid);
        state.userid = data.userid || '';
        state.isLogin = Number(data.is_login || 0);
        state.username = data.username || '';
        state.nickname = data.nickname || data.username || '';
        state.email = data.email || '';
        state.userfen = Object.prototype.hasOwnProperty.call(data, 'userfen') ? Number(data.userfen || 0) : (state.isLogin ? null : 0);
        state.emailBound = Number(data.email_bound || 0);
        state.hasPassword = Number(data.has_password || 0);
        if (!sameAccount || Object.prototype.hasOwnProperty.call(data, 'can_change_username')) {
            state.canChangeUsername = Number(data.can_change_username || 0);
        }
        state.isWechatAccount = Number(data.is_wechat_account || 0);
        state.canMergeWechat = Number(data.can_merge_wechat || 0);
        state.level = data.level || null;
        state.levelBadge = data.level_badge || (state.level && state.level.badge) || 'Lv.1 初心者';
        state.avatar = normalizeMemberAssetUrl(data.useravatar || defaultAvatar);
    }

    function renderUserfen() {
        document.querySelectorAll('[data-profile-userfen]').forEach(function (profileUserfen) {
            profileUserfen.textContent = state.userfen === null ? '读取中' : Number(state.userfen || 0).toLocaleString('zh-CN');
        });
    }

    function renderUserLevel() {
        document.querySelectorAll('[data-profile-level-badge]').forEach(function (profileLevel) {
            profileLevel.textContent = state.levelBadge || 'Lv.1 初心者';
        });
    }

    function renderTopUser() {
        var name = state.nickname || state.username || '会员';
        loginButton.classList.toggle('tw-hidden', state.isLogin === 1);
        setHidden(menuWrap, state.isLogin !== 1);
        if (menuAvatar) {
            menuAvatar.src = state.avatar || defaultAvatar;
        }
        if (menuName) {
            menuName.textContent = name;
        }
    }

    function renderProfile() {
        var nickname = state.nickname || state.username || '未登录用户';
        var avatar = state.avatar || defaultAvatar;
        var profileAvatar = $('[data-profile-avatar]');
        var profileNickname = $('[data-profile-nickname]');
        var profileUserid = $('[data-profile-userid]');
        var profileUseridCopy = $('[data-profile-copy-userid]');
        var profileUsername = $('[data-profile-username]');
        var nicknameInput = $('[data-profile-nickname-input]');
        var usernameCard = $('[data-username-card]');
        var usernameInput = $('[data-profile-username-input]');
        var emailInput = $('[data-profile-email-input]');
        var passwordState = $('[data-profile-password-state]');
        var emailState = $('[data-profile-email-state]');
        var emailButton = $('[data-profile-save-email]');
        var setPasswordCard = $('[data-set-password-card]');
        var changePasswordCard = $('[data-change-password-card]');
        var accountMergeCard = $('[data-account-merge-card]');

        if (profileAvatar) profileAvatar.src = avatar;
        if (profileNickname) profileNickname.textContent = nickname;
        if (profileUserid) profileUserid.textContent = state.userid || 0;
        if (profileUseridCopy) profileUseridCopy.dataset.uiCopyText = String(state.userid || 0);
        if (profileUsername) profileUsername.textContent = state.username || '--';
        renderUserfen();
        renderUserLevel();
        if (nicknameInput) nicknameInput.value = nickname;
        if (usernameInput) usernameInput.value = state.username || '';
        if (emailInput) emailInput.value = state.email || '';
        setHidden(usernameCard, state.canChangeUsername !== 1);

        if (passwordState) {
            passwordState.textContent = state.hasPassword ? '已设置密码' : '未设置密码';
            passwordState.className = 'member-pill ' + (state.hasPassword ? 'is-good' : 'is-warn');
        }
        if (emailState) {
            emailState.textContent = state.emailBound ? '已绑定邮箱' : '未绑定邮箱';
            emailState.className = 'member-pill ' + (state.emailBound ? 'is-info' : '');
        }
        if (emailButton) {
            emailButton.textContent = state.emailBound ? '更新邮箱' : '绑定邮箱';
            emailButton.dataset.idleText = emailButton.textContent;
        }
        setHidden(setPasswordCard, !!state.hasPassword);
        setHidden(changePasswordCard, !state.hasPassword);
        setHidden(accountMergeCard, state.canMergeWechat !== 1);
    }

    function applyUserResponse(res) {
        var previousUserid = state.userid;
        var previousPoints = state.userfen;
        normalizeUser((res && res.data) || {});
        if (String(previousUserid) !== String(state.userid)) {
            clearMemberProfile();
            if (!state.isLogin && isDrawerOpen() && !profileView.classList.contains('tw-hidden')) closeDrawer();
        }
        renderTopUser();
        renderProfile();
        window.UIV8_MEMBER_AUTH_STATE = res || { data: {} };
        window.dispatchEvent(new CustomEvent('uiv8:authchange', {
            detail: {
                user: {
                    is_login: state.isLogin,
                    userid: state.userid,
                    username: state.username,
                    nickname: state.nickname,
                    email: state.email,
                    userfen: state.userfen,
                    level: state.level,
                    level_badge: state.levelBadge,
                    email_bound: state.emailBound,
                    has_password: state.hasPassword,
                    can_change_username: state.canChangeUsername,
                    is_wechat_account: state.isWechatAccount,
                    can_merge_wechat: state.canMergeWechat,
                    useravatar: state.avatar
                }
            }
        }));
        if (state.isLogin && (String(previousUserid) !== String(state.userid) || previousPoints !== state.userfen)) {
            window.dispatchEvent(new CustomEvent('uiv8:userfenchange', {
                detail: {userid: state.userid, userfen: state.userfen, level: state.level, level_badge: state.levelBadge}
            }));
        }
    }

    function withAvatarCacheBust(avatarUrl) {
        if (!avatarUrl || /^(data:|blob:)/i.test(avatarUrl)) return avatarUrl;
        return avatarUrl + (avatarUrl.indexOf('?') === -1 ? '?' : '&') + 'v=' + Date.now();
    }

    function applyExternalMemberAvatar(avatarUrl) {
        avatarUrl = normalizeMemberAssetUrl(avatarUrl || '');
        if (!avatarUrl) return;
        state.avatar = withAvatarCacheBust(avatarUrl);
        if (window.UIV8_MEMBER_AUTH_STATE && window.UIV8_MEMBER_AUTH_STATE.data) {
            window.UIV8_MEMBER_AUTH_STATE.data.useravatar = avatarUrl;
        }
        renderTopUser();
        renderProfile();
        invalidateMemberDisplay();
        refreshUser(true);
    }

    window.addEventListener('uiv8:member-avatar-updated', function (event) {
        var detail = (event && event.detail) || {};
        applyExternalMemberAvatar(detail.useravatar || detail.avatar_url || detail.avatarUrl);
    });

    window.addEventListener('message', function (event) {
        var data = event && event.data ? event.data : {};
        if (!data || data.type !== 'uiv8:member-avatar-updated') return;
        applyExternalMemberAvatar(data.useravatar || data.avatar_url || data.avatarUrl);
    });

    function refreshUser(force) {
        var request = memberState.request(force);
        if (activeStateRequest === request) return activeRefresh;
        activeStateRequest = request;
        var pending = request.then(function (res) {
            if (activeRefresh === pending && displayedState !== res) {
                displayedState = res;
                applyUserResponse(res);
            }
        }).catch(function () {
            var identity = window.UIV8_MEMBER_PAGE_IDENTITY || {};
            if (activeRefresh === pending && identity.expires && Number(identity.expires) * 1000 <= Date.now() &&
                !memberState.snapshot()) applyUserResponse({state: 1, data: {is_login: 0}});
        }).finally(function () {
            if (activeRefresh === pending) {
                activeStateRequest = null;
                activeRefresh = null;
            }
        });
        activeRefresh = pending;
        return pending;
    }

    function openDrawer(mode) {
        var isForgot = mode === 'forgot';
        if (window.UI && window.UI.drawer && typeof window.UI.drawer.open === 'function') {
            window.UI.drawer.open(drawer);
        } else {
            drawer.classList.add('is-open');
            if (drawerOverlay) drawerOverlay.classList.add('is-open');
            document.body.classList.add('tw-overflow-hidden');
        }
        setHidden(profileView, isForgot);
        setHidden(forgotView, !isForgot);
        setHidden(drawerFooter, isForgot);
        if (isForgot) {
            setHidden(forgotForm, false);
            setHidden(forgotActions, false);
            setHidden(forgotSuccess, true);
        }
        drawerTitle.textContent = isForgot ? '找回密码' : '资料设置';
        drawerIcon.className = (isForgot ? 'tw-icon-[mdi--email-fast-outline]' : 'tw-icon-[mdi--account-cog-outline]') + ' tw-text-[20px]';
    }

    function closeDrawer() {
        if (window.UI && window.UI.drawer && typeof window.UI.drawer.close === 'function') {
            window.UI.drawer.close(drawer);
        } else {
            drawer.classList.remove('is-open');
            if (drawerOverlay) drawerOverlay.classList.remove('is-open');
            document.body.classList.remove('tw-overflow-hidden');
        }
        clearResetTimer();
    }

    function isDrawerOpen() {
        return drawer.classList.contains('is-open') || drawer.classList.contains('tw-translate-x-0') || drawer.classList.contains('tw-translate-y-0');
    }

    function openAuthModal(panel) {
        if (!authModal.classList.contains('is-open')) authTrigger = document.activeElement;
        authModal.classList.add('is-open');
        document.body.classList.add('tw-overflow-hidden');
        switchAuthPanel(panel || 'login');
        if (authClose) authClose.focus();
    }

    function closeAuthModal() {
        if (!authModal.classList.contains('is-open')) return;
        authModal.classList.remove('is-open');
        if (authTrigger && authTrigger.isConnected) authTrigger.focus();
        authTrigger = null;
        if (!isDrawerOpen()) {
            document.body.classList.remove('tw-overflow-hidden');
        }
    }

    function switchAuthPanel(panel) {
        authTabs.forEach(function (tab) {
            tab.classList.toggle('is-active', tab.dataset.authTab === panel);
        });
        document.querySelectorAll('[data-auth-panel]').forEach(function (item) {
            setHidden(item, item.dataset.authPanel !== panel);
        });
    }

    function clearResetTimer() {
        if (state.resetTimer) {
            clearInterval(state.resetTimer);
            state.resetTimer = null;
        }
        state.resetCountdown = 0;
        var button = $('[data-send-reset-code]');
        if (button) {
            button.disabled = false;
            button.textContent = button.dataset.idleText || '发送验证码';
        }
    }

    function startResetCountdown(seconds) {
        var button = $('[data-send-reset-code]');
        clearResetTimer();
        state.resetCountdown = Number(seconds) || 60;
        if (!button.dataset.idleText) {
            button.dataset.idleText = button.textContent;
        }
        button.disabled = true;
        button.textContent = state.resetCountdown + 's后重发';
        state.resetTimer = setInterval(function () {
            state.resetCountdown -= 1;
            if (state.resetCountdown <= 0) {
                clearResetTimer();
                return;
            }
            button.textContent = state.resetCountdown + 's后重发';
        }, 1000);
    }

    function clearRegisterTimer() {
        if (state.registerTimer) {
            clearInterval(state.registerTimer);
            state.registerTimer = null;
        }
        state.registerCountdown = 0;
        var button = $('[data-send-register-code]');
        if (button) {
            button.disabled = false;
            button.textContent = button.dataset.idleText || '发送验证码';
        }
    }

    function startRegisterCountdown(seconds) {
        var button = $('[data-send-register-code]');
        clearRegisterTimer();
        if (!button) return;
        state.registerCountdown = Number(seconds) || 60;
        if (!button.dataset.idleText) {
            button.dataset.idleText = button.textContent;
        }
        button.disabled = true;
        button.textContent = state.registerCountdown + 's后重发';
        state.registerTimer = setInterval(function () {
            state.registerCountdown -= 1;
            if (state.registerCountdown <= 0) {
                clearRegisterTimer();
                return;
            }
            button.textContent = state.registerCountdown + 's后重发';
        }, 1000);
    }

    loginButton.addEventListener('click', function () {
        openAuthModal('login');
    });

    if (authClose) authClose.addEventListener('click', closeAuthModal);
    authModal.addEventListener('click', function (event) {
        if (event.target === authModal) {
            closeAuthModal();
        }
    });
    authTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            switchAuthPanel(tab.dataset.authTab);
        });
    });

    function openProfileDrawer() {
        if (state.isLogin !== 1) {
            openAuthModal('login');
            return;
        }
        renderProfile();
        openDrawer('profile');
        refreshUser(false).then(function () {
            if (!state.isLogin || !isDrawerOpen() || profileView.classList.contains('tw-hidden')) return;
            var revision = profileGeneration;
            return requestFreshMemberProfile().then(function (res) {
                if (res && revision === profileGeneration && isDrawerOpen() &&
                    !profileView.classList.contains('tw-hidden')) applyUserResponse(res);
            });
        });
    }

    if (avatarOpenButton) {
        avatarOpenButton.addEventListener('click', openProfileDrawer);
    }
    if (profileButton) {
        profileButton.addEventListener('click', function () {
            if (state.isLogin !== 1) {
                openAuthModal('login');
                return;
            }
            openProfileDrawer();
        });
    }
    if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);
    document.addEventListener('click', function (event) {
        if (event.target && event.target.matches('[data-ui-drawer-backdrop]') && activeDrawerMatchesMember()) {
            clearResetTimer();
        }
    });

    function activeDrawerMatchesMember() {
        return isDrawerOpen();
    }

    $('[data-submit-login]').addEventListener('click', function (event) {
        var button = event.currentTarget;
        var account = ($('[data-login-account]').value || '').trim();
        var password = ($('[data-login-password]').value || '').trim();
        if (!account) return toast('请输入用户名或邮箱');
        if (!password) return toast('请输入密码');
        setButtonLoading(button, '登录中...', true);
        requestAuthAction({
            type: 1001,
            account: account,
            password: password,
            remember: $('[data-login-remember]').checked ? 1 : 0
        }).then(function (res) {
            if (Number(res.state) === 1) {
                closeAuthModal();
                toast(res.msg || '登录成功', 'success');
                invalidateMemberDisplay();
                refreshUser(true);
            } else {
                toast(res.msg || '登录失败', 'error');
            }
        }).catch(function () {
            toast('网络错误', 'error');
        }).finally(function () {
            setButtonLoading(button, '登录中...', false);
        });
    });

    $('[data-submit-register]').addEventListener('click', function (event) {
        var button = event.currentTarget;
        var username = ($('[data-register-username]').value || '').trim();
        var email = ($('[data-register-email]').value || '').trim();
        var emailCode = ($('[data-register-email-code]').value || '').trim();
        var password = ($('[data-register-password]').value || '').trim();
        var confirmPassword = ($('[data-register-confirm]').value || '').trim();
        if (!username) return toast('请输入用户名');
        if (!email) return toast('请输入邮箱');
        if (!/^\d{6}$/.test(emailCode)) return toast('请输入 6 位邮箱验证码');
        if (!password) return toast('请输入密码');
        if (password !== confirmPassword) return toast('两次输入的密码不一致');
        if (!$('[data-register-agree]').checked) return toast('请先阅读并同意用户协议与隐私政策');
        setButtonLoading(button, '注册中...', true);
        requestAuthAction({
            type: 1002,
            username: username,
            email: email,
            email_code: emailCode,
            password: password,
            confirm_password: confirmPassword,
            agree_policy: 1
        }).then(function (res) {
            if (Number(res.state) === 1) {
                closeAuthModal();
                toast(res.msg || '注册成功', 'success');
                invalidateMemberDisplay();
                refreshUser(true);
            } else {
                toast(res.msg || '注册失败', 'error');
            }
        }).catch(function () {
            toast('网络错误', 'error');
        }).finally(function () {
            setButtonLoading(button, '注册中...', false);
        });
    });

    $('[data-send-register-code]').addEventListener('click', function (event) {
        var button = event.currentTarget;
        var email = ($('[data-register-email]').value || '').trim();
        if (!email) return toast('请输入邮箱');
        setButtonLoading(button, '发送中...', true);
        requestAuthAction({ type: 1012, email: email }).then(function (res) {
            if (Number(res.state) === 1) {
                startRegisterCountdown((res.data && res.data.countdown) || 60);
                toast(res.msg || '验证码已发送', 'success');
            } else {
                toast(res.msg || '发送失败', 'error');
                setButtonLoading(button, '发送中...', false);
            }
        }).catch(function () {
            toast('网络错误', 'error');
            setButtonLoading(button, '发送中...', false);
        });
    });

    if (logoutButton) {
        logoutButton.addEventListener('click', function () {
            requestLocalLogout().then(function (res) {
                if (Number(res && res.state) !== 1) {
                    toast((res && res.msg) || '退出失败');
                    return;
                }
                invalidateMemberDisplay();
                closeDrawer();
                applyUserResponse(res);
                loginButton.focus();
                toast((res && res.msg) || '退出成功', 'success');
            }).catch(function () {
                toast('网络错误');
            });
        });
    }

    $('[data-profile-save-nickname]').addEventListener('click', function (event) {
        var button = event.currentTarget;
        var nickname = ($('[data-profile-nickname-input]').value || '').trim();
        if (!nickname) return toast('昵称不能为空');
        setButtonLoading(button, '保存中...', true);
        requestMemberProxy({ type: 1005, nickname: nickname }).then(function (res) {
            if (Number(res.state) === 1) {
                state.nickname = (res.data && res.data.nickname) || nickname;
                renderTopUser();
                renderProfile();
                toast(res.msg || '昵称修改成功', 'success');
            } else {
                toast(res.msg || '昵称修改失败');
            }
        }).catch(function () {
            toast('网络错误');
        }).finally(function () {
            setButtonLoading(button, '保存中...', false);
        });
    });

    $('[data-profile-save-username]').addEventListener('click', function (event) {
        var button = event.currentTarget;
        var usernameValue = ($('[data-profile-username-input]').value || '').trim();
        if (!usernameValue) return toast('用户名不能为空');
        if (!/^[A-Za-z0-9_]{3,20}$/.test(usernameValue)) return toast('用户名需为 3-20 位字母、数字或下划线');
        setButtonLoading(button, '保存中...', true);
        requestMemberProxy({ type: 1016, username: usernameValue }).then(function (res) {
            if (Number(res.state) === 1) {
                state.username = (res.data && res.data.username) || usernameValue;
                state.nickname = (res.data && res.data.nickname) || state.username;
                state.canChangeUsername = Number((res.data && res.data.can_change_username) || 0);
                renderTopUser();
                renderProfile();
                toast(res.msg || '用户名修改成功', 'success');
            } else {
                toast(res.msg || '用户名修改失败', 'error');
            }
        }).catch(function () {
            toast('网络错误', 'error');
        }).finally(function () {
            setButtonLoading(button, '保存中...', false);
        });
    });

    $('[data-profile-save-email]').addEventListener('click', function (event) {
        var button = event.currentTarget;
        var email = ($('[data-profile-email-input]').value || '').trim();
        if (!email) return toast('邮箱不能为空');
        setButtonLoading(button, '提交中...', true);
        requestMemberProxy({ type: 1007, email: email }).then(function (res) {
            if (Number(res.state) === 1) {
                state.email = (res.data && res.data.email) || email;
                state.emailBound = 1;
                renderProfile();
                toast(res.msg || '邮箱保存成功', 'success');
            } else {
                toast(res.msg || '邮箱保存失败');
            }
        }).catch(function () {
            toast('网络错误');
        }).finally(function () {
            setButtonLoading(button, '提交中...', false);
        });
    });

    if ($('[data-account-merge-wechat]')) {
        $('[data-account-merge-wechat]').addEventListener('click', function (event) {
            var button = event.currentTarget;
            if (state.canMergeWechat !== 1) {
                return toast('当前账号暂不需要合并');
            }
            if (!window.confirm('确认后将使用微信账号作为主账号，并把当前邮箱账号的数据合并过去。是否继续？')) {
                return;
            }
            setButtonLoading(button, '准备中...', true);
            requestAccountMerge({
                action: 'start',
                return_url: window.location.href
            }).then(function (res) {
                if (Number(res && res.state) === 1 && res.data && res.data.url) {
                    window.location.href = res.data.url;
                } else {
                    toast((res && res.msg) || '合并发起失败', 'error');
                    setButtonLoading(button, '准备中...', false);
                }
            }).catch(function () {
                toast('网络错误', 'error');
                setButtonLoading(button, '准备中...', false);
            });
        });
    }

    $('[data-submit-set-password]').addEventListener('click', function (event) {
        var button = event.currentTarget;
        var password = ($('[data-set-password]').value || '').trim();
        var confirmPassword = ($('[data-set-password-confirm]').value || '').trim();
        if (!password || !confirmPassword) return toast('请完整填写密码');
        if (password.length < 6) return toast('密码至少 6 位');
        if (password !== confirmPassword) return toast('两次输入的密码不一致');
        setButtonLoading(button, '设置中...', true);
        requestMemberProxy({ type: 1008, password: password, confirm_password: confirmPassword }).then(function (res) {
            if (Number(res.state) === 1) {
                state.hasPassword = 1;
                $('[data-set-password]').value = '';
                $('[data-set-password-confirm]').value = '';
                renderProfile();
                toast(res.msg || '密码设置成功', 'success');
            } else {
                toast(res.msg || '密码设置失败');
            }
        }).catch(function () {
            toast('网络错误');
        }).finally(function () {
            setButtonLoading(button, '设置中...', false);
        });
    });

    $('[data-submit-change-password]').addEventListener('click', function (event) {
        var button = event.currentTarget;
        var oldPassword = ($('[data-change-old-password]').value || '').trim();
        var newPassword = ($('[data-change-new-password]').value || '').trim();
        var confirmPassword = ($('[data-change-confirm-password]').value || '').trim();
        if (!oldPassword || !newPassword || !confirmPassword) return toast('请完整填写密码信息');
        if (newPassword.length < 6) return toast('新密码至少 6 位');
        if (newPassword !== confirmPassword) return toast('两次输入的新密码不一致');
        if (oldPassword === newPassword) return toast('新密码不能与旧密码相同');
        setButtonLoading(button, '修改中...', true);
        requestMemberProxy({
            type: 1009,
            old_password: oldPassword,
            new_password: newPassword,
            confirm_password: confirmPassword
        }).then(function (res) {
            if (Number(res.state) === 1) {
                $('[data-change-old-password]').value = '';
                $('[data-change-new-password]').value = '';
                $('[data-change-confirm-password]').value = '';
                toast(res.msg || '密码修改成功', 'success');
            } else {
                toast(res.msg || '密码修改失败');
            }
        }).catch(function () {
            toast('网络错误');
        }).finally(function () {
            setButtonLoading(button, '修改中...', false);
        });
    });

    $('[data-profile-avatar-input]').addEventListener('change', function (event) {
        var file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
        var status = $('[data-profile-avatar-status]');
        var data;
        if (!file) return;
        if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].indexOf(file.type) === -1) {
            event.target.value = '';
            return toast('请上传 jpg、png、webp 或 gif 图片');
        }
        if (file.size > 300 * 1024) {
            event.target.value = '';
            return toast('头像不能超过 300KB');
        }
        data = new FormData();
        data.append('type', 1006);
        data.append('avatar', file);
        setHidden(status, false);
        requestMemberProxy(data).then(function (res) {
            if (Number(res.state) === 1) {
                state.avatar = normalizeMemberAssetUrl((res.data && (res.data.useravatar || res.data.newurl)) || defaultAvatar);
                if (window.UIV8_MEMBER_AUTH_STATE && window.UIV8_MEMBER_AUTH_STATE.data) {
                    window.UIV8_MEMBER_AUTH_STATE.data.useravatar = state.avatar;
                }
                window.dispatchEvent(new CustomEvent('uiv8:authchange', {
                    detail: {
                        user: {
                            is_login: state.isLogin,
                            userid: state.userid,
                            username: state.username,
                            nickname: state.nickname,
                            email: state.email,
                            email_bound: state.emailBound,
                            has_password: state.hasPassword,
                            can_change_username: state.canChangeUsername,
                            useravatar: state.avatar
                        }
                    }
                }));
                renderTopUser();
                renderProfile();
                toast(res.msg || '头像更新成功', 'success');
            } else {
                toast(res.msg || '头像上传失败');
            }
        }).catch(function () {
            toast('网络错误');
        }).finally(function () {
            setHidden(status, true);
            event.target.value = '';
        });
    });

    $('[data-open-forgot]').addEventListener('click', function () {
        closeAuthModal();
        openDrawer('forgot');
    });
    $('[data-forgot-back]').addEventListener('click', function () {
        if (state.isLogin === 1) {
            openDrawer('profile');
        } else {
            closeDrawer();
            openAuthModal('login');
        }
    });
    $('[data-forgot-login]').addEventListener('click', function () {
        closeDrawer();
        openAuthModal('login');
    });
    $('[data-send-reset-code]').addEventListener('click', function (event) {
        var button = event.currentTarget;
        var email = ($('[data-forgot-email]').value || '').trim();
        if (!email) return toast('请输入邮箱');
        setButtonLoading(button, '发送中...', true);
        requestAuthAction({ type: 1010, email: email }).then(function (res) {
            if (Number(res.state) === 1) {
                startResetCountdown((res.data && res.data.countdown) || 60);
                toast(res.msg || '验证码已发送', 'success');
            } else {
                toast(res.msg || '发送失败');
                setButtonLoading(button, '发送中...', false);
            }
        }).catch(function () {
            toast('网络错误');
            setButtonLoading(button, '发送中...', false);
        });
    });
    $('[data-submit-forgot-password]').addEventListener('click', function (event) {
        var button = event.currentTarget;
        var email = ($('[data-forgot-email]').value || '').trim();
        var code = ($('[data-forgot-code]').value || '').trim();
        var newPassword = ($('[data-forgot-new-password]').value || '').trim();
        var confirmPassword = ($('[data-forgot-confirm-password]').value || '').trim();
        if (!email || !code || !newPassword || !confirmPassword) return toast('请完整填写找回信息');
        if (newPassword.length < 6) return toast('新密码至少 6 位');
        if (newPassword !== confirmPassword) return toast('两次输入的新密码不一致');
        setButtonLoading(button, '提交中...', true);
        requestAuthAction({
            type: 1011,
            email: email,
            code: code,
            new_password: newPassword,
            confirm_password: confirmPassword
        }).then(function (res) {
            if (Number(res.state) === 1) {
                clearResetTimer();
                setHidden(forgotForm, true);
                setHidden(forgotActions, true);
                setHidden(forgotSuccess, false);
            } else {
                toast(res.msg || '重置失败');
            }
        }).catch(function () {
            toast('网络错误');
        }).finally(function () {
            setButtonLoading(button, '提交中...', false);
        });
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            if (authModal.classList.contains('is-open')) closeAuthModal();
            else if (isDrawerOpen()) closeDrawer();
        }
        if (event.key !== 'Tab' || !authModal.classList.contains('is-open')) return;
        var controls = Array.prototype.filter.call(authModal.querySelectorAll('a[href], button, input'), function (el) {
            return !el.disabled && el.getClientRects().length;
        });
        var edge = event.shiftKey ? controls[0] : controls[controls.length - 1];
        if (edge && (document.activeElement === edge || !authModal.contains(document.activeElement))) {
            event.preventDefault();
            (event.shiftKey ? controls[controls.length - 1] : controls[0]).focus();
        }
    });

    var lastReturnRefreshAt = 0;
    function refreshOnReturn() {
        var now = Date.now();
        if (document.hidden || now - lastReturnRefreshAt < 1000) return;
        lastReturnRefreshAt = now;
        refreshUser(false);
    }
    window.addEventListener('focus', refreshOnReturn);
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) refreshOnReturn();
    });
    document.addEventListener('visibilitychange', refreshOnReturn);
    window.addEventListener('uiv8:member-display-invalidated', function () {
        clearPendingMemberDisplay();
        if (!document.hidden) refreshUser(true);
    });
    document.addEventListener('member-points-updated', function () {
        invalidateMemberDisplay();
        refreshUser(true);
    });

    var displaySnapshot = memberState.snapshot();
    var identity = window.UIV8_MEMBER_PAGE_IDENTITY || {};
    if (displaySnapshot) {
        displayedState = displaySnapshot;
        applyUserResponse(displaySnapshot);
    } else if (identity.userid) {
        normalizeUser({is_login: 1, userid: identity.userid, useravatar: menuAvatar && menuAvatar.getAttribute('src')});
        renderTopUser();
    }
    notifyAccountMergeResult();
    refreshUser(false);
}
