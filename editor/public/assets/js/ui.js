(function () {
    var activeModal = null;
    var activeDrawer = null;
    var activePreview = null;
    var activeCodeText = '';
    var tooltipEl = null;

    function qs(selector, root) {
        return (root || document).querySelector(selector);
    }

    function qsa(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    function show(element, displayClass) {
        if (!element) return;
        element.classList.remove('tw-hidden');
        if (displayClass) element.classList.add(displayClass);
    }

    function hide(element, displayClass) {
        if (!element) return;
        if (displayClass) element.classList.remove(displayClass);
        element.classList.add('tw-hidden');
    }

    function ensureElement(selector, attrs, className) {
        var element = qs(selector);
        if (!element) {
            element = document.createElement('div');
            Object.keys(attrs || {}).forEach(function (key) {
                element.setAttribute(key, attrs[key]);
            });
            element.className = className;
            document.body.appendChild(element);
        }
        return element;
    }

    function lockBody(lock) {
        document.body.classList.toggle('tw-overflow-hidden', !!lock);
    }

    function openModal(target) {
        var modal = typeof target === 'string' ? qs(target) : target;
        if (!modal) return;
        var backdrop = ensureElement('[data-ui-modal-backdrop]', { 'data-ui-modal-backdrop': '' }, 'tw-fixed tw-inset-0 tw-z-[1200] tw-hidden tw-bg-slate-950/45 dark:tw-bg-black/70');
        activeModal = modal;
        show(backdrop, 'tw-block');
        show(modal, 'tw-block');
        lockBody(true);
    }

    function closeModal(target) {
        var modal = target || activeModal;
        hide(modal, 'tw-block');
        hide(qs('[data-ui-modal-backdrop]'), 'tw-block');
        if (modal === activeModal) activeModal = null;
        if (!activeDrawer && !activePreview) lockBody(false);
    }

    function drawerClosedClass(drawer) {
        var placement = drawer ? drawer.dataset.uiPlacement : 'right';
        if (placement === 'left') return '-tw-translate-x-full';
        if (placement === 'top') return '-tw-translate-y-full';
        if (placement === 'bottom') return 'tw-translate-y-full';
        return 'tw-translate-x-full';
    }

    function openDrawer(target) {
        var drawer = typeof target === 'string' ? qs(target) : target;
        if (!drawer) return;
        var backdrop = ensureElement('[data-ui-drawer-backdrop]', { 'data-ui-drawer-backdrop': '' }, 'tw-fixed tw-inset-0 tw-z-[1200] tw-hidden tw-bg-slate-950/45');
        activeDrawer = drawer;
        drawer.classList.remove(drawerClosedClass(drawer));
        drawer.classList.add('tw-translate-x-0', 'tw-translate-y-0');
        show(backdrop, 'tw-block');
        lockBody(true);
    }

    function closeDrawer(target) {
        var drawer = target || activeDrawer;
        if (drawer) {
            drawer.classList.remove('tw-translate-x-0', 'tw-translate-y-0');
            drawer.classList.add(drawerClosedClass(drawer));
        }
        hide(qs('[data-ui-drawer-backdrop]'), 'tw-block');
        if (drawer === activeDrawer) activeDrawer = null;
        if (!activeModal && !activePreview) lockBody(false);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char];
        });
    }

    function toastTitle(type) {
        return {
            success: '\u64cd\u4f5c\u6210\u529f',
            error: '\u64cd\u4f5c\u5931\u8d25',
            warning: '\u9700\u8981\u6ce8\u610f',
            info: '\u63d0\u793a'
        }[type] || '\u63d0\u793a';
    }

    function toastPlacementClass(placement) {
        var map = {
            'top-right': 'tw-fixed tw-right-3 tw-top-3 tw-z-[1300] tw-flex tw-w-[min(360px,calc(100vw-1.5rem))] tw-flex-col tw-gap-2',
            'right-top': 'tw-fixed tw-right-3 tw-top-3 tw-z-[1300] tw-flex tw-w-[min(360px,calc(100vw-1.5rem))] tw-flex-col tw-gap-2',
            'top-left': 'tw-fixed tw-left-3 tw-top-3 tw-z-[1300] tw-flex tw-w-[min(360px,calc(100vw-1.5rem))] tw-flex-col tw-gap-2',
            'left-top': 'tw-fixed tw-left-3 tw-top-3 tw-z-[1300] tw-flex tw-w-[min(360px,calc(100vw-1.5rem))] tw-flex-col tw-gap-2',
            'bottom-right': 'tw-fixed tw-bottom-3 tw-right-3 tw-z-[1300] tw-flex tw-w-[min(360px,calc(100vw-1.5rem))] tw-flex-col-reverse tw-gap-2',
            'right-bottom': 'tw-fixed tw-bottom-3 tw-right-3 tw-z-[1300] tw-flex tw-w-[min(360px,calc(100vw-1.5rem))] tw-flex-col-reverse tw-gap-2',
            'bottom-left': 'tw-fixed tw-bottom-3 tw-left-3 tw-z-[1300] tw-flex tw-w-[min(360px,calc(100vw-1.5rem))] tw-flex-col-reverse tw-gap-2',
            'left-bottom': 'tw-fixed tw-bottom-3 tw-left-3 tw-z-[1300] tw-flex tw-w-[min(360px,calc(100vw-1.5rem))] tw-flex-col-reverse tw-gap-2',
            'top-center': 'tw-fixed tw-left-1/2 tw-top-3 tw-z-[1300] tw-flex tw-w-[min(360px,calc(100vw-1.5rem))] -tw-translate-x-1/2 tw-flex-col tw-gap-2',
            'center-top': 'tw-fixed tw-left-1/2 tw-top-3 tw-z-[1300] tw-flex tw-w-[min(360px,calc(100vw-1.5rem))] -tw-translate-x-1/2 tw-flex-col tw-gap-2',
            'bottom-center': 'tw-fixed tw-bottom-3 tw-left-1/2 tw-z-[1300] tw-flex tw-w-[min(360px,calc(100vw-1.5rem))] -tw-translate-x-1/2 tw-flex-col-reverse tw-gap-2',
            'center-bottom': 'tw-fixed tw-bottom-3 tw-left-1/2 tw-z-[1300] tw-flex tw-w-[min(360px,calc(100vw-1.5rem))] -tw-translate-x-1/2 tw-flex-col-reverse tw-gap-2',
            center: 'tw-fixed tw-left-1/2 tw-top-1/2 tw-z-[1300] tw-flex tw-w-[min(360px,calc(100vw-1.5rem))] -tw-translate-x-1/2 -tw-translate-y-1/2 tw-flex-col tw-gap-2'
        };
        return map[String(placement || 'top-right').toLowerCase()] || map['top-right'];
    }

    function toastWrap(placement) {
        var value = String(placement || 'top-right').toLowerCase();
        var selector = '[data-ui-toast-wrap="' + value + '"]';
        var wrap = qs(selector);
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.setAttribute('data-ui-toast-wrap', value);
            document.body.appendChild(wrap);
        }
        wrap.className = toastPlacementClass(value);
        return wrap;
    }

    function toast(options) {
        var config = typeof options === 'string' ? { message: options } : (options || {});
        var type = config.type || 'info';
        var icons = {
            success: 'tw-icon-[mdi--check-circle-outline] tw-text-emerald-500',
            error: 'tw-icon-[mdi--alert-circle-outline] tw-text-rose-500',
            warning: 'tw-icon-[mdi--alert-outline] tw-text-amber-500',
            info: 'tw-icon-[mdi--information-outline] tw-text-brand-500'
        };
        var accents = {
            success: 'tw-bg-emerald-500',
            error: 'tw-bg-rose-500',
            warning: 'tw-bg-amber-400',
            info: 'tw-bg-brand-500'
        };
        var wrap = toastWrap(config.placement || config.position || 'top-right');
        var item = document.createElement('div');
        item.setAttribute('data-ui-toast', '');
        item.className = 'tw-relative tw-flex tw-items-start tw-gap-3 tw-overflow-hidden tw-rounded-md tw-border tw-border-slate-200 tw-bg-white tw-p-3 tw-pl-4 tw-text-sm tw-text-text-light tw-shadow-flat tw-ring-1 tw-ring-slate-950/5 dark:tw-border-line-strongdark dark:tw-bg-[#1d1d1d] dark:tw-text-text-dark dark:tw-ring-white/10';
        item.innerHTML = '<span class="tw-absolute tw-inset-y-0 tw-left-0 tw-w-1 ' + (accents[type] || accents.info) + '"></span>' +
            '<span class="tw-mt-0.5 tw-flex tw-h-8 tw-w-8 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-md tw-bg-slate-100 dark:tw-bg-white/10">' +
            '<span class="tw-text-[19px] ' + (icons[type] || icons.info) + '"></span>' +
            '</span>' +
            '<div class="tw-min-w-0 tw-flex-1">' +
            '<div class="tw-font-semibold">' + escapeHtml(config.title || toastTitle(type)) + '</div>' +
            '<div class="tw-mt-1 tw-leading-5 tw-text-text-soft dark:tw-text-text-darksoft">' + escapeHtml(config.message || '') + '</div>' +
            '</div>' +
            '<button type="button" class="tw-inline-flex tw-h-7 tw-w-7 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-md tw-text-[18px] tw-text-slate-500 hover:tw-bg-slate-100 hover:tw-text-text-light dark:tw-text-text-darksoft dark:hover:tw-bg-white/10 dark:hover:tw-text-white" data-ui-toast-close><span class="tw-icon-[mdi--close]"></span></button>';
        wrap.appendChild(item);
        qs('[data-ui-toast-close]', item).addEventListener('click', function () {
            item.remove();
        });
        window.setTimeout(function () {
            item.remove();
        }, config.duration || 3200);
    }

    function openPreview(trigger) {
        var image = trigger.matches('img') ? trigger : qs('img', trigger);
        var src = trigger.dataset.uiImageSrc || trigger.dataset.uiPreview || trigger.getAttribute('href') || trigger.getAttribute('src') || (image ? image.getAttribute('src') : '');
        var caption = trigger.dataset.uiCaption || trigger.dataset.uiImageCaption || trigger.getAttribute('title') || trigger.getAttribute('alt') || (image ? image.getAttribute('alt') : '') || '';
        if (!src) return;
        var backdrop = ensureElement('[data-ui-preview-backdrop]', { 'data-ui-preview-backdrop': '' }, 'tw-fixed tw-inset-0 tw-z-[1240] tw-hidden tw-items-center tw-justify-center tw-bg-slate-950/80 tw-p-4');
        backdrop.innerHTML = '<div class="tw-relative tw-flex tw-max-h-full tw-max-w-5xl tw-flex-col tw-gap-3">' +
            '<button type="button" class="tw-absolute tw-right-2 tw-top-2 tw-inline-flex tw-h-9 tw-w-9 tw-items-center tw-justify-center tw-rounded-md tw-bg-white/90 tw-text-[18px] tw-text-text-light hover:tw-bg-white dark:tw-bg-slate-950/80 dark:tw-text-text-dark" data-ui-preview-close><span class="tw-icon-[mdi--close]"></span></button>' +
            '<img class="tw-max-h-[82vh] tw-max-w-full tw-rounded-md tw-bg-black tw-object-contain" src="' + escapeHtml(src) + '" alt="">' +
            (caption ? '<div class="tw-text-center tw-text-sm tw-text-white">' + escapeHtml(caption) + '</div>' : '') +
            '</div>';
        activePreview = backdrop;
        show(backdrop, 'tw-flex');
        lockBody(true);
    }

    function closePreview() {
        var backdrop = qs('[data-ui-preview-backdrop]');
        hide(backdrop, 'tw-flex');
        if (backdrop) backdrop.innerHTML = '';
        activePreview = null;
        if (!activeModal && !activeDrawer) lockBody(false);
    }

    function positionTooltip(anchor) {
        if (!tooltipEl || !anchor) return;
        var rect = anchor.getBoundingClientRect();
        var tip = tooltipEl.getBoundingClientRect();
        var top = rect.top - tip.height - 8;
        var left = rect.left + rect.width / 2 - tip.width / 2;
        if (top < 8) top = rect.bottom + 8;
        left = Math.max(8, Math.min(left, window.innerWidth - tip.width - 8));
        tooltipEl.style.top = top + 'px';
        tooltipEl.style.left = left + 'px';
    }

    function initTooltips() {
        tooltipEl = ensureElement('[data-ui-tooltip-layer]', { 'data-ui-tooltip-layer': '' }, 'tw-pointer-events-none tw-fixed tw-z-[1350] tw-hidden tw-max-w-[240px] tw-rounded-lg tw-bg-slate-950 tw-px-2 tw-py-1.5 tw-text-xs tw-leading-5 tw-text-white');
        function canShowTooltip(anchor) {
            if (!anchor.hasAttribute('data-ui-tooltip-collapsed-only')) return true;
            var switcher = anchor.closest('[data-booklet-switcher]');
            return !!(switcher && switcher.classList.contains('is-collapsed'));
        }
        qsa('[data-ui-tooltip]').forEach(function (anchor) {
            anchor.addEventListener('mouseenter', function () {
                if (!canShowTooltip(anchor)) return;
                tooltipEl.textContent = anchor.dataset.uiTooltip || '';
                show(tooltipEl, 'tw-block');
                positionTooltip(anchor);
            });
            anchor.addEventListener('mousemove', function () {
                positionTooltip(anchor);
            });
            anchor.addEventListener('mouseleave', function () {
                hide(tooltipEl, 'tw-block');
            });
            anchor.addEventListener('focus', function () {
                if (!canShowTooltip(anchor)) return;
                tooltipEl.textContent = anchor.dataset.uiTooltip || '';
                show(tooltipEl, 'tw-block');
                positionTooltip(anchor);
            });
            anchor.addEventListener('blur', function () {
                hide(tooltipEl, 'tw-block');
            });
        });
    }

    function initDraggableModals() {
        qsa('[data-ui-modal][data-ui-draggable="true"]').forEach(function (modal) {
            var handle = qs('[data-ui-modal-handle]', modal);
            var dragging = false;
            var startX = 0;
            var startY = 0;
            var baseX = 0;
            var baseY = 0;
            if (!handle) return;
            handle.addEventListener('pointerdown', function (event) {
                if (event.target.closest('button,a,input,select,textarea')) return;
                dragging = true;
                startX = event.clientX;
                startY = event.clientY;
                var rect = modal.getBoundingClientRect();
                baseX = rect.left;
                baseY = rect.top;
                modal.style.left = baseX + 'px';
                modal.style.top = baseY + 'px';
                modal.style.transform = 'none';
                modal.classList.remove('-tw-translate-x-1/2', '-tw-translate-y-1/2');
                handle.setPointerCapture(event.pointerId);
            });
            handle.addEventListener('pointermove', function (event) {
                if (!dragging) return;
                modal.style.left = Math.max(8, baseX + event.clientX - startX) + 'px';
                modal.style.top = Math.max(8, baseY + event.clientY - startY) + 'px';
            });
            handle.addEventListener('pointerup', function () {
                dragging = false;
            });
        });
    }

    function initDropdowns() {
        function setDropdownActive(trigger, active) {
            if (!trigger) return;
            trigger.classList.toggle('tw-bg-transparent', !active);
            trigger.classList.toggle('tw-bg-slate-50', !!active);
            trigger.classList.toggle('dark:tw-bg-surface-dark', !!active);
        }

        function setMobileBookletBackdrop(root, active) {
            if (!root || !root.classList.contains('booklet-switcher-mobile')) return;

            var backdrop = qs('.booklet-switcher-mobile-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('button');
                backdrop.type = 'button';
                backdrop.className = 'booklet-switcher-mobile-backdrop tw-hidden';
                backdrop.setAttribute('aria-label', '关闭小册子选择器');
                document.body.appendChild(backdrop);
                backdrop.addEventListener('click', function () {
                    var openRoot = qs('.booklet-switcher-mobile.is-open');
                    if (openRoot) closeDropdown(openRoot);
                });
            }

            backdrop.classList.toggle('tw-hidden', !active);
            document.body.classList.toggle('booklet-switcher-mobile-open', !!active);
        }

        function openDropdown(root) {
            var trigger = qs('[data-ui-dropdown-trigger]', root);
            var menu = qs('[data-ui-dropdown-menu]', root);
            show(menu, 'tw-block');
            root.classList.add('is-open');
            if (trigger) trigger.setAttribute('aria-expanded', 'true');
            setDropdownActive(trigger, true);
            setMobileBookletBackdrop(root, true);
        }

        function closeDropdown(root) {
            var trigger = qs('[data-ui-dropdown-trigger]', root);
            var menu = qs('[data-ui-dropdown-menu]', root);
            hide(menu, 'tw-block');
            root.classList.remove('is-open');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
            setDropdownActive(trigger, false);
            setMobileBookletBackdrop(root, false);
        }

        qsa('[data-ui-dropdown]').forEach(function (root) {
            var trigger = qs('[data-ui-dropdown-trigger]', root);
            var menu = qs('[data-ui-dropdown-menu]', root);
            if (!trigger || !menu) return;
            trigger.addEventListener('click', function (event) {
                event.preventDefault();
                qsa('[data-ui-dropdown]').forEach(function (item) {
                    var itemMenu = qs('[data-ui-dropdown-menu]', item);
                    if (itemMenu !== menu) {
                        closeDropdown(item);
                    }
                });
                if (menu.classList.contains('tw-hidden')) {
                    openDropdown(root);
                } else {
                    closeDropdown(root);
                }
            });
            qsa('[data-ui-dropdown-close]', root).forEach(function (closeButton) {
                closeButton.addEventListener('click', function (event) {
                    event.preventDefault();
                    closeDropdown(root);
                });
            });
        });
        document.addEventListener('click', function (event) {
            qsa('[data-ui-dropdown]').forEach(function (root) {
                if (!root.contains(event.target)) {
                    closeDropdown(root);
                }
            });
        });
    }

    function storageGet(key) {
        try {
            return window.localStorage ? window.localStorage.getItem(key) : null;
        } catch (error) {
            return null;
        }
    }

    function storageSet(key, value) {
        try {
            if (window.localStorage) window.localStorage.setItem(key, value);
        } catch (error) {}
    }

    function initBookletSwitchers() {
        qsa('[data-booklet-switcher]').forEach(function (root) {
            var id = root.getAttribute('data-booklet-switcher') || 'booklet-switcher';
            var key = 'uiv8.bookletSwitcher.collapsed.' + id;
            var savedClass = 'booklet-switcher-saved-collapsed-' + id;
            var button = qs('[data-booklet-switcher-collapse]', root);
            var desktopQuery = window.matchMedia ? window.matchMedia('(min-width: 1920px)') : null;
            if (!button) return;

            function apply(collapsed, persist) {
                root.classList.toggle('is-collapsed', !!collapsed);
                document.documentElement.classList.toggle(savedClass, !!collapsed);
                button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                button.setAttribute('aria-label', collapsed ? 'Expand booklet switcher' : 'Collapse booklet switcher');
                if (persist) storageSet(key, collapsed ? '1' : '0');
            }

            function animateApply(collapsed, persist) {
                root.classList.add('is-animating');
                apply(collapsed, persist);
                window.setTimeout(function () {
                    root.classList.remove('is-animating');
                }, 220);
            }

            function preferredCollapsed() {
                if (desktopQuery && !desktopQuery.matches) return true;
                return storageGet(key) === '1';
            }

            apply(preferredCollapsed(), false);
            root.classList.add('is-ready');

            button.addEventListener('click', function () {
                animateApply(!root.classList.contains('is-collapsed'), !desktopQuery || desktopQuery.matches);
            });

            qsa('[data-booklet-switcher-expand]', root).forEach(function (expandButton) {
                expandButton.addEventListener('click', function (event) {
                    event.preventDefault();
                    if (!root.classList.contains('is-collapsed')) return;
                    animateApply(false, !desktopQuery || desktopQuery.matches);
                });
            });

            if (desktopQuery) {
                var syncViewportState = function () {
                    apply(preferredCollapsed(), false);
                };
                if (desktopQuery.addEventListener) {
                    desktopQuery.addEventListener('change', syncViewportState);
                } else if (desktopQuery.addListener) {
                    desktopQuery.addListener(syncViewportState);
                }
            }
        });
    }

    function splitClasses(value) {
        return String(value || '').split(/\s+/).filter(Boolean);
    }

    function setClasses(element, classes, enabled) {
        if (!element || !classes.length) return;
        element.classList[enabled ? 'add' : 'remove'].apply(element.classList, classes);
    }

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                resolve();
            } catch (error) {
                reject(error);
            } finally {
                textarea.remove();
            }
        });
    }

    function copyImage(src) {
        if (!src || !navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') {
            return Promise.reject(new Error('Image clipboard is not supported.'));
        }
        var absoluteSrc = new URL(src, window.location.href).href;
        function writeBlob(blob, mimeType) {
            var type = mimeType || blob.type || 'image/png';
            var item = {};
            item[type] = blob;
            return navigator.clipboard.write([new ClipboardItem(item)]);
        }
        function bitmapToPngBlob(bitmap) {
            return new Promise(function (resolve, reject) {
                var canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                var context = canvas.getContext('2d');
                if (!canvas.width || !canvas.height || !context) {
                    reject(new Error('Image cannot be rendered.'));
                    return;
                }
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(bitmap, 0, 0);
                canvas.toBlob(function (blob) {
                    blob ? resolve(blob) : reject(new Error('Image cannot be encoded.'));
                }, 'image/png');
            });
        }
        function imageElementToPngBlob(blob) {
            return new Promise(function (resolve, reject) {
                var objectUrl = URL.createObjectURL(blob);
                var image = new Image();
                image.onload = function () {
                    var canvas = document.createElement('canvas');
                    canvas.width = image.naturalWidth || image.width;
                    canvas.height = image.naturalHeight || image.height;
                    var context = canvas.getContext('2d');
                    URL.revokeObjectURL(objectUrl);
                    if (!canvas.width || !canvas.height || !context) {
                        reject(new Error('Image cannot be rendered.'));
                        return;
                    }
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    context.drawImage(image, 0, 0);
                    canvas.toBlob(function (pngBlob) {
                        pngBlob ? resolve(pngBlob) : reject(new Error('Image cannot be encoded.'));
                    }, 'image/png');
                };
                image.onerror = function () {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error('Image cannot be loaded.'));
                };
                image.src = objectUrl;
            });
        }
        function convertToPng(blob) {
            if (window.createImageBitmap) {
                return createImageBitmap(blob).then(bitmapToPngBlob).catch(function () {
                    return imageElementToPngBlob(blob);
                });
            }
            return imageElementToPngBlob(blob);
        }
        var imageBlobPromise = fetch(absoluteSrc, { credentials: 'same-origin', cache: 'force-cache' })
            .then(function (response) {
                if (!response.ok) throw new Error('Image cannot be loaded.');
                return response.blob();
            });
        return navigator.clipboard.write([new ClipboardItem({
            'image/png': imageBlobPromise.then(convertToPng)
        })]);
    }

    function copyImageElement(button) {
        return new Promise(function (resolve, reject) {
            var media = button ? button.closest('.booklet-mob-action-media,.booklet-pet-action-media') : null;
            var image = media ? qs('img', media) : null;
            if (!image) {
                reject(new Error('Image element not found.'));
                return;
            }
            var range = document.createRange();
            range.selectNode(image);
            var selection = window.getSelection();
            if (!selection) {
                reject(new Error('Selection is not supported.'));
                return;
            }
            selection.removeAllRanges();
            selection.addRange(range);
            try {
                document.execCommand('copy') ? resolve() : reject(new Error('Copy command failed.'));
            } catch (error) {
                reject(error);
            } finally {
                selection.removeAllRanges();
            }
        });
    }

    function getSnippetText(source) {
        if (!source) return '';
        if (source.tagName && source.tagName.toLowerCase() === 'template') {
            return source.content ? source.content.textContent.trim() : source.innerHTML.trim();
        }
        return source.textContent.trim();
    }

    function getElementValue(element) {
        if (!element) return '';
        var tagName = element.tagName ? element.tagName.toLowerCase() : '';
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            return element.value || '';
        }
        return element.textContent || '';
    }

    function getCopyText(button) {
        if (!button) return '';
        if (button.hasAttribute('data-ui-copy-text')) {
            return button.dataset.uiCopyText || '';
        }
        if (button.dataset.uiCopyValueTarget) {
            return getElementValue(qs(button.dataset.uiCopyValueTarget));
        }
        if (button.dataset.uiCopyHtmlTarget) {
            var htmlTarget = qs(button.dataset.uiCopyHtmlTarget);
            return htmlTarget ? htmlTarget.innerHTML.trim() : '';
        }
        if (button.dataset.uiCopyAttrTarget) {
            var attrTarget = qs(button.dataset.uiCopyAttrTarget);
            var attrName = button.dataset.uiCopyAttr || 'href';
            return attrTarget ? (attrTarget.getAttribute(attrName) || '') : '';
        }
        if (button.dataset.uiCopyTarget) {
            return getSnippetText(qs(button.dataset.uiCopyTarget));
        }
        return '';
    }

    function setCopyButtonState(button, state) {
        if (!button) return;
        var original = button.getAttribute('data-ui-copy-original-html');
        if (!original) {
            original = button.innerHTML;
            button.setAttribute('data-ui-copy-original-html', original);
        }
        var successText = button.dataset.uiCopySuccessText || '已复制';
        var errorText = button.dataset.uiCopyErrorText || '复制失败';
        var emptyText = button.dataset.uiCopyEmptyText || '无内容';
        var icon = {
            success: 'tw-icon-[mdi--check]',
            error: 'tw-icon-[mdi--alert-circle-outline]',
            empty: 'tw-icon-[mdi--information-outline]'
        }[state] || 'tw-icon-[mdi--check]';
        var text = {
            success: successText,
            error: errorText,
            empty: emptyText
        }[state] || successText;

        button.disabled = true;
        button.classList.add('tw-opacity-80');
        if (button.dataset.uiCopyState === 'icon') {
            button.innerHTML = '<span class="' + icon + '"></span>';
        } else {
            button.innerHTML = '<span class="' + icon + '"></span>' + text;
        }

        window.clearTimeout(button._uiCopyTimer);
        button._uiCopyTimer = window.setTimeout(function () {
            button.innerHTML = original;
            button.disabled = false;
            button.classList.remove('tw-opacity-80');
        }, Number(button.dataset.uiCopyStateDuration || 1200));
    }

    function initTabs() {
        qsa('[data-ui-tabs]').forEach(function (root) {
            var triggers = qsa('[data-ui-tab]', root);
            var targets = triggers.map(function (trigger) {
                return trigger.dataset.uiTabTarget;
            });
            var panels = qsa('[data-ui-tab-panel]').filter(function (panel) {
                return targets.indexOf(panel.dataset.uiTabPanel) !== -1;
            });
            var activeClasses = splitClasses(root.dataset.uiTabActiveClass);
            var inactiveClasses = splitClasses(root.dataset.uiTabInactiveClass);
            if (!triggers.length || !panels.length) return;

            function activate(target) {
                triggers.forEach(function (trigger) {
                    var active = trigger.dataset.uiTabTarget === target;
                    trigger.setAttribute('aria-selected', active ? 'true' : 'false');
                    trigger.setAttribute('tabindex', active ? '0' : '-1');
                    setClasses(trigger, activeClasses, active);
                    setClasses(trigger, inactiveClasses, !active);
                });
                panels.forEach(function (panel) {
                    panel.classList.toggle('tw-hidden', panel.dataset.uiTabPanel !== target);
                });
            }

            triggers.forEach(function (trigger) {
                trigger.addEventListener('click', function () {
                    activate(trigger.dataset.uiTabTarget);
                });
                trigger.addEventListener('keydown', function (event) {
                    if (event.key !== 'ArrowRight' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft' && event.key !== 'ArrowUp') return;
                    event.preventDefault();
                    var current = triggers.indexOf(trigger);
                    var next = (event.key === 'ArrowRight' || event.key === 'ArrowDown') ? current + 1 : current - 1;
                    if (next < 0) next = triggers.length - 1;
                    if (next >= triggers.length) next = 0;
                    triggers[next].focus();
                    activate(triggers[next].dataset.uiTabTarget);
                });
            });

            var initial = triggers.find(function (trigger) {
                return trigger.getAttribute('aria-selected') === 'true';
            }) || triggers[0];
            activate(initial.dataset.uiTabTarget);
        });
    }

    function bindClicks() {
        document.addEventListener('click', function (event) {
            var modalOpen = event.target.closest('[data-ui-modal-target]');
            var modalClose = event.target.closest('[data-ui-modal-close]');
            var memberPointsBillClose = event.target.closest('[data-member-points-bill-close]');
            var drawerOpen = event.target.closest('[data-ui-drawer-target]');
            var drawerClose = event.target.closest('[data-ui-drawer-close]');
            var preview = event.target.closest('[data-ui-image-viewer],[data-ui-preview]');
            var copyButton = event.target.closest('[data-ui-copy-image-src],[data-ui-copy-target],[data-ui-copy-value-target],[data-ui-copy-html-target],[data-ui-copy-attr-target],[data-ui-copy-text]');
            var codeButton = event.target.closest('[data-ui-code-target]');
            var codeCopyButton = event.target.closest('[data-ui-code-copy]');

            if (codeButton) {
                event.preventDefault();
                var codeSource = qs(codeButton.dataset.uiCodeTarget);
                var codeModal = qs('#ui-code-modal');
                var codeContent = qs('[data-ui-code-content]', codeModal);
                var codeTitle = qs('[data-ui-code-title]', codeModal);
                activeCodeText = getSnippetText(codeSource);
                if (codeContent) codeContent.textContent = activeCodeText;
                if (codeTitle) codeTitle.textContent = codeButton.dataset.uiCodeTitle || '组件代码';
                openModal(codeModal);
            }
            if (codeCopyButton) {
                event.preventDefault();
                copyText(activeCodeText).then(function () {
                    toast({ type: 'success', message: '代码已复制' });
                }).catch(function () {
                    toast({ type: 'error', message: '复制失败，请手动选择代码' });
                });
            }
            if (copyButton) {
                event.preventDefault();
                if (copyButton.dataset.uiCopyImageSrc) {
                    copyImageElement(copyButton).then(function () {
                        setCopyButtonState(copyButton, 'success');
                        toast({ type: 'success', message: copyButton.dataset.uiCopyMessage || 'Image copied' });
                    }).catch(function (error) {
                        if (window.console && console.error) console.error('copy image element failed', error);
                        copyImage(copyButton.dataset.uiCopyImageSrc).then(function () {
                            setCopyButtonState(copyButton, 'success');
                            toast({ type: 'success', message: copyButton.dataset.uiCopyMessage || 'Image copied' });
                        }).catch(function (imageError) {
                            if (window.console && console.error) console.error('copy image failed', imageError);
                            setCopyButtonState(copyButton, 'error');
                            toast({ type: 'error', message: copyButton.dataset.uiCopyErrorText || 'Copy failed' });
                        });
                    });
                    return;
                }
                var copiedText = getCopyText(copyButton);
                if (!copiedText) {
                    setCopyButtonState(copyButton, 'empty');
                    return toast({ type: 'warning', message: '没有可复制的内容' });
                }
                copyText(copiedText).then(function () {
                    setCopyButtonState(copyButton, 'success');
                    toast({ type: 'success', message: copyButton.dataset.uiCopyMessage || '内容已复制' });
                }).catch(function () {
                    setCopyButtonState(copyButton, 'error');
                    toast({ type: 'error', message: '复制失败，请手动选择内容' });
                });
            }
            if (memberPointsBillClose) {
                event.preventDefault();
                closeModal(qs('#member-points-bill-modal'));
                return;
            }
            if (modalOpen) {
                event.preventDefault();
                openModal(modalOpen.dataset.uiModalTarget);
            }
            if (modalClose) {
                event.preventDefault();
                closeModal(modalClose.closest('[data-ui-modal]') || activeModal);
            }
            if (drawerOpen) {
                event.preventDefault();
                openDrawer(drawerOpen.dataset.uiDrawerTarget);
            }
            if (drawerClose) {
                event.preventDefault();
                closeDrawer(drawerClose.closest('[data-ui-drawer]'));
            }
            if (preview) {
                event.preventDefault();
                openPreview(preview);
            }
            if (event.target.matches('[data-ui-modal-backdrop]')) closeModal();
            if (event.target.matches('[data-ui-drawer-backdrop]')) closeDrawer();
            if (event.target.matches('[data-ui-preview-backdrop]') || event.target.closest('[data-ui-preview-close]')) closePreview();
        });

        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') return;
            closePreview();
            closeModal();
            closeDrawer();
        });
    }

    function init() {
        bindClicks();
        initDropdowns();
        initTabs();
        initTooltips();
        initDraggableModals();
        initBookletSwitchers();
    }

    window.UI = {
        init: init,
        modal: { open: openModal, close: closeModal },
        drawer: { open: openDrawer, close: closeDrawer },
        toast: toast,
        preview: { open: openPreview, close: closePreview }
    };

    document.addEventListener('DOMContentLoaded', init);
})();

