(function () {
    /*
     * 通用道具 TIP 组件
     *
     * 基础用法：
     * <button data-ui-item-tip="gear" data-ui-item-tip-id="1001">悬浮查看</button>
     * <script>
     * ItemTip.register('gear', [{ id: 1001, name: '神秘木长弓', rarity: 'normal' }]);
     * </script>
     *
     * API 用法：
     * <button
     *   data-ui-item-tip="gear-api"
     *   data-ui-item-tip-id="bow_c_t1_nomal_001"
     *   data-ui-item-tip-api="/demo/api/item-tip-demo.php"
     *   data-ui-item-tip-width="360px"
     *   data-ui-item-tip-bg="#111827"
     *   data-ui-item-tip-border="#a855f7">API TIP</button>
     *
     * API 返回格式：
     * { "ok": true, "item": { "id": "...", "name": "...", "stats": [] }, "options": {} }
     * 或直接返回 HTML：
     * { "ok": true, "html": "<div>这里是服务端渲染好的 TIP</div>", "options": {} }
     *
     * 内联 HTML 用法：
     * <button tip-html="<div class='tw-p-3'>这里是提示内容</div>">悬浮查看</button>
     * 或：
     * <button data-ui-item-tip-html="<div class='tw-p-3'>这里是提示内容</div>">悬浮查看</button>
     *
     * 可选样式参数：
     * data-ui-item-tip-width   宽度，例如 340px / 380px
     * data-ui-item-tip-bg      浮层底色，例如 #151515
     * data-ui-item-tip-border  外边线颜色，例如 #a855f7
     * data-ui-item-tip-class   追加 Tailwind class
     */

    const registries = new Map();
    const apiCache = new Map();
    let layer = null;
    let activeTrigger = null;
    let requestToken = 0;

    const rarityStyles = {
        legendary: { border: 'tw-border-orange-500', accent: 'tw-text-orange-400', icon: 'tw-border-orange-500 tw-bg-orange-500/10 tw-text-orange-400', label: '传说' },
        heroic: { border: 'tw-border-amber-500', accent: 'tw-text-amber-400', icon: 'tw-border-amber-500 tw-bg-amber-500/10 tw-text-amber-400', label: '英雄' },
        epic: { border: 'tw-border-fuchsia-500', accent: 'tw-text-fuchsia-400', icon: 'tw-border-fuchsia-500 tw-bg-fuchsia-500/10 tw-text-fuchsia-400', label: '史诗' },
        rare: { border: 'tw-border-sky-500', accent: 'tw-text-sky-400', icon: 'tw-border-sky-500 tw-bg-sky-500/10 tw-text-sky-400', label: '稀有' },
        normal: { border: 'tw-border-slate-500', accent: 'tw-text-slate-200', icon: 'tw-border-slate-500 tw-bg-slate-500/10 tw-text-slate-200', label: '普通' },
    };

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        })[char]);
    }

    function ensureLayer() {
        if (layer) return layer;
        layer = document.createElement('div');
        layer.setAttribute('data-ui-item-tip-layer', '');
        document.body.appendChild(layer);
        return layer;
    }

    function normalizeRegistry(data, options) {
        const map = new Map();
        if (Array.isArray(data)) {
            data.forEach((item) => map.set(String(item.id), item));
        } else if (data && typeof data === 'object') {
            Object.entries(data).forEach(([key, item]) => map.set(String(key), item));
        }
        return {
            data: map,
            render: options.render || renderItem,
            getItem: options.getItem,
            options,
        };
    }

    function register(type, data, options = {}) {
        registries.set(type, normalizeRegistry(data, options));
    }

    function getTriggerOptions(trigger, registryOptions = {}) {
        return {
            width: trigger.dataset.uiItemTipWidth || registryOptions.width || '340px',
            bg: trigger.dataset.uiItemTipBg || registryOptions.bg || '#151515',
            border: trigger.dataset.uiItemTipBorder || registryOptions.border || '',
            className: trigger.dataset.uiItemTipClass || registryOptions.className || '',
        };
    }

    function applyLayerOptions(options) {
        const tip = ensureLayer();
        tip.className = `tw-pointer-events-none tw-fixed tw-z-[1400] tw-hidden tw-rounded-md tw-text-white ${options.className || ''}`;
        tip.style.width = options.width || '340px';
        tip.style.background = options.bg || '#151515';
        tip.style.border = options.border ? `1px solid ${options.border}` : '';
        const transparentBg = !options.bg || options.bg === 'transparent';
        tip.style.boxShadow = transparentBg ? 'none' : '';
        tip.style.borderRadius = transparentBg ? '0' : '';
        return tip;
    }

    function statRow(label, value) {
        if (value === undefined || value === null || value === '') return '';
        return `<div class="tw-font-semibold">${escapeHtml(label)}:</div><div>${escapeHtml(value)}</div>`;
    }

    function iconMarkup(item) {
        if (item.iconHtml) return item.iconHtml;
        if (item.iconClass || item.icon) return `<span class="${escapeHtml(item.iconClass || item.icon)}"></span>`;
        if (item.iconUrl) return `<img class="tw-h-9 tw-w-9 tw-object-contain" src="${escapeHtml(item.iconUrl)}" alt="">`;
        return '<span class="tw-icon-[mdi--cube-outline]"></span>';
    }

    function renderItem(item) {
        const rarity = rarityStyles[item.rarity] || rarityStyles.normal;
        const title = escapeHtml(item.name || item.title || '未命名道具');
        const subtitle = escapeHtml(item.type || item.category || '');
        const level = item.level ? `<div class="tw-mt-1 tw-text-xs tw-text-slate-300">${escapeHtml(item.level)}</div>` : '';
        const primaryValue = item.primaryValue || item.damage || (item.minDamage !== undefined && item.maxDamage !== undefined ? `${item.minDamage} ~ ${item.maxDamage}` : '');
        const primaryLabel = item.primaryLabel || (primaryValue ? '核心数值' : '');
        const stats = item.stats || [
            ['攻击距离', item.range ? `${Number(item.range).toFixed(1)}m` : ''],
            ['攻击速度', item.speed ? `${Number(item.speed).toFixed(2)}秒` : ''],
            ['命中', item.hit],
            ['暴击', item.crit],
            ['生命', item.hp],
        ];
        const effects = item.effects || [];
        const traits = item.traits || [];

        return `
            <div class="${rarity.border} tw-overflow-hidden tw-rounded-md tw-border">
                <div class="tw-flex tw-items-start tw-gap-3 tw-border-b tw-border-white/10 tw-p-3">
                    <div class="${rarity.icon} tw-flex tw-h-14 tw-w-14 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-md tw-border tw-text-[30px]">${iconMarkup(item)}</div>
                    <div class="tw-min-w-0 tw-flex-1">
                        <div class="tw-flex tw-items-center tw-justify-between tw-gap-2">
                            <span class="${rarity.accent} tw-text-xs tw-font-semibold">${escapeHtml(item.rarityLabel || rarity.label)}</span>
                            <span class="tw-text-xs tw-font-semibold tw-text-white">${subtitle}</span>
                        </div>
                        <div class="${rarity.accent} tw-mt-1 tw-text-base tw-font-semibold">${title}</div>
                        ${level}
                    </div>
                </div>
                <div class="tw-p-3">
                    ${primaryValue ? `
                        <div class="tw-rounded-md tw-bg-white/10 tw-p-3">
                            <div class="tw-text-xs tw-text-slate-300">${escapeHtml(primaryLabel)}</div>
                            <div class="tw-mt-1 tw-text-2xl tw-font-bold tw-text-white">${escapeHtml(primaryValue)}</div>
                        </div>
                    ` : ''}
                    <div class="tw-mt-3 tw-grid tw-grid-cols-[auto_1fr] tw-gap-x-3 tw-gap-y-2 tw-text-sm">
                        ${stats.map(([label, value]) => statRow(label, value)).join('')}
                    </div>
                    ${effects.length ? `
                        <div class="tw-mt-3 tw-space-y-1 tw-text-sm">
                            ${effects.map((effect) => `<div class="tw-rounded tw-bg-white/10 tw-px-2 tw-py-1 tw-text-slate-300">${escapeHtml(effect)}</div>`).join('')}
                        </div>
                    ` : ''}
                    ${traits.length ? `
                        <div class="tw-mt-3 tw-text-sm">
                            <div class="tw-font-semibold tw-text-white">${escapeHtml(item.traitTitle || '特性')}:</div>
                            <ul class="${rarity.accent} tw-mt-1 tw-list-disc tw-pl-5">
                                ${traits.map((trait) => `<li>${escapeHtml(Array.isArray(trait) ? `${trait[0]}: ${trait[1]}` : trait)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    function renderLoading() {
        return '<div class="tw-flex tw-items-center tw-gap-2 tw-p-3 tw-text-sm tw-text-slate-200"><span class="tw-icon-[mdi--loading] tw-animate-spin tw-text-[18px]"></span>正在加载 TIP...</div>';
    }

    function renderError(message) {
        return `<div class="tw-p-3 tw-text-sm tw-text-rose-200">${escapeHtml(message || 'TIP 数据加载失败')}</div>`;
    }

    function getInlineHtmlData(trigger) {
        const html = trigger.dataset.uiItemTipHtml || trigger.getAttribute('tip-html') || '';
        if (!html) return null;
        return {
            html,
            options: getTriggerOptions(trigger),
        };
    }

    function position(eventLike) {
        const tip = ensureLayer();
        if (tip.classList.contains('tw-hidden')) return;
        if (activeTrigger && (!activeTrigger.isConnected || document.hidden)) {
            hide();
            return;
        }
        const padding = 14;
        const rect = tip.getBoundingClientRect();
        let left = eventLike.clientX + padding;
        let top = eventLike.clientY + padding;
        if (left + rect.width > window.innerWidth - padding) left = eventLike.clientX - rect.width - padding;
        if (top + rect.height > window.innerHeight - padding) top = window.innerHeight - rect.height - padding;
        tip.style.left = `${Math.max(padding, left)}px`;
        tip.style.top = `${Math.max(padding, top)}px`;
    }

    function getRegistryData(trigger) {
        const type = trigger.dataset.uiItemTip || 'default';
        const registry = registries.get(type);
        if (!registry) return null;
        const id = trigger.dataset.uiItemTipId || trigger.dataset.itemId || trigger.dataset.id;
        const item = registry.getItem ? registry.getItem(id, trigger) : registry.data.get(String(id));
        if (!item) return null;
        return { type, registry, item, options: getTriggerOptions(trigger, registry.options) };
    }

    function getTriggerSelector() {
        return '[data-ui-item-tip], [data-ui-item-tip-html], [tip-html]';
    }

    function isMobileTipDisabled() {
        return window.matchMedia('(max-width: 767px)').matches
            || window.matchMedia('(hover: none)').matches
            || window.matchMedia('(pointer: coarse)').matches;
    }

    function canShow(trigger) {
        return !isMobileTipDisabled() && !!trigger && trigger.isConnected && !document.hidden;
    }

    function requestJson(url) {
        const secureCfg = window.BOOKLET_SECURE_API || {};
        const legacyUrl = () => {
            const next = new URL(url, window.location.href);
            next.searchParams.set('_legacy', '1');
            return next.toString();
        };
        const plainFetch = (requestUrl) => fetch(requestUrl, { headers: { Accept: 'application/json' } }).then(async (response) => {
            const payload = await response.json();
            if (!response.ok || payload.ok === false) {
                throw new Error(payload.message || 'TIP 数据加载失败');
            }
            return payload;
        });
        if (window.BookletSecureApi && window.BookletSecureApi.enabled && window.BookletSecureApi.enabled()) {
            return new Promise((resolve, reject) => {
                const req = window.BookletSecureApi.requestText(url, (text) => {
                    try {
                        resolve(JSON.parse(text));
                    } catch (error) {
                        reject(error);
                    }
                }, reject);
                if (!req) reject(new Error('Secure TIP 请求不可用'));
            }).catch(() => plainFetch(legacyUrl()));
        }
        if (secureCfg.enabled) {
            return plainFetch(legacyUrl());
        }
        return plainFetch(url).catch(() => plainFetch(legacyUrl()));
    }

    async function getApiData(trigger) {
        let endpoint = trigger.dataset.uiItemTipApi;
        if (!endpoint) return null;
        if (endpoint === '/api/tip.php') {
            const version = trigger.dataset.uiItemTipVersion || 'tip3';
            if (version === 'tip2') {
                endpoint = '/api/tip2.php';
            } else if (version !== 'tip1') {
                endpoint = '/api/tip3.php';
            }
        }
        const type = trigger.dataset.uiItemTip || 'default';
        const id = trigger.dataset.uiItemTipId || trigger.dataset.itemId || trigger.dataset.id || '';
        const region = trigger.dataset.uiItemTipRegion || '';
        const cacheKey = `${endpoint}::${type}::${id}::${region}`;
        if (apiCache.has(cacheKey)) return apiCache.get(cacheKey);

        const url = new URL(endpoint, window.location.origin);
        if (id) url.searchParams.set('id', id);
        if (type) url.searchParams.set('type', type);
        if (region) url.searchParams.set('region', region);
        const payload = await requestJson(url.toString());
        if (payload.ok === false) throw new Error(payload.message || 'TIP 数据加载失败');
        const html = payload.html || (payload.item && payload.item.html) || (payload.data && payload.data.html) || '';
        const result = html
            ? { html, item: null, options: payload.options || {}, render: null }
            : {
                html: '',
                item: payload.item || payload.data || payload,
                options: payload.options || {},
                render: renderItem,
            };
        apiCache.set(cacheKey, result);
        return result;
    }

    async function show(trigger, eventLike) {
        if (!canShow(trigger)) return;
        const token = ++requestToken;
        activeTrigger = trigger;

        const inlineHtml = getInlineHtmlData(trigger);
        let data = inlineHtml ? null : getRegistryData(trigger);
        let options = inlineHtml ? inlineHtml.options : (data ? data.options : getTriggerOptions(trigger));
        let tip = applyLayerOptions(options);
        tip.classList.remove('tw-hidden');

        if (inlineHtml) {
            tip.innerHTML = inlineHtml.html;
            position(eventLike);
            return;
        }

        if (data) {
            tip.innerHTML = data.registry.render(data.item, trigger, data.type);
            position(eventLike);
            return;
        }

        if (!trigger.dataset.uiItemTipApi) return;

        tip.innerHTML = renderLoading();
        position(eventLike);

        try {
            const apiData = await getApiData(trigger);
            if (token !== requestToken || activeTrigger !== trigger || !canShow(trigger)) return;
            options = Object.assign({}, getTriggerOptions(trigger), apiData.options || {});
            tip = applyLayerOptions(options);
            tip.innerHTML = apiData.html || (apiData.render || renderItem)(apiData.item, trigger, trigger.dataset.uiItemTip);
            tip.classList.remove('tw-hidden');
            position(eventLike);
        } catch (error) {
            if (token !== requestToken || activeTrigger !== trigger || !canShow(trigger)) return;
            tip.innerHTML = renderError(error.message);
            position(eventLike);
        }
    }

    function hide() {
        requestToken += 1;
        if (!layer) return;
        layer.classList.add('tw-hidden');
        activeTrigger = null;
    }

    document.addEventListener('mouseover', (event) => {
        if (isMobileTipDisabled()) {
            hide();
            return;
        }
        const trigger = event.target.closest(getTriggerSelector());
        if (!trigger) return;
        show(trigger, event);
    });

    document.addEventListener('mousemove', (event) => {
        if (isMobileTipDisabled()) {
            hide();
            return;
        }
        if (activeTrigger) position(event);
    });

    document.addEventListener('mouseout', (event) => {
        if (isMobileTipDisabled()) {
            hide();
            return;
        }
        const trigger = event.target.closest(getTriggerSelector());
        if (!trigger || trigger.contains(event.relatedTarget)) return;
        hide();
    });

    document.addEventListener('focusin', (event) => {
        if (isMobileTipDisabled()) {
            hide();
            return;
        }
        const trigger = event.target.closest(getTriggerSelector());
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        show(trigger, { clientX: rect.right, clientY: rect.top });
    });

    document.addEventListener('focusout', (event) => {
        if (event.target.closest(getTriggerSelector())) hide();
    });

    document.documentElement.addEventListener('mouseleave', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) hide();
    });

    window.ItemTip = {
        register,
        hide,
        show,
        renderItem,
        escapeHtml,
        clearCache() {
            apiCache.clear();
        },
    };
})();
