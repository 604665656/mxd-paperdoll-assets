(function () {
    /*
     * 通用全局搜索组件
     *
     * 顶部/任意按钮触发：
     * <button data-ui-global-search-open>Search</button>
     *
     * 弹窗容器：
     * <div data-ui-global-search data-ui-search-api="/api/search.php" data-ui-search-page="/search.php" data-ui-search-tip="true"></div>
     *
     * 独立页容器：
     * <div data-ui-global-search-page data-ui-search-api="/api/search.php" data-ui-search-tip="true"></div>
     *
     * 可选参数：
     * data-ui-search-tip="false"   关闭结果 hover TIP
     * data-ui-search-limit="20"    每页数量
     * data-ui-search-page="/search.php"  回车跳转的独立搜索页
     */

    const stateMap = new WeakMap();
    const typeIcons = {
        all: 'tw-icon-[mdi--shape-outline]',
    };

    function qs(selector, root = document) {
        return root.querySelector(selector);
    }

    function qsa(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        })[char]);
    }

    function debounce(fn, wait = 400) {
        let timer = null;
        return function (...args) {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => fn.apply(this, args), wait);
        };
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('zh-CN');
    }

    function normalizeLength(value) {
        const text = String(value ?? '').trim();
        if (!text || text === '0') return '0px';
        if (/^-?\d+(\.\d+)?$/.test(text)) return `${text}px`;
        return text;
    }

    function normalizePlacement(value) {
        const placement = String(value || 'center').toLowerCase().trim();
        const allowed = new Set([
            'center',
            'top',
            'bottom',
            'left',
            'right',
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
            'custom',
        ]);
        return allowed.has(placement) ? placement : 'center';
    }

    function normalizeIcon(src) {
        if (!src) return '';
        if (/^https?:\/\//i.test(src) || src.charAt(0) === '/') {
            return `<img class="tw-h-full tw-w-full tw-object-contain" src="${escapeHtml(src)}" alt="" loading="lazy">`;
        }
        return `<span class="${escapeHtml(src)}"></span>`;
    }

    function getConfig(root) {
        return {
            api: root.dataset.uiSearchApi || '/api/search.php',
            page: root.dataset.uiSearchPage || '/search.php',
            limit: Math.max(1, Math.min(Number(root.dataset.uiSearchLimit || 20), 50)),
            tip: !['0', 'false', 'off', 'no'].includes(String(root.dataset.uiSearchTip ?? 'true').toLowerCase()),
            mode: root.hasAttribute('data-ui-global-search-page') ? 'page' : 'modal',
            placement: normalizePlacement(root.dataset.uiSearchPlacement),
            offsetX: normalizeLength(root.dataset.uiSearchOffsetX),
            offsetY: normalizeLength(root.dataset.uiSearchOffsetY),
            left: normalizeLength(root.dataset.uiSearchLeft),
            top: normalizeLength(root.dataset.uiSearchTop),
        };
    }

    function createState(root) {
        const config = getConfig(root);
        const state = {
            root,
            config,
            input: qs('[data-ui-search-input]', root),
            clear: qs('[data-ui-search-clear]', root),
            close: qs('[data-ui-search-close]', root),
            panel: qs('[data-ui-search-panel]', root),
            dragHandle: qs('[data-ui-search-drag-handle]', root),
            tabs: qs('[data-ui-search-tabs]', root),
            list: qs('[data-ui-search-results]', root),
            loadMore: qs('[data-ui-search-more]', root),
            status: qs('[data-ui-search-status]', root),
            backdrop: qs('[data-ui-search-backdrop]'),
            q: '',
            typeid: 0,
            offset: 0,
            total: 0,
            counts: [],
            items: [],
            loading: false,
            hasMore: false,
            token: 0,
            requestController: null,
            openPlacement: config.placement,
            openOffsetX: config.offsetX,
            openOffsetY: config.offsetY,
            openLeft: config.left,
            openTop: config.top,
        };
        state.searchDebounced = debounce(() => {
            state.offset = 0;
            fetchResults(state, false);
        });
        stateMap.set(root, state);
        return state;
    }

    function setOpen(state, open, options = null) {
        if (state.config.mode !== 'modal') return;
        if (open) {
            state.openPlacement = normalizePlacement(options?.placement || state.config.placement);
            state.openOffsetX = normalizeLength(options?.offsetX ?? state.config.offsetX);
            state.openOffsetY = normalizeLength(options?.offsetY ?? state.config.offsetY);
            state.openLeft = normalizeLength(options?.left ?? state.config.left);
            state.openTop = normalizeLength(options?.top ?? state.config.top);
        }
        state.root.classList.toggle('tw-hidden', !open);
        state.root.classList.toggle('tw-flex', open);
        if (state.backdrop) {
            state.backdrop.classList.toggle('tw-hidden', !open);
            state.backdrop.classList.toggle('tw-block', open);
        }
        document.body.classList.toggle('tw-overflow-hidden', open);
        if (open) {
            resetModalPosition(state);
            window.setTimeout(() => state.input && state.input.focus(), 20);
            if (!state.items.length && !state.loading) fetchResults(state, false);
        }
    }

    function resetModalPosition(state) {
        if (state.config.mode !== 'modal' || !state.panel) return;
        const placement = normalizePlacement(state.openPlacement || state.config.placement);
        const offsetX = normalizeLength(state.openOffsetX ?? state.config.offsetX);
        const offsetY = normalizeLength(state.openOffsetY ?? state.config.offsetY);
        const customLeft = normalizeLength(state.openLeft ?? state.config.left);
        const customTop = normalizeLength(state.openTop ?? state.config.top);
        const [vertical, horizontal] = placement.includes('-') ? placement.split('-') : [placement, placement];

        state.root.classList.remove('tw-items-start', 'tw-items-center', 'tw-items-end', 'tw-justify-start', 'tw-justify-center', 'tw-justify-end');
        state.root.classList.add(
            vertical === 'top' ? 'tw-items-start' : vertical === 'bottom' ? 'tw-items-end' : 'tw-items-center',
            horizontal === 'left' ? 'tw-justify-start' : horizontal === 'right' ? 'tw-justify-end' : 'tw-justify-center',
        );
        if (placement === 'custom') {
            state.panel.style.position = 'fixed';
            state.panel.style.left = customLeft;
            state.panel.style.top = customTop;
            state.panel.style.transform = offsetX !== '0px' || offsetY !== '0px'
                ? `translate(${offsetX}, ${offsetY})`
                : 'none';
            state.panel.style.marginLeft = '0';
            state.panel.style.marginTop = '0';
            return;
        }
        state.panel.style.position = '';
        state.panel.style.left = '';
        state.panel.style.top = '';
        state.panel.style.transform = offsetX !== '0px' || offsetY !== '0px'
            ? `translate(${offsetX}, ${offsetY})`
            : '';
        state.panel.style.marginLeft = '';
        state.panel.style.marginTop = '';
    }

    function bindDrag(state) {
        if (state.config.mode !== 'modal' || !state.panel || !state.dragHandle) return;
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let baseX = 0;
        let baseY = 0;

        state.dragHandle.addEventListener('pointerdown', (event) => {
            if (event.target.closest('input,textarea,select,button,a,[data-no-drag]')) return;
            dragging = true;
            startX = event.clientX;
            startY = event.clientY;
            const rect = state.panel.getBoundingClientRect();
            baseX = rect.left;
            baseY = rect.top;
            state.panel.style.position = 'fixed';
            state.panel.style.left = `${baseX}px`;
            state.panel.style.top = `${baseY}px`;
            state.panel.style.marginLeft = '0';
            state.panel.style.marginTop = '0';
            state.panel.style.transform = 'none';
            state.dragHandle.setPointerCapture(event.pointerId);
            event.preventDefault();
        });

        state.dragHandle.addEventListener('pointermove', (event) => {
            if (!dragging) return;
            const panelRect = state.panel.getBoundingClientRect();
            const maxX = Math.max(12, window.innerWidth - panelRect.width - 12);
            const maxY = Math.max(12, window.innerHeight - panelRect.height - 12);
            const x = Math.max(12, Math.min(baseX + event.clientX - startX, maxX));
            const y = Math.max(12, Math.min(baseY + event.clientY - startY, maxY));
            state.panel.style.left = `${x}px`;
            state.panel.style.top = `${y}px`;
        });

        state.dragHandle.addEventListener('pointerup', () => {
            dragging = false;
        });

        state.dragHandle.addEventListener('pointercancel', () => {
            dragging = false;
        });
    }

    function renderTabs(state) {
        const counts = state.counts || [];
        const all = counts.reduce((sum, item) => sum + Number(item.count || 0), 0);
        const tabs = [{
            typeid: 0,
            typename: '所有',
            icon: typeIcons.all,
            count: all,
        }].concat(counts);

        state.tabs.innerHTML = tabs.map((item) => {
            const active = Number(item.typeid) === Number(state.typeid);
            return `
                <button class="tw-inline-flex tw-h-9 tw-shrink-0 tw-items-center tw-gap-1.5 tw-border-b-2 tw-px-2 tw-text-sm tw-transition-colors ${active ? 'tw-border-purple-500 tw-text-text-light dark:tw-text-white' : 'tw-border-transparent tw-text-text-soft hover:tw-text-text-light dark:tw-text-text-darksoft dark:hover:tw-text-white'}"
                        type="button"
                        data-ui-search-type="${Number(item.typeid)}">
                    <span class="${escapeHtml(item.icon || 'tw-icon-[mdi--cube-outline]')} tw-text-[18px]"></span>
                    <span>${escapeHtml(item.typename)}</span>
                    <span class="tw-rounded-md tw-bg-slate-100 tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-text-text-soft dark:tw-bg-white/10 dark:tw-text-text-darksoft">${formatNumber(item.count)}</span>
                </button>
            `;
        }).join('');
    }

    function loadingMarkup(text = '正在搜索...') {
        return `
            <div class="tw-flex tw-items-center tw-gap-2 tw-p-4 tw-text-sm tw-text-text-soft dark:tw-text-text-darksoft">
                <span class="tw-icon-[mdi--loading] tw-animate-spin tw-text-[20px] tw-text-purple-500"></span>
                ${escapeHtml(text)}
            </div>
        `;
    }

    function emptyMarkup(state) {
        const text = state.q ? '没有找到匹配结果，换个关键词试试。' : '输入关键词开始搜索，也可以先浏览全部数据。';
        return `
            <div class="tw-p-8 tw-text-center">
                <div class="tw-mx-auto tw-flex tw-h-12 tw-w-12 tw-items-center tw-justify-center tw-rounded-md tw-bg-slate-50 tw-text-[26px] tw-text-text-soft dark:tw-bg-surface-dark dark:tw-text-text-darksoft">
                    <span class="tw-icon-[mdi--database-search-outline]"></span>
                </div>
                <div class="tw-mt-3 tw-text-sm tw-text-text-soft dark:tw-text-text-darksoft">${text}</div>
            </div>
        `;
    }

    function itemAttrs(item, state) {
        if (!state.config.tip || !item.tip) return '';
        return `data-ui-item-tip="${escapeHtml(item.tip.type || 'search-result')}" data-ui-item-tip-id="${escapeHtml(item.tip.id)}" data-ui-item-tip-api="${escapeHtml(item.tip.api)}" data-ui-item-tip-width="340px" data-ui-item-tip-bg="#151515" data-ui-item-tip-border="#a855f7"`;
    }

    function renderVersionTags(item) {
        const versions = Array.isArray(item.versions) ? item.versions : [];
        if (!versions.length) return '';
        return versions.map((version) => `
            <span class="tw-inline-flex tw-h-5 tw-items-center tw-rounded-md tw-bg-slate-100 tw-px-1.5 tw-text-[11px] tw-leading-none tw-text-text-soft dark:tw-bg-white/10 dark:tw-text-text-darksoft">${escapeHtml(version)}</span>
        `).join('');
    }

    function renderDisplayName(item) {
        const name = item.name || 'Unnamed';
        if (!item.name_cn) return escapeHtml(name);
        return `
            <span class="tw-min-w-0 tw-truncate">${escapeHtml(name)}</span>
            <span class="tw-min-w-0 tw-truncate tw-text-xs tw-font-normal tw-text-text-soft dark:tw-text-text-darksoft">${escapeHtml(item.name_cn)}</span>
        `;
    }

    function renderItems(state, append = false, items = null) {
        if (!append) state.list.innerHTML = '';
        if (!state.items.length && !state.loading) {
            state.list.innerHTML = emptyMarkup(state);
            return;
        }

        const renderList = Array.isArray(items) ? items : state.items;
        const html = renderList.map((item) => `
            <div class="tw-group tw-flex tw-items-center tw-gap-3 tw-border-b tw-border-line-light tw-px-4 tw-py-2.5 tw-transition-colors hover:tw-bg-slate-50 dark:tw-border-line-dark dark:hover:tw-bg-white/5">
                <a class="tw-flex tw-h-10 tw-w-10 tw-shrink-0 tw-items-center tw-justify-center tw-overflow-hidden tw-rounded-md tw-border tw-border-line-light tw-bg-slate-50 tw-text-[22px] tw-text-text-soft group-hover:tw-border-purple-400 dark:tw-border-line-dark dark:tw-bg-[#151515] dark:tw-text-text-darksoft"
                   href="${escapeHtml(item.url || '#')}"
                   ${itemAttrs(item, state)}>
                    ${normalizeIcon(item.icon) || `<span class="${escapeHtml(item.typeIcon || 'tw-icon-[mdi--cube-outline]')}"></span>`}
                </a>
                <span class="tw-min-w-0 tw-flex-1">
                    <a class="tw-inline-flex tw-max-w-full tw-flex-wrap tw-items-baseline tw-gap-x-2 tw-gap-y-0.5 tw-align-top tw-text-sm tw-font-medium tw-text-brand-600 group-hover:tw-text-purple-600 dark:tw-text-purple-300 dark:group-hover:tw-text-purple-200"
                       href="${escapeHtml(item.url || '#')}"
                       ${itemAttrs(item, state)}>
                        ${renderDisplayName(item)}
                    </a>
                    <span class="tw-mt-0.5 tw-flex tw-flex-wrap tw-items-center tw-gap-1.5 tw-text-xs tw-text-text-soft dark:tw-text-text-darksoft">
                        <span>ID ${escapeHtml(item.mid || item.id)}</span>
                        <button class="booklet-list-copy" type="button" data-ui-copy-text="${escapeHtml(item.mid || item.id)}" data-ui-copy-message="ID copied" data-ui-copy-state="icon" title="Copy ID" aria-label="Copy ID">
                            <span class="tw-icon-[mdi--content-copy]"></span>
                        </button>
                        ${renderVersionTags(item)}
                    </span>
                </span>
                <span class="tw-shrink-0 tw-rounded-md tw-bg-slate-100 tw-px-2 tw-py-1 tw-text-xs tw-font-medium tw-text-text-soft dark:tw-bg-white/10 dark:tw-text-text-darksoft">${escapeHtml(item.typename || 'Other')}</span>
            </div>
        `).join('');

        if (append) {
            state.list.insertAdjacentHTML('beforeend', html);
        } else {
            state.list.innerHTML = html;
        }
    }

    function renderState(state, append = false, items = null) {
        if (state.clear) {
            state.clear.classList.toggle('tw-hidden', !state.q);
            state.clear.classList.toggle('tw-inline-flex', !!state.q);
        }
        if (state.status) {
            state.status.textContent = state.q ? `搜索：${state.q}` : '热门 / 最新资料';
        }
        renderTabs(state);
        renderItems(state, append, items);
        if (state.loadMore) {
            state.loadMore.classList.toggle('tw-hidden', !state.hasMore);
            state.loadMore.disabled = state.loading;
            state.loadMore.innerHTML = state.loading
                ? '<span class="tw-icon-[mdi--loading] tw-animate-spin"></span>加载中'
                : '<span class="tw-icon-[mdi--chevron-down]"></span>加载更多';
        }
    }

    async function fetchResults(state, append = false) {
        const token = ++state.token;
        if (state.requestController) {
            state.requestController.abort();
        }
        state.requestController = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const requestController = state.requestController;
        state.loading = true;
        if (!append) {
            state.list.innerHTML = loadingMarkup();
        } else if (state.loadMore) {
            state.loadMore.disabled = true;
            state.loadMore.innerHTML = '<span class="tw-icon-[mdi--loading] tw-animate-spin"></span>加载中';
        }

        const params = new URLSearchParams();
        params.set('q', state.q);
        params.set('typeid', String(state.typeid || 0));
        params.set('offset', String(append ? state.offset : 0));
        params.set('limit', String(state.config.limit));
        params.set('tip', state.config.tip ? '1' : '0');

        try {
            const requestOptions = { headers: { Accept: 'application/json' } };
            if (requestController) requestOptions.signal = requestController.signal;
            const payload = await window.BookletSecureApi.requestJson(`${state.config.api}?${params.toString()}`, requestOptions);
            if (token !== state.token) return;
            if (payload.ok === false) throw new Error(payload.message || '搜索失败');

            state.counts = payload.counts || [];
            state.total = payload.total || 0;
            state.hasMore = !!payload.hasMore;
            const newItems = payload.items || [];
            if (append) {
                state.items = state.items.concat(newItems);
            } else {
                state.items = newItems;
                state.offset = 0;
            }
            state.offset += newItems.length;
            state.loading = false;
            renderState(state, append, append ? newItems : null);
        } catch (error) {
            if (token !== state.token) return;
            if (error && error.name === 'AbortError') return;
            state.loading = false;
            state.list.innerHTML = `<div class="tw-p-4 tw-text-sm tw-text-rose-600 dark:tw-text-rose-300">${escapeHtml(error.message || '搜索失败')}</div>`;
            if (state.loadMore) state.loadMore.classList.add('tw-hidden');
        } finally {
            if (state.requestController === requestController) {
                state.requestController = null;
            }
        }
    }

    function jumpSearchPage(state) {
        const url = new URL(state.config.page, window.location.origin);
        if (state.q) url.searchParams.set('q', state.q);
        if (state.typeid) url.searchParams.set('typeid', String(state.typeid));
        window.location.href = url.toString();
    }

    function bindState(state) {
        if (state.input) {
            state.input.addEventListener('input', () => {
                state.q = state.input.value.trim();
                if (state.clear) {
                    state.clear.classList.toggle('tw-hidden', !state.q);
                    state.clear.classList.toggle('tw-inline-flex', !!state.q);
                }
                state.searchDebounced();
            });
            state.input.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                jumpSearchPage(state);
            });
        }
        if (state.clear) {
            state.clear.addEventListener('click', () => {
                state.q = '';
                state.input.value = '';
                state.input.focus();
                state.offset = 0;
                fetchResults(state, false);
            });
        }
        if (state.close) {
            state.close.addEventListener('click', () => setOpen(state, false));
        }
        if (state.backdrop) {
            state.backdrop.addEventListener('click', () => setOpen(state, false));
        }
        if (state.tabs) {
            state.tabs.addEventListener('click', (event) => {
                const button = event.target.closest('[data-ui-search-type]');
                if (!button) return;
                state.typeid = Number(button.dataset.uiSearchType || 0);
                state.offset = 0;
                fetchResults(state, false);
            });
        }
        if (state.loadMore) {
            state.loadMore.addEventListener('click', () => {
                if (!state.loading && state.hasMore) fetchResults(state, true);
            });
        }
        bindDrag(state);
    }

    function getModalState() {
        const root = qs('[data-ui-global-search]');
        if (!root) return null;
        return stateMap.get(root) || createState(root);
    }

    function openModal(initialQuery = '', options = null) {
        const state = getModalState();
        if (!state) return;
        if (initialQuery) {
            state.q = initialQuery;
            if (state.input) state.input.value = initialQuery;
        }
        setOpen(state, true, options);
    }

    function initPageSearch(root) {
        const state = createState(root);
        const params = new URLSearchParams(window.location.search);
        state.q = params.get('q') || '';
        state.typeid = Number(params.get('typeid') || 0);
        if (state.input) state.input.value = state.q;
        bindState(state);
        fetchResults(state, false);
    }

    function initModalSearch(root) {
        const state = createState(root);
        bindState(state);
    }

    function init() {
        qsa('[data-ui-global-search]').forEach(initModalSearch);
        qsa('[data-ui-global-search-page]').forEach(initPageSearch);

        document.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-ui-global-search-open]');
            if (!trigger) return;
            event.preventDefault();
            openModal(trigger.dataset.uiSearchQuery || '', {
                placement: trigger.dataset.uiSearchPlacement,
                offsetX: trigger.dataset.uiSearchOffsetX,
                offsetY: trigger.dataset.uiSearchOffsetY,
                left: trigger.dataset.uiSearchLeft,
                top: trigger.dataset.uiSearchTop,
            });
        });

        document.addEventListener('keydown', (event) => {
            const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
            const hotkey = (isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === 'k';
            if (!hotkey) return;
            if (event.target && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
            event.preventDefault();
            openModal();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            const state = getModalState();
            if (state) setOpen(state, false);
        });
    }

    window.GlobalSearch = {
        open: openModal,
    };

    document.addEventListener('DOMContentLoaded', init);
})();
