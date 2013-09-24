/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Shelve.
 *
 * The Initial Developer of the Original Code is
 * Thomas Link.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * 
 * ***** END LICENSE BLOCK ***** */

/*jsl:option explicit*/
/*jsl:declare document*/
/*jsl:declare window*/

Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");


var shelve = {

    withShelfName: function (name) {
        var shelfId = shelve.getShelfNumberByName(name);
        if (shelfId) {
            return shelve.withShelfNumber(shelfId);
        } else {
            return null;
        }
    },

    withShelfNumber: function (shelfId, doc_params) {
        // shelveUtils.debug('withShelfNumber shelfId=', shelfId);
        // shelveUtils.debug('withShelfNumber doc_params=', doc_params);
        var sp_params = shelve.getSavePageToShelveParams(shelfId, doc_params || {});
        if (sp_params && shelve.savePageWithParams(sp_params)) {
            return true;
        }
        return null;
    },

    savePage: function () {
        try {
            var sp_params = shelve.getSavePageParams({});
            // shelveUtils.debug("shelve.savePage sp_params=", sp_params);
            if (sp_params && sp_params.filename) {
                shelve.savePageWithParams(sp_params);
                if (sp_params.auto) {
                    // shelveUtils.debug('savePage: sp_params.interactive=', sp_params.interactive);
                    shelve.installAutoShelve(sp_params);
                }
            }
        } catch (e) {
            throw ('Shelve page: ' + e);
        }
    },

    saveSelection: function (doc) {
        try {
            var content = shelve.getDocumentClip({});
            // shelveUtils.debug('shelve saveSelection: content=', content);
            var doc_params = {
                mime: 'text',
                mime_fix: true,
                mockup: true,
                clip: ''
            };
            var sp_params = shelve.getSavePageParams(doc_params);
            sp_params.shelve_content = content;
            if (sp_params && sp_params.filename) {
                shelve.savePageWithParams(sp_params);
            }
        } catch (e) {
            throw ('Shelve selection: ' + e);
        }
    },

    shelveURL: function (type, url, title) {
        var doc_params = {
            url: url,
            content_type: type,
            // FIXME: doc = {} ok?
            doc: {
                mockup: true,
                documentURI: url,
                URL: url,
                //TODO: guess contentType
                contentType: '',
                title: title
            },
            title: '',
            // FIXME: getUrlMime()
            mime: 'binary',
            mime_fix: true,
            keywords: ''
        };
        try {
            var sp_params = shelve.getSavePageParams(doc_params);
            if (sp_params && sp_params.filename) {
                shelve.savePageWithParams(sp_params);
            }
        } catch (e) {
            throw ('Shelve URL ' + url + ': ' + e);
        }
    },

    savePageWithParams: function (sp_params) {
        var filename = sp_params.filename;
        // shelveUtils.debug('savePageWithParams filename=', filename);
        if (filename === '-' || shelve.shouldWriteFile(sp_params)) {
            if (filename) {
                // http://developer.mozilla.org/en/docs/Code_snippets:Miscellaneous
                try {
                    var params_fix = shelve.frozenParams(sp_params);
                    // shelveUtils.debug('savePageWithParams params_fix:', params_fix);
                    if (filename !== '-') {
                        var doc = shelveUtils.getDocument(sp_params);
                        var doc_type = shelveUtils.getDocumentType(sp_params);
                        // shelveUtils.debug('shelve savePageWithParams: doc=', doc);
                        // shelveUtils.debug('shelve savePageWithParams: doc is null =', doc === null);
                        // shelveUtils.debug('shelve savePageWithParams: doc.contentType=', doc.contentType);
                        // shelveUtils.debug('shelve savePageWithParams: doc_type=', doc_type);
                        switch (doc_type) {
                            case 'text/html':
                            case 'application/xhtml+xml':
                            if (sp_params.shelve_content) {
                                shelve.saveText(sp_params.shelve_content, filename, params_fix);
                            } else {
                                shelve.saveDocument(doc, filename, params_fix);
                            }
                            break;

                            default:
                            // binary
                            shelve.saveBinary(doc, filename, params_fix);
                            break;
                        }
                        shelve.notifyUser(shelveUtils.localized('saved.as'), filename, params_fix);
                    }
                    shelve.log(params_fix);
                    return true;
                } catch (e) {
                    // alert(e);
                    shelveUtils.log("Error when saving document to "+filename+": "+e);
                    shelveUtils.log("Stack Trace:\n"+e.stack);
                    throw e;
                }
            }
        } else {
            shelveUtils.log('Shelve: Do not (over)write file: ' + filename);
        }
        return false;
    },

    shouldWriteFile: function (sp_params) {
        // shelveUtils.debug('shouldWriteFile: sp_params=', sp_params);
        var filename = sp_params.filename;
        // shelveUtils.debug('shouldWriteFile: filename=', filename);
        var file = shelveUtils.localFile(filename);
        // shelveUtils.debug('shouldWriteFile: file=', file);
        // shelveUtils.debug('shouldWriteFile: file.exists=', file.exists());
        if (file === null) {
            return false;
        } else if (file.exists()) {
            var shelfNo = sp_params.shelf;
            if (shelfNo) {
                var overwrite_files = shelveStore.getInt(null, 'overwrite_files', 1);
                // shelveUtils.debug('shouldWriteFile: overwrite_files=', overwrite_files);
                var overwrite = shelveStore.get(shelfNo, 'overwrite', overwrite_files);
                // shelveUtils.debug('shouldWriteFile: overwrite=', overwrite);
                if (overwrite === 2) {
                    var prompts = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].
                    getService(Components.interfaces.nsIPromptService);
                    var result = prompts.confirm(window, shelveUtils.localized('file.exists'), shelveUtils.localized('file.overwrite'));
                    // shelveUtils.debug('shelve.shouldWriteFile result=', result);
                    if (result) {
                        overwrite = 1;
                    }
                }
                // shelveUtils.debug('shelve.shouldWriteFile overwrite=', overwrite);
                return overwrite === 1;
            } else {
                shelveUtils.log('shouldWriteFile: Unknown shelfNo: Please report');
            }
        }
        return true;
    },

    saveDocument: function (doc, filename, sp_params) {
        // shelveUtils.debug('shelve saveDocument: doc=', doc);
        // shelveUtils.debug('shelve saveDocument: filename=', filename);
        // shelveUtils.debug('shelve saveDocument: sp_params=', sp_params);
        var file = shelveUtils.localFile(filename);
        if (file === null) {
            return false;
        }
        var dataname = filename.replace(/\.\w+$/, '_files');
        // shelveUtils.debug('shelve saveDocument: dataname=', dataname);
        var dir = file.parent;
        if (!dir.exists()) {
            /*jsl:ignore*/
            dir.create(dir.DIRECTORY_TYPE, 0755);
            /*jsl:end*/
        }

        var data = null;
        var mime = null;
        var encode = null;
        var allow_footer = true;

        var footer_sp_params = null;
        var enable_dlm = shelve.useDownloadManager(sp_params, 'document');
        var wbp = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].
        createInstance(Components.interfaces.nsIWebBrowserPersist);
        // wbp.persistFlags |= wbp.PERSIST_FLAGS_FROM_CACHE;
        wbp.persistFlags |= wbp.PERSIST_FLAGS_FROM_CACHE | wbp.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

        var saver = function (doc, file, dataPath, outputContentType, encodingFlags, wrapColumn) {
            // nsIDOMDocument document, 
            // nsISupports file, 
            // nsISupports dataPath, 
            // char* outputContentType, 
            // PRUint32 encodingFlags, 
            // PRUint32 wrapColumn 
            // shelveUtils.debug('shelve saveDocument.saver: file=', file);
            wbp.saveDocument(doc, file, dataPath, outputContentType, encodingFlags, wrapColumn);
        };

        switch (sp_params.mime) {
            case 'text':
            mime = 'text/plain';
            encode = wbp.ENCODE_FLAGS_FORMATTED |
                     wbp.ENCODE_FLAGS_ABSOLUTE_LINKS |
                     wbp.ENCODE_FLAGS_NOFRAMES_CONTENT;
            footer_sp_params = sp_params;
            break;

            case 'text_latin1':
            mime = 'text/plain';
            encode = wbp.ENCODE_FLAGS_FORMATTED |
                     wbp.ENCODE_FLAGS_ABSOLUTE_LINKS;
            // | wbp.ENCODE_FLAGS_NOFRAMES_CONTENT;
            footer_sp_params = sp_params;
            break;

            case 'html':
            mime = 'text/html';
            encode = wbp.ENCODE_FLAGS_RAW;
            // wbp.persistFlags |= wbp.PERSIST_FLAGS_IGNORE_IFRAMES | wbp.PERSIST_FLAGS_IGNORE_REDIRECTED_DATA;
            wbp.persistFlags |= wbp.PERSIST_FLAGS_IGNORE_IFRAMES;
            footer_sp_params = sp_params;
            break;

            case 'webpage_maf':
            if (shelveUtils.isMafEnabled(false)) {
                mime = 'text/html';
                allow_footer = false;
                saver = shelveUtils.getMafSaver(sp_params, doc, file, 'TypeMAFF', enable_dlm) || saver;
                enable_dlm = false;
                break;
            }

            case 'webpage_mht':
            if (shelveUtils.isMafEnabled(false)) {
                mime = 'text/html';
                allow_footer = false;
                saver = shelveUtils.getMafSaver(sp_params, doc, file, 'TypeMHTML', enable_dlm) || saver;
                enable_dlm = false;
                break;
            }

            case 'webpage':
            /*jsl:fallthru*/
            default:
            mime = 'text/html';
            // encode = wbp.ENCODE_FLAGS_RAW;
            data = shelveUtils.localFile(dataname);
            // shelveUtils.debug('shelve saveDocument: data=', data);
            // shelveUtils.debug('shelve saveDocument: dataname=', dataname);
            // shelveUtils.debug('shelve saveDocument: allow_footer=', allow_footer);
            if (allow_footer) {
                footer_sp_params = sp_params;
            }
            break;
        }
        // shelveUtils.debug('shelve saveDocument: mime=', mime);
        // shelveUtils.debug('shelve saveDocument: encode=', encode);
        var uri = shelveUtils.newURI(sp_params.url);
        var file_uri = shelveUtils.newFileURI(file);
        // shelveUtils.debug('shelve saveDocument: enable_dlm=', enable_dlm);
        // shelveUtils.debug('shelve saveDocument: footer_sp_params=', footer_sp_params);
        if (enable_dlm) {
            shelve.registerDownload(wbp, uri, file_uri, sp_params, footer_sp_params);
        }
        try {
            saver(doc, file, data, mime, encode, null);
            if (!enable_dlm && footer_sp_params !== null) {
                shelve.addFooter(sp_params);
            }
            return true;
        } catch (exception) {
            // alert(shelveUtils.localized('error.saving')+ ': ' + filename);
            shelve.notifyUser(shelveUtils.localized('error.saving'), filename, sp_params);
            shelveUtils.log(exception);
        }
        return false;
    },

    isPrivate: function(sp_params) {
        var win = shelveUtils.getWindow(sp_params);
        return PrivateBrowsingUtils.isWindowPrivate(win);
    },

    saveBinary: function (doc, filename, sp_params) {
        // shelveUtils.debug('shelve saveBinary: filename=', filename);
        var uri = shelveUtils.newURI(sp_params.url);

        // filename = filename.replace(/\\\\+/g, '\\');
        var file = shelveUtils.localFile(filename);
        if (file === null) {
            return false;
        } else if (!file.exists()) {
            /*jsl:ignore*/
            file.create(0x00, 0644);
            /*jsl:end*/
        }
        var file_uri = shelveUtils.newFileURI(file); 

        var wbp = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].
        createInstance(Components.interfaces.nsIWebBrowserPersist);
        wbp.persistFlags |= wbp.PERSIST_FLAGS_FROM_CACHE;
        wbp.persistFlags &= ~wbp.PERSIST_FLAGS_NO_CONVERSION;
        if (shelve.useDownloadManager(sp_params, 'binary')) {
            shelve.registerDownload(wbp, uri, file_uri, sp_params, null);
        }

        if (shelveUtils.appVersion() >= '18') {
            var isPrivate = shelve.isPrivate(sp_params);
            wbp.savePrivacyAwareURI(uri, null, null, null, null, file_uri, isPrivate);
        } else {
            wbp.saveURI(uri, null, null, null, null, file_uri);
        }
        return true;
    },

    saveText: function (text, filename, sp_params) {
        // shelveUtils.debug('shelve saveText: filename=', filename);
        // shelveUtils.debug('shelve saveText: text=', text);
        var file = shelveUtils.localFile(filename);
        if (file === null) {
            return false;
        } else if (!file.exists()) {
            file.create(0x00, 0644);
        }

        var text_enc = shelve.getUnicharPref(shelve.getPrefs('text.'), 'encoding');
        // shelveUtils.debug('shelve saveText: text_enc=', text_enc);
        shelveUtils.writeTextFile(file, text, text_enc, 0x02 | 0x08 | 0x20);

        shelve.addFooter(sp_params);
        return true;
    },

    useDownloadManager: function (sp_params, mode) {
        var prefs_dlm = shelve.getPrefs('use_download_manager.');
        return !sp_params.noAlertNotification && !shelveUtils.appInfo().match(/^Firefox2/) && shelve.getBoolPref(prefs_dlm, mode);
    },

    STATE_STOP: Components.interfaces.nsIWebProgressListener.STATE_STOP,

    registerDownload: function (persist, uri, file_uri, sp_params, footer_sp_params) {
        // shelveUtils.debug("registerDownload persist=", persist);
        // shelveUtils.debug("registerDownload uri=", uri);
        // shelveUtils.debug("registerDownload file_uri=", file_uri);
        // shelveUtils.debug("registerDownload footer_sp_params=", footer_sp_params);
        var tr = Components.classes['@mozilla.org/transfer;1'].
            createInstance(Components.interfaces.nsITransfer);
        if (shelveUtils.appVersion() >= '18') {
            var isPrivate = shelve.isPrivate(sp_params);
            // shelveUtils.debug("registerDownload isPrivate=", isPrivate);
            tr.init(uri, file_uri, '', null, null, null, persist, isPrivate);
        } else {
            tr.init(uri, file_uri, '', null, null, null, persist);
        }
        var dll = new DownloadListener(window, tr);
        // shelveUtils.debug("registerDownload: footer_sp_params=", footer_sp_params !== null);
        if (footer_sp_params) {
            var dlm = Components.classes['@mozilla.org/download-manager;1']
                .getService(Components.interfaces.nsIDownloadManager);
            persist.progressListener = {
                addedFooter: false,
                onProgressChange: dll.onProgressChange,
                onStatusChange: dll.onStatusChange,
                onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {
                    // shelveUtils.debug("registerDownload: stop=", aStateFlags & shelve.STATE_STOP);
                    if (!this.addedFooter && (aStateFlags & shelve.STATE_STOP)) {
                        // shelveUtils.debug("Download finished:", uri);
                        shelve.addFooter(footer_sp_params);
                        this.addedFooter = true;
                    }
                    return dll.onStateChange(aWebProgress, aRequest, aStateFlags, aStatus);
                }
            };
            // shelveUtils.debug("registerDownload: 2 onStateChange=", persist.progressListener.onStateChange);
        } else {
            persist.progressListener = dll;
        }
        // dm.addListener(dl);
    },

    hotkeys: {},

    hotkeysInstalled: false,

    installHotkeyListener: function () {
        if (!shelve.hotkeysInstalled) {
            gBrowser.addEventListener('keypress', shelve.onKeypressListener, true);
            shelve.hotkeysInstalled = true;
            // shelveUtils.log('Installed hotkey handler');
        }
    },

    uninstallHotkeyListener: function () {
        if (shelve.hotkeysInstalled) {
            window.removeEventListener('keypress', shelve.onKeypressListener, true);
            shelve.hotkeysInstalled = false;
            // shelveUtils.log('Uninstalled hotkey handler');
        }
    },

    restoreCount: 0,

    setupAutoshelf: function () {
        var autoshelf = shelve.getAutoshelf();
        if (autoshelf) {
            // shelveUtils.debug('setupAutoshelf: autoshelf=', autoshelf);
            var shelfId = shelve.getShelfNumberByName(autoshelf);
            // shelveUtils.debug('setupAutoshelf: shelfId=', shelfId);
            if (shelfId) {
                var sp_params = shelve.getSavePageToShelveParams(shelfId, {});
                // shelveUtils.debug('setupAutoshelf: sp_params=', sp_params);
                sp_params.noAlertNotification = true;
                sp_params.interactive = false;
                shelve.installAutoShelve(sp_params);
                shelveUtils.log('Installed autoshelf: ' + autoshelf);
                shelve.restoreCount = 0;
                document.addEventListener('SSTabRestoring', shelve.autoDisableWhileRestoring, false);
                document.addEventListener('SSTabRestored', shelve.autoReEnableWhileRestoring, false);
            } else {
                shelveUtils.log('Unknown autoshelf: ' + autoshelf);
            }
        }
    },

    autoselect: false,

    setupAutoSelect: function (win) {
        var win = win || window;
        shelveUtils.log("setupAutoSelect: "+ win.shelve.autoselect);
        shelveUtils.debug('setupAutoSelect autoselect=', win.shelve.autoselect);
        
        var max = shelveStore.max();
        shelveUtils.log("setupAutoSelect: max = "+max);
        for (var i = 1; i <= max; i++) {
            var autoselect = shelveStore.get(i, 'autoselect', null);
            shelveUtils.log("setupAutoSelect: "+i+": autoselect = "+autoselect);
            if (autoselect && !win.shelve.autoselect) {
                win.shelve.addEventListener(shelve.autoSelectShelve, true);
                win.shelve.autoselect = true;
                shelveUtils.debug('setupAutoSelect '+i+': set autoselect=', win.shelve.autoselect); 
                return;
            }
        }
        
        // If here, then no shelves wanted auto select, so remove the listener
        if (win.shelve.autoselect) { 
            shelveUtils.log("setupAutoSelect: Uninstalling autoselect for window");
            shelve.removeEventListener(shelve.autoSelectShelve, true);
            win.shelve.autoselect = false;
        }
    },

    events: [
        'load',
        'DOMContentLoaded',
        'DOMFrameContentLoaded',
        'TabSelect'
    ],

    _listeners: {},

    addEventListener: function (listener, useCapture) {
        var prefs_events = shelve.getPrefs('events.');
        
        if (shelve._listeners[listener]) {
            // already have a listener for this, don't add another one
            return;
        }
        shelve._listeners[listener] = shelveUtils.exceptionWrap(listener);
        
        for (var ev in shelve.events) {
            var event = shelve.events[ev];
            var use = shelve.getBoolPref(prefs_events, event);
            // shelveUtils.debug('addEventListener use ' + event + ':', use);
            if (use) {
                // shelveUtils.debug('addEventListener ' + event + ':', listener);
                var target;
                switch (event) {
                    case 'load':
                        target = window.gBrowser;
                        break;

                    default:
                        target = window;
                }
                // var target = document.getElementById("appcontent");
                // var target = window.;
                target.addEventListener(event, shelve._listeners[listener], useCapture);
            }
        }
    },

    removeEventListener: function (listener, useCapture) {
        var prefs_events = shelve.getPrefs('events.');
        if (shelve._listeners[listener]) {
            listener = shelve._listeners[listener];
            delete shelve._listeners[listener];
        }
        for (var ev in shelve.events) {
            var use = shelve.getBoolPref(prefs_events, shelve.events[ev]);
            if (use) {
                // shelveUtils.debug('removeEventListener ' + shelve.events[ev] +':', listener);
                // var target = document.getElementById("appcontent");
                var target = window;
                target.removeEventListener(shelve.events[ev], listener, useCapture);
            }
        }
    },

    getAutoshelf: function () {
        var autoshelf = shelve.getAutoshelfPref();
        return autoshelf == '--' ? null : autoshelf;
    },

    autoDisableWhileRestoring: function () {
        // shelve.autoPilot = false;
        // shelve.restoreCount++;
    },

    autoReEnableWhileRestoring: function () {
        // shelve.restoreCount--;
        // if (shelve.restoreCount === 0) {
        //     shelve.autoPilot = true;
        //     // alert('autoReEnableWhileRestoring:' + shelve.autoPilot);
        // }
    },

    setupHotkeys: function () {
        // global hotkey
        var prefs_hotkey = shelve.getPrefs('hotkey.');
        var kc = shelve.getUnicharPref(prefs_hotkey, 'keycode');
        if (kc && kc.match(/\S/)) {
            // shelveUtils.debug('setupHotkeys Keycode: ', kc);
            document.getElementById('key_shelve').setAttribute('keycode', 'VK_' + kc);
            // var kt = shelve.getUnicharPref(prefs_hotkey, 'keytext');
            // if (kt) {
            //     document.getElementById('key_shelve').setAttribute('keytext', kt);
            // }
            var mod = [];
            if (shelve.getBoolPref(prefs_hotkey, 'alt')) {
                mod.push('alt');
            }
            if (shelve.getBoolPref(prefs_hotkey, 'ctrl')) {
                mod.push('accel');
            }
            if (shelve.getBoolPref(prefs_hotkey, 'shift')) {
                mod.push('shift');
            }
            if (shelve.getBoolPref(prefs_hotkey, 'meta')) {
                mod.push('meta');
            }
            if (mod.length > 0) {
                mod = mod.join(',');
                // shelveUtils.debug('setupHotkeys mod: ', mod);
                document.getElementById('key_shelve').setAttribute('modifiers', mod);
            }
        }

        // shelf-specific hotkeys
        var max = shelveStore.max();
        for (var i = 1; i <= max; i++) {
            var hk = shelveStore.get(i, 'hotkey', null);
            if (hk) {
                var name = shelveStore.get(i, 'name', i);
                if (!shelve.hotkeys[name]) {
                    var hkd = {
                        hotkey: hk,
                        alt: shelveStore.get(i, 'hotkey_alt', false),
                        ctrl: shelveStore.get(i, 'hotkey_ctrl', false),
                        shift: shelveStore.get(i, 'hotkey_shift', false),
                        meta: shelveStore.get(i, 'hotkey_meta', false)
                    };
                    shelve.registerHotkeyForShelf(name, hkd);
                }
            }
        }
    },

    setupPopup: function () {
        var contextMenu = document.getElementById('contentAreaContextMenu');
        if (contextMenu) {
            contextMenu.addEventListener('popupshowing', shelve.showHidePopupItems, false);
        }
    },

    showHidePopupItems: function (ev) {
        document.getElementById('context-shelve-url').hidden = true;
        document.getElementById('context-shelve-image').hidden = true;
        document.getElementById('context-shelve-selection').hidden = true;
        if (gContextMenu.onImage) {
            document.getElementById('context-shelve-image').hidden = false;
        }
        if (gContextMenu.onLink && !shelve.matchStopRx(gContextMenu.linkURL, 'blacklist')) {
            document.getElementById('context-shelve-url').hidden = false;
        }
        if (gContextMenu.isTextSelected) {
            document.getElementById('context-shelve-selection').hidden = false;
        }
    },

    registerHotkeyForShelf: function (name, hotkeyDef) {
        shelve.hotkeys[name] = hotkeyDef;
        shelve.installHotkeyListener();
    },

    removeHotkeyForShelf: function (name) {
        if (shelve.hotkeys[name]) {
            delete shelve.hotkeys[name];
        }
    },

    onKeypressListener: function (ev) {
        // shelveUtils.debug('shelve.onKeypressListener: ', ev);
        // shelveUtils.debug('shelve.onKeypressListener: keyCode:', ev.keyCode);
        // shelveUtils.debug('shelve.onKeypressListener: altKey:', ev.altKey);
        // shelveUtils.debug('shelve.onKeypressListener: ctrlKey:', ev.ctrlKey);
        // shelveUtils.debug('shelve.onKeypressListener: shiftKey:', ev.shiftKey);
        // shelveUtils.debug('shelve.onKeypressListener: metaKey:', ev.metaKey);
        var hkn = 0;
        for (var hk in shelve.hotkeys) {
            hkn++;
            var hkd = shelve.hotkeys[hk];
            // alert('onKeypressListener: ' + hk + hkd.hotkey + ev['DOM_VK_' + hkd.hotkey] + hkd.alt + hkd.ctrl + hkd.shift + hkd.meta);
            // alert('onKeypressListener: ' + hk + hkd.hotkey + ev['DOM_VK_' + hkd.hotkey] + ev.altKey + ev.ctrlKey + ev.shiftKey + ev.metaKey);
            // // alert(ev.keyCode + String(ev.altKey) + String(ev.ctrlKey) + String(ev.shiftKey) + String(ev.metaKey));
            // alert(String(ev.keyCode) + ev.altKey + ev.ctrlKey + ev.shiftKey + ev.metaKey);
            // alert(String(ev.keyCode == ev['DOM_VK_' + hkd.hotkey])
            // + String(ev.altKey == hkd.alt)
            // + String(ev.ctrlKey == hkd.ctrl)
            // + String(ev.shiftKey == hkd.shift)
            // + String(ev.metaKey == hkd.meta));
            if (ev.keyCode == ev['DOM_VK_' + hkd.hotkey] && 
                ev.altKey == hkd.alt && 
                ev.ctrlKey == hkd.ctrl && 
                ev.shiftKey == hkd.shift && 
                ev.metaKey == hkd.meta) {
                if (shelve.withShelfName(hk)) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                break;
            }
        }
        if (hkn === 0) {
            shelve.uninstallHotkeyListener();
        }
    },

    autoPageParams: null,

    autoFileParams: null,

    autoPilot: null,

    onAutoPilot: function () {
        if (shelve.autoPilot && shelve.autoPageParams) {
            return shelve.autoPageParams.interactive === true ? 1 : 2;
        } else {
            return 0;
        }
    },

    installAutoShelve: function (sp_params) {
        // shelveUtils.debug('installAutoShelve: sp_params=', sp_params);
        // http://developer.mozilla.org/en/docs/Code_snippets:Tabbed_browser#Detecting_page_load
        // http://developer.mozilla.org/en/docs/Code_snippets:On_page_load
        // shelveUtils.debug('installAutoShelve: sp_params:', sp_params);
        if (sp_params) {
            shelve.autoPageParams = shelveUtils.clone(sp_params);
            shelve.autoPageParams.doc = null;
        }
        if (shelve.autoPageParams) {
            // shelveUtils.debug('installAutoShelve: autoPageParams:', shelve.autoPageParams);
            // shelveUtils.debug('installAutoShelve: autoPageParams.template:', shelve.autoPageParams.template);
            // shelveUtils.assert(!sp_params.shelf, false, 'sp_params.shelf is not empty');
            shelve.autoPilot = sp_params.shelf;
            shelve.autoFileParams = {
                template: shelve.autoPageParams.template,
                interactive: true,
                mime: shelve.autoPageParams.mime,
                // extension: shelve.autoPageParams.extension,
                userInput: shelve.userInput,
                userDirectory: shelve.userDirectory
            };
            // shelveUtils.debug('installAutoShelve: autoFileParams:', shelve.autoFileParams);
            shelve.setToolbarButton(true);
            shelve.addEventListener(shelve.autoShelve, true);
        }
    },

    uninstallAutoShelve: function (stop) {
        // shelveUtils.debug('uninstallAutoShelve: shelve.autoPageParams.interactive=', shelve.autoPageParams.interactive);
        if (shelve.autoPageParams) {
            shelve.autoPilot = null;
            shelve.autoFileParams = null;
            shelve.autoPageParams = null;
            shelve.setToolbarButton(false);
            shelve.removeEventListener(shelve.autoShelve, true);
            if (!stop && shelve.getAutoshelf) {
                shelve.setupAutoshelf();
                return false;
            } else {
                return true;
            }
        } else {
            return false;
        }
    },

    setToolbarButton: function (value) {
        var tbb = document.getElementById('shelve-toolbar-button');
        if (tbb) {
            tbb.checked = value;
        }
    },

    autoSelectShelve: function (dclevent) {
        // shelveUtils.debug('autoSelectShelve dclevent=', dclevent);
        // shelveUtils.debug('autoSelectShelve dclevent.type=', dclevent.type);
        // shelveUtils.debug('autoSelectShelve dclevent.originalTarget=', dclevent.originalTarget);
        // shelveUtils.debug('autoSelectShelve dclevent.originalTarget.url=', dclevent.originalTarget.url);
        // Note: gBrowser should be available anytime after the 'load' event
        var doc_params = {browser: gBrowser};
        if (dclevent.type == 'DOMContentLoaded') {
            doc_params.doc = dclevent.originalTarget;
            // shelveUtils.debug('shelve.autoShelve DOMContentLoaded doc=', doc_params.doc);
        } else if (dclevent.type == 'TabSelect') {
            doc_params.doc = dclevent.originalTarget.linkedBrowser.contentDocument;
            // shelveUtils.debug('shelve.autoShelve TabSelect doc=', doc_params.doc);
        } else if (dclevent.type == 'load') {
            doc_params.doc = dclevent.target;
        } else {
            doc_params.doc = shelveUtils.getDocument({});
            // shelveUtils.debug('shelve.autoShelve getDocument() doc=', doc_params.doc);
        }
        // We want to skip frames because they're mostly garbage
        if (shelve.getBoolPref(shelve.getPrefs('auto.'), 'no_frames', false) &&
            !shelveUtils.isTopLevelDoc(doc_params.doc, gBrowser)) {
            shelveUtils.debug('shelve.autoShelve doc not top level document: ', doc_params.doc.location && doc_params.doc.location.href);
            return;
        }
        // shelveUtils.debug('autoSelectShelve doc=', doc_params);
        var url = shelveUtils.getDocumentURL(doc_params);
        // shelveUtils.debug('autoSelectShelve url=', url);
        if (!shelve.matchStopRx(url, 'blacklist')) {
            // shelveUtils.debug('autoSelectShelve match stop_rx=', false);
            var max = shelveStore.max();
            for (var i = 1; i <= max; i++) {
                var autoselect = shelveStore.get(i, 'autoselect', null);
                // shelveUtils.debug('autoSelectShelve shelfNo=', i);
                // shelveUtils.debug('autoSelectShelve autoselect=', autoselect);
                if (autoselect) {
                    if (shelve.matchRx(i, url)) {
                        // shelveUtils.debug('autoSelectShelve match rx=', true);
                        shelve.withShelfNumber(i, doc_params);
                        var autocontinue = shelveStore.get(i, 'autocontinue', false);
                        if (!autocontinue) {
                            break;
                        }
                    }
                }
            }
        }
    },

    autoShelve: function (dclevent) {
        // shelveUtils.debug('shelve.autoShelve dclevent=', dclevent);
        if (shelve.autoPageParams) {
            // shelveUtils.debug('shelve.autoShelve dclevent.originalTarget=', dclevent.originalTarge);
            var doc;
            // shelveUtils.debug('shelve.autoShelve dclevent.type=', dclevent.type);
            if (dclevent.type == 'DOMContentLoaded') {
                doc = dclevent.originalTarget;
                // shelveUtils.debug('shelve.autoShelve DOMContentLoaded doc=', doc);
            } else if (dclevent.type == 'TabSelect') {
                doc = dclevent.originalTarget.linkedBrowser.contentDocument;
                // shelveUtils.debug('shelve.autoShelve TabSelect doc=', doc);
            } else if (dclevent.type == 'load') {
                doc = dclevent.target;
                // shelveUtils.debug('shelve.autoShelve load doc=', doc);
            } else {
                doc = shelveUtils.getDocument({});
                // shelveUtils.debug('shelve.autoShelve getDocument() doc=', doc);
            }
            // We want to skip frames because they're mostly garbage
            if (shelve.getBoolPref(shelve.getPrefs('auto.'), 'no_frames', false) &&
                !shelveUtils.isTopLevelDoc(doc, gBrowser)) {
                shelveUtils.debug('shelve.autoShelve doc not top level document: ', doc.location && doc.location.href);
                return;
            }
            var docurl = doc.URL;
            if (!docurl) {
                shelveUtils.log('shelve.autoShelve: no doc url', 2);
            }
            // shelveUtils.debug('shelve.autoShelve doc=', doc);
            // shelveUtils.debug('shelve.autoShelve autoPilot=', shelve.autoPilot);
            // shelveUtils.debug('shelve.autoShelve doc instanceof HTMLDocument=', doc instanceof HTMLDocument);
            // shelveUtils.debug('shelve.autoShelve if', shelve.autoPilot && doc instanceof HTMLDocument);
            if (shelve.autoPilot && doc instanceof HTMLDocument) {
                try {
                    // shelveUtils.debug('shelve.autoShelve docurl=', docurl);
                    if (!shelve.matchStopRx(docurl)) {
                        // shelveUtils.debug('autoShelve autoFileParams: ', shelve.autoFileParams);
                        var afp   = shelveUtils.clone(shelve.autoFileParams);
                        // shelveUtils.debug('afp0: ', afp);
                        afp.doc   = doc;
                        afp.title = doc.title;
                        afp.url   = docurl;
                        afp.clip  = '';
                        afp.parentWindow = window;
                        var doc_params_ext = {type: null, doc: doc};
                        afp.extension = shelveUtils.getExtension(doc_params_ext, afp.mime);
                        // shelveUtils.debug('autoShelve afp1: ', afp);
                        var filename = shelve.expandTemplate(afp);
                        // shelveUtils.debug('autoShelve filename: ', filename);
                        if (filename) {
                            var file = shelveUtils.localFile(filename);
                            // if (filename == '-' || (file && !file.exists())) {
                            if (filename == '-' || file) {
                                // shelveUtils.debug('autoPageParams: ', shelve.autoPageParams);
                                var app = shelveUtils.clone(shelve.autoPageParams);
                                // shelveUtils.debug('app0: ', app);
                                // Note: gBrowser should be available anytime after the 'load' event
                                app.browser = gBrowser;
                                app.filename = filename;
                                app.doc = doc;
                                app.title = doc.title;
                                app.url = docurl;
                                // shelveUtils.debug('app1: ', app);
                                shelve.savePageWithParams(app);
                            }
                        }
                    }
                } catch (e) {
                    // alert(e);
                    throw ('Shelve (autoShelve): ' + e);
                }
            }
        } else {
            shelve.uninstallAutoShelve(true);
        }
    },

    getShelfNumberByName: function (name) {
        var max = shelveStore.max();
        var shelfId = null;
        for (var i = 1; i <= max; i++) {
            if (shelveStore.get(i, 'name') == name) {
                shelfId = i;
                break;
            }
        }
        return shelfId;
    },

    getSavePageToShelveParams: function (shelfId, doc_params) {
        // shelveUtils.debug('getSavePageToShelveParams: shelfId=', shelfId);
        // shelveUtils.debug('getSavePageToShelveParams: doc_params=', doc_params);
        var template = shelveStore.get(shelfId, 'dir');
        // shelveUtils.debug('getSavePageToShelveParams template: ', template);
        var mime = shelve.getShelfMime(shelfId, doc_params);
        var filename = shelve.expandTemplateNow(shelfId, template, doc_params);
        if (filename) {
            var sp_params = {
                filename: filename,
                mime: mime,
                shelf: shelfId,
                template: template,
                extension: shelveUtils.getExtension(doc_params, mime),
                title: shelve.getDocumentTitle(doc_params),
                clip: shelve.getDocumentClip(doc_params),
                content_type: doc_params.content_type,
                auto: false
            };
            if (doc_params.browser) {
                sp_params.browser = doc_params.browser;
            }
            if (doc_params.doc) {
                sp_params.doc = doc_params.doc;
            }
            if (doc_params.keywords) {
                sp_params.keywords = doc_params.keywords;
            }
            if (doc_params.url) {
                sp_params.url = doc_params.url;
            }
            // shelveUtils.debug('getSavePageToShelveParams sp_params:', sp_params);
            return sp_params;
        }
        return null;
    },

    getSavePageParams: function (doc_params) {
        var prompts = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].
        getService(Components.interfaces.nsIPromptService);

        var list = [];
        var shelves = [];
        var shelfNos = [];
        var template;
        var max = shelveStore.max();
        var url = shelveUtils.getDocumentURL(doc_params);
        for (var i = 1; i <= max; i++) {
            // shelveUtils.debug('shelve.getSavePageParams i=', i);
            template = shelveStore.get(i, 'dir', null);
            // shelveUtils.debug('shelve.getSavePageParams template=', template);
            if (template && template.match(/\S/)) {
                if (template.match(/[*|<>&?"]/)) {
                    alert(shelveUtils.localized('malformed_template') + ': ' + template);
                    template = shelve.cleanValue(template);
                }
                if (shelve.matchRx(i, url)) {
                    // var autoselect = shelveStore.get(i, 'autoselect', null);
                    // if (!autoselect) {
                    var noautosave = shelveStore.get(i, 'noautosave', false);
                    // shelveUtils.debug('shelve.getSavePageParams !noautosave=', !noautosave);
                    if (!noautosave) {
                        var spp = shelve.getSavePageToShelveParams(i, doc_params);
                        return spp;
                    }
                }
                // shelveUtils.debug('shelve.getSavePageParams template=', template);
                shelves.push(template);
                shelfNos.push(i);
                list.push(shelveStore.getDescription(i));
            }
        }
        var selected = {};
        var select_params = {
            inn: {
                list: list,
                window: shelveUtils.getWindow(doc_params),
                doc: shelveUtils.getDocument(doc_params),
                clip: shelve.getDocumentClip(doc_params),
                title: shelve.getDocumentTitle(doc_params),
                keywords: shelve.getDocumentKeywords(doc_params),
                mime: shelve.getDocumentMime(doc_params),
                mime_fix: doc_params.mime_fix || false,
                content_type: doc_params.content_type,
                autoPilot: shelve.autoPilot,
                shelves: shelves,
                shelfNos: shelfNos,
                shelve: this
            },
            sp_params: null
        };
        window.openDialog('chrome://shelve/content/selectShelf.xul', '',
            'chrome, dialog, modal, resizable=yes', select_params).focus();
        // shelveUtils.debug('getSavePageParams: select_params.sp_params=', select_params.sp_params);
        // shelveUtils.debug('getSavePageParams: onAutoPilot=', shelve.onAutoPilot());
        if (select_params.sp_params) {
            return select_params.sp_params;
        } else if (shelve.onAutoPilot()) {
            shelve.uninstallAutoShelve(true);
        }
        return null;
    },

    matchRx: function (shelfNo, url) {
        var rxs = shelveStore.get(shelfNo, 'rx', null);
        if (rxs && rxs.match(/\S/)) {
            var rx = new RegExp(rxs);
            if (url && url.match(rx)) {
                return true;
            }
        }
        return false;
    },

    matchStopRx: function (url, klass) {
        if (url) {
            var prefs_auto = shelve.getPrefs('auto.');
            var stop = shelve.getUnicharPref(prefs_auto, (klass || 'stop') + '_rx') || '';
            // shelveUtils.debug('shelve matchStopRx: url=', url);
            // shelveUtils.debug('shelve matchStopRx: klass=', klass);
            // shelveUtils.debug('shelve matchStopRx: stop=', stop);
            // shelveUtils.debug('shelve matchStopRx: match=', stop.match(/\S/) && url.match(new RegExp(stop)));
            var rv = stop.match(/\S/) && url.match(new RegExp(stop));
            // shelveUtils.debug('shelve matchStopRx: rv=', rv);
            return rv;
        } else {
            return false;
        }
    },

    getAutoshelfPref: function () {
        var prefs_auto = shelve.getPrefs('auto.');
        return shelve.getUnicharPref(prefs_auto, 'shelf');
    },

    setAutoshelfPref: function () {
        var prefs_auto = shelve.getPrefs('auto.');
        return shelve.setUnicharPref(prefs_auto, 'shelf', '--');
    },

    getPrefs: function (ns) {
        var prefs = Components.classes['@mozilla.org/preferences-service;1'].
        getService(Components.interfaces.nsIPrefService).getBranch('extensions.shelve.' + (ns || ''));
        return prefs;
    },

    getBoolPref: function (prefs, name, defaultValue) {
        if (prefs.getPrefType(name) == prefs.PREF_BOOL) {
            return prefs.getBoolPref(name);
        } else {
            return defaultValue;
        }
    },

    getIntPref: function (prefs, name, defaultValue) {
        if (prefs.getPrefType(name) == prefs.PREF_INT) {
            return prefs.getIntPref(name);
        } else {
            return defaultValue;
        }
    },

    getUnicharPref: function (prefs, name) {
        try {
            if (prefs.getPrefType(name)) {
                var val = prefs.getComplexValue(name, Components.interfaces.nsISupportsString);
                if (val) {
                    return val.data;
                }
            }
            return null;
        } catch (e) {
            throw (e);
        }
    },

    setUnicharPref: function (prefs, name, value) {
        var str = Components.classes['@mozilla.org/supports-string;1'].
        createInstance(Components.interfaces.nsISupportsString);
        str.data = value;
        prefs.setComplexValue(name, Components.interfaces.nsISupportsString, str);
    },

    footers: {},

    count: 0,

    addFooter: function (sp_params) {
        // shelveUtils.debug('shelve.addFooter: sp_params=', sp_params);
        try {
            var template = shelve.getFooterTemplate(sp_params);
            if (template && template.match(/\S/)) {
                shelve.count++;
                var id = shelve.count;
                shelve.footers[id] = {params: sp_params};
                shelve.delayedFooter(id);
            }
        } catch (ex) {
            shelveUtils.log('Error when preparing footer: ' + ex);
        }
    },

    delayedFooter: function (id) {
        // shelveUtils.debug('DelayedFooter:', id);
        if (id) {
            shelve.clearDelayedFooter(id);
            shelve.footers[id].timeoutID = setTimeout(function() {shelve.footer(id);}, 1000);
        }
    },

    clearDelayedFooter: function (id) {
        if (id) {
            var tid = shelve.footers[id].timeoutID;
            if (tid) {
                // shelveUtils.debug('clearDelayedFooter:', id);
                clearTimeout(tid);
                shelve.footers[id].timeoutID = null;
            }
        }
    },

    getFooterTemplate: function (sp_params) {
        var template_mime;
        switch (sp_params.mime) {
            case 'text':
            case 'text_latin1':
            template_mime = 'text';
            break;

            default:
            template_mime = 'html';
            break;
        }
        return shelve.param('footer_' + template_mime + sp_params.shelf, 'footer.', template_mime);
    },

    footer: function (id) {
        var sp_params = shelve.footers[id].params;
        // shelveUtils.debug('footer ' + id + ': sp_params=', sp_params);
        var file = shelveUtils.localFile(sp_params.filename);
        if (file === null) {
            return false;
        } else if (file.exists() && file.isWritable()) {
            var template = shelve.getFooterTemplate(sp_params);
            if (template && template.match(/\S/)) {
                var et_params = shelve.expandTemplateParams(sp_params, template);
                // shelveUtils.debug('footer et_params=', et_params);
                var text = shelveUtils.osString(shelve.expandTemplate(et_params));
                // var text = shelveUtils.asISupportsString(shelve.expandTemplate(et_params)).toString();

                // FIXME: Use the document's encoding
                shelveUtils.log('Appended footer to ' + sp_params.filename, 1);
                shelveUtils.writeTextFile(file, text);
                // shelveUtils.writeTextFile(file, text, 'UTF-8');
            }
            // shelveUtils.debug('delete footer', id);
            shelve.clearDelayedFooter(id);
            delete shelve.footers[id];
        } else {
            shelve.delayedFooter(id);
        }
        return true;
    },

    log: function (sp_params) {
        // shelveUtils.debug('log: sp_params=', sp_params);
        var shelf = sp_params.shelf;
        var log_file_template = shelve.log_param(shelf, 'file');
        if (shelveUtils.isSomeFilename(log_file_template)) {
            var log_filename_template = shelve.expandTemplateParams(sp_params, log_file_template);
            var log_filename = shelve.expandTemplate(log_filename_template);
            if (shelveUtils.isSomeFilename(log_filename)) {
                var template = shelve.log_param(shelf, 'template');
                if (template && template.match(/\S/)) {
                    // shelveUtils.debug('log template=', template);
                    var log_file = shelveUtils.localFile(log_filename);
                    var et_params = shelve.expandTemplateParams(sp_params, template);
                    et_params.log_file = log_file;
                    var log_entry = shelve.expandTemplate(et_params);
                    if (log_entry.match(/\S/)) {

                        // shelveUtils.debug('log log_entry=', log_entry);
                        log_entry = shelveUtils.osString(log_entry);

                        // shelveUtils.debug('log log file=', log_file.path);
                        // shelveUtils.debug('log log file exists=', log_file.exists());
                        if (!log_file.exists()) {
                            var log_template = shelve.getUnicharPref(shelve.getPrefs('log.file.'), 'template');
                            if (shelveUtils.isSomeFilename(log_template)) {
                                // shelveUtils.debug('log log file template=', log_template);
                                var log_head = shelveUtils.readText(log_template);
                                log_head = shelveUtils.osString(log_head);
                                log_entry = log_head + log_entry;
                            }
                        }

                        var log_enc = shelve.getUnicharPref(shelve.getPrefs('log.'), 'encoding');
                        // shelveUtils.debug('log: log_enc=', log_enc);
                        shelveUtils.log('Wrote log entry to ' + log_filename, 2);
                        shelveUtils.writeTextFile(log_file, log_entry, log_enc);
                    }
                }
            }
        }
    },

    log_param: function (shelf, name) {
        return shelve.param('log_' + name + shelf, 'log.', name);
    },

    param: function (local_name, namespace, global_name) {
        var val = shelveStore.get(null, local_name, null);
        if (!val) {
            var prefs = shelve.getPrefs(namespace);
            val = shelve.getUnicharPref(prefs, global_name);
        }
        return val;
    },

    notifyUser: function (title, text, sp_params) {
        // Log to error console
        shelveUtils.log(title + ': ' + text);
        var prefs_auto = shelve.getPrefs('auto.');
        if (shelve.getBoolPref(prefs_auto, 'notify_user', true)) {
            // Popup notification
            if (!sp_params.noAlertNotification) {
                try {
                    var alertsService = Components.classes['@mozilla.org/alerts-service;1'].
                    getService(Components.interfaces.nsIAlertsService);
                    // alertsService.showAlertNotification('chrome://mozapps/skin/downloads/downloadIcon.png', 
                    alertsService.showAlertNotification(
                        'chrome://shelve/content/shelve.png', 
                        'Shelve: ' + title, '' + text);
                } catch (e) {
                    // Alert failed
                    // nsIAlertsService not supported on Mac OSX?
                    shelveUtils.log('Error when notifying the user (nsIAlertsService not supported?): ' + e);
                }
                // alert(text);
            }
        }
    },

    frozenParams: function (sp_params) {
        if (!sp_params.url) {
            sp_params.url = shelveUtils.getDocumentURL(sp_params);
        }
        return sp_params;
    },

    expandTemplateParams: function (sp_params, template) {
        // shelveUtils.debug('expandTemplateParams sp_params:', sp_params);
        // shelveUtils.debug('expandTemplateParams template:', template);
        var et_params = {
            clip: sp_params.clip,
            extension: sp_params.extension,
            interactive: sp_params.interactive === undefined || sp_params.interactive,
            mime: sp_params.mime,
            mode: 'log',
            note: sp_params.note,
            output: sp_params.filename,
            parentWindow: window,
            shelve_name: shelveStore.get(sp_params.shelfNo, 'name'),
            template: template,
            title: sp_params.title,
            keywords: sp_params.keywords,
            shelve_content: sp_params.shelve_content,
            url: shelveUtils.getDocumentURL(sp_params)
        };
        return et_params;
    },

    expandTemplateNow: function (shelfId, template, doc_params) {
        // shelveUtils.debug('expandTemplateNow shelfId:', shelfId);
        // shelveUtils.debug('expandTemplateNow template:', template);
        // shelveUtils.debug('expandTemplateNow doc_params:', doc_params);
        var mime = shelve.getShelfMime(shelfId, doc_params);
        var et_params = {
            template: template,
            mime: mime,
            // interactive: doc_params.interactive === undefined || doc_params.interactive,
            interactive: true,
            title: shelve.getDocumentTitle(doc_params),
            clip: shelve.getDocumentClip(doc_params),
            url: shelveUtils.getDocumentURL(doc_params),
            shelve_content: doc_params.shelve_content,
            extension: shelveUtils.getExtension(doc_params, mime),
            parentWindow: window
        };
        // shelveUtils.debug('expandTemplateNow: et_params=', et_params);
        return shelve.expandTemplate(et_params);
    },

    expandTemplate: function (et_params) {
        // shelveUtils.debug('expandTemplate: et_params=', et_params);
        var max = et_params.template.length;
        var ch = '';
        var out = '';
        var state = 0;
        var val;
        var skip_sep = false;
        var line_start = 0;
        var width = null;
        for (var pos = 0; pos < max; pos++) {
            ch = et_params.template[pos];
            switch (state) {

                // scan
                case 0:
                if (ch == '%') {
                    state = 1;
                    // shelveUtils.debug('shelve expandTemplate: [pos, ch]=', [pos, et_params.template[pos]]);
                    /*jsl:ignore*/
                    [pos, width] = shelve.fieldWidth(et_params.template, pos);
                    /*jsl:end*/
                    // shelveUtils.debug('shelve expandTemplate: [pos, width, ch]=', [pos, width, et_params.template[pos]]);
                } else if (skip_sep && (ch == '\\' || ch == '/')) {
                    null;
                } else {
                    if (ch == '\n') {
                        line_start = out.length + 1;
                    }
                    out += ch;
                }
                skip_sep = false;
                break;

                // single placeholder
                case 1:
                /*jsl:ignore*/
                [state, pos, out, skip_sep] = shelve.processCharacter(0, 0, et_params, pos, ch, out, line_start, width);
                /*jsl:end*/
                break;

                // multiple placeholders
                case 2:
                /*jsl:ignore*/
                [state, pos, out, skip_sep] = shelve.processCharacter(3, 2, et_params, pos, ch, out, line_start, width);
                /*jsl:end*/
                break;

                // end of multiple placeholders
                case 3:
                switch (ch) {
                    case ']':
                    state = 0;
                    break;
                }
                break;

                // skip line
                case 4:
                if (ch == '\n') {
                    state = 0;
                }
                break;

            }
        }
        // shelveUtils.log('expandTemplate: "'+et_params.template+'" = "'+out+'"');
        return out;
    },

    processCharacter: function (success_state, fail_state, et_params, pos, ch, out, line_start, width) {
        /*jsl:ignore*/
        [pos, name, mode] = shelve.varName(et_params.template, pos, ch);
        // shelveUtils.debug('shelve processCharacter1: [pos, name, mode]=', [pos, name, mode]);
        [fail_state, val] = shelve.expandVar(out, fail_state, name, et_params, pos, width);
        // shelveUtils.debug('shelve processCharacter2: [fail_state, val]=', [fail_state, val]);
        [next_state, out, skip_sep] = shelve.processValue(success_state, fail_state, name, mode, val, out, line_start);
        // shelveUtils.debug('shelve processCharacter3: [next_state, out, skip_sep]=', [next_state, out, skip_sep]);
        /*jsl:end*/
        return [next_state, pos, out, skip_sep];
    },

    fieldWidth: function (template, pos0) {
        var max = template.length;
        var pos = pos0 + 1;
        if (pos < max && template[pos].match(/\d/)) {
            while (pos < max && template[pos].match(/\d/)) {
                pos++;
            }
            var ws = template.slice(pos0 + 1, pos);
            var width = parseInt(ws, 10);
            // shelveUtils.debug('shelve fieldWidth: [pos0, pos, ws, width]=', [pos0, pos, ws, width]);
            return [pos - 1, width];
        } else {
            return [pos0, null];
        }
    },

    varName: function (template, pos, ch) {
        switch (ch) {
            case '{':
            var max = template.length;
            var pos1 = pos;
            while (pos1 < max && template[pos1] != '}') {
                pos1++;
            }
            var name = template.slice(pos + 1, pos1);
            var mode = name.match(/[!?]$/);
            if (mode) {
                mode = mode[0];
                name = name.replace(/[!?]+$/, '');
            }
            // alert(name + ' ' + mode);
            return [pos1, name, mode];
            break;

            default:
            return [pos, ch, ''];
            break;
        }
    },

    processValue: function (success_state, fail_state, name, mode, value, out, line_start) {
        var skip_sep;
        var next_state;
        if (value === null || value === '') {
            next_state = fail_state;
            if (mode !== null) {
                if (mode.match(/!/)) {
                    var s_empty = shelveUtils.localized('missing');
                    alert(s_empty + ' ' + shelveUtils.localized('abort'));
                    throw s_empty;
                }
                if (mode.match(/\?/)) {
                    out = out.slice(0, line_start);
                    next_state = 4;
                }
            }
            skip_sep = next_state === 0 && out.match(/[\/\\]$/);
        } else {
            next_state = success_state;
            out += String(value);
            skip_sep = false;
        }
        return [next_state, out, skip_sep];
    },

    expandVarNames: {
        'c': 'clip',
        'C': 'Clip',
        'd': 'dirname',
        'D': 'date',
        'e': 'ext',
        'E': 'ext',
        'f': 'filename',
        'F': 'basename',
        'H': 'host',
        'B': 'hostbasename',
        'h': 'hours',
        'i': 'input',
        'I': 'subdir',
        'k': 'keywords',
        'l': 'msecs',
        'm': 'minutes',
        'M': 'month',
        'p': 'fullpath',
        'P': 'path',
        'q': 'query',
        's': 'secs',
        't': 'title',
        'x': 'clipboard',
        'Y': 'fullyear',
        'y': 'year',
        'n': 'note',
        'o': 'outfile',
        'O': 'relativeoutfile',
        'u': 'url',
        'v': 'shelf',
        '/': 'separator'
    },

    expandVar: function (out, fail_state, ch, et_params, pos, width) {
        var name = shelve.expandVarNames[ch] || ch;
        // shelveUtils.debug('shelve expandVar1: [ch, name, width]=', [ch, name, width]);
        var val = null;
        var is_not_last = pos < et_params.template.length - 1;
        // shelveUtils.debug('shelve expandVar1a: [pos, length, is_not_last]=', [pos, et_params.template.length, is_not_last]);
        var rawmode = (et_params.mode == 'log');
        switch (name) {

            case '[':
            val = null;
            fail_state = 2;
            break;

            case ']':
            val = null;
            fail_state = 0;
            break;

            case '%':
            val = ch;
            break;

            case 'clip': 
            // val = shelve.cleanValue(et_params.clip);
            val = et_params.clip;
            break;

            case 'Clip': 
            // val = shelve.cleanValue(et_params.clip);
            val = et_params.clip;
            if (et_params.interactive && !val.match(/\S/)) {
                var s_empty = shelveUtils.localized('empty.clip');
                alert(s_empty + ' ' + shelveUtils.localized('abort'));
                throw s_empty;
            }
            break;

            case 'clipboard':
            val = shelveUtils.getClipboard();
            break;

            case 'date':
            val = shelve.lpadString(new Date().getDate(), '00');
            break;

            case 'ext':
            if (ch === 'E') {
                alert(shelveUtils.localized('pct.e'));
            }
            val = shelve.maybeExtension(out, et_params.extension);
            break;

            case 'filename':
            val = shelve.getDocumentFilename(et_params, 2, is_not_last);
            break;

            case 'filenamei':
            val = shelve.getDocumentFilename(et_params, 2, false);
            rawmode = true;
            break;

            case 'basename':
            val = shelve.getDocumentFilename(et_params, 1, is_not_last);
            break;

            case 'basenamei':
            val = shelve.getDocumentFilename(et_params, 1, false);
            rawmode = true;
            break;

            case 'host':
            val = shelve.getDocumentHost(et_params, 0);
            break;

            case 'hostbasename':
            val = shelve.getDocumentHost(et_params, 1);
            break;

            case 'hours':
            val = shelve.lpadString(new Date().getHours(), '00');
            break;

            case 'input':
            // rawmode = true;
            val = et_params.interactive ? shelve.queryUser(et_params, 'Input', '') : '%i';
            break;

            case 'subdir':
            rawmode = true;
            val = et_params.interactive ? shelve.queryDirectory(et_params, out) : '%I';
            break;

            case 'keywords':
            val = shelve.getDocumentKeywords(et_params);
            break;

            case 'msecs':
            val = shelve.lpadString(new Date().getMilliseconds(), '000');
            break;

            case 'minutes':
            val = shelve.lpadString(new Date().getMinutes(), '00');
            break;

            case 'month':
            val = shelve.lpadString(new Date().getMonth() + 1, '00');
            break;

            case 'dirname':
            rawmode = true;
            val = shelve.getDocumentFilename(et_params, 5, true);
            break;

            // Shorten directory components that are too long, while keeping them unique
            case 'dirnameshorten':
            rawmode = true;
            val = shelve.getDocumentFilename(et_params, 5, true);
            var dirsep = shelveUtils.filenameSeparator();
            var dircomps = val.split(dirsep);
            var dirdepth = dircomps.length;
            for (var i=0; i < dirdepth; i++) {
                var d = dircomps[i];
                if (d.length > shelveUtils.MAXNAMELEN) {
                    var h = '_' + shelveUtils.hashstring(d, true).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                    dircomps[i] = d.substring(0, shelveUtils.MAXNAMELEN - h.length) + h;
                }
            }
            val = dircomps.join(dirsep);
            break;

            case 'fullpath':
            rawmode = true;
            val = shelve.getDocumentFilename(et_params, 3, is_not_last);
            break;

            case 'fullpathi':
            rawmode = true;
            val = shelve.getDocumentFilename(et_params, 3, false);
            break;

            case 'path':
            rawmode = true;
            val = shelve.getDocumentFilename(et_params, 4, is_not_last);
            break;

            case 'pathi':
            rawmode = true;
            val = shelve.getDocumentFilename(et_params, 4, false);
            break;

            case 'query':
            val = shelve.getDocumentUrlQuery(et_params);
            break;

            case 'queryq':
            rawmode = true;
            val = shelve.getDocumentUrlQuery(et_params);
            val = val ? '?' + val : val;
            break;

            case 'queryhash':
            val = shelve.getDocumentUrlQuery(et_params);
            val = (val) ? shelveUtils.hashstring(val, true).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') : val;
            break;

            case 'queryhashq':
            rawmode = true;
            val = shelve.getDocumentUrlQuery(et_params);
            val = (val) ? shelveUtils.hashstring(val, true).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') : val;
            val = val ? '?' + val : val;
            break;

            case 'secs':
            val = shelve.lpadString(new Date().getSeconds(), '00');
            break;

            case 'title':
            // val = shelve.cleanValue(et_params.title);
            val = et_params.title;
            break;

            case 'fullyear':
            val = new Date().getFullYear();
            break;

            case 'year':
            var yr = String(new Date().getYear());
            val = shelve.lpadString(yr.slice(yr.length - 2), '00');
            break;

            case 'shelvedir':
            val = shelveUtils.getShelveDir().path;
            rawmode = true;
            // shelveUtils.debug('shelve.expandVar val=', val);
            break;

            case 'separator':
            val = shelveUtils.filenameSeparator();
            rawmode = true;
            break;

            case 'archivefilename':
            var orig_tmpl = et_params.template;
            
            et_params.template = "%{queryhashq}:%e:%{filenamei}";
            var vars = shelve.expandTemplate(et_params).split(':');
            var qhash = vars[0], ext = vars[1], fname = vars.slice(2).join(':');
            
            val = qhash + ext;
            if ((fname + val).length > shelveUtils.MAXNAMELEN) {
                // chop filename to make it fit in MAXNAMELEN with having the qhash
                // and extension intact.
                var h = '_' + shelveUtils.hashstring(fname, true).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                fname = fname.substring(0, shelveUtils.MAXNAMELEN - h.length - val.length) + h;
            }
            val = fname + val;
            et_params.template = orig_tmpl;
            rawmode = true;
            break;


            // log mode
            case 'note':
            val = et_params.mode == 'log' ? shelve.getNote(et_params) : null;
            break;

            case 'outfile':
            val = et_params.mode == 'log' ? et_params.output : null;
            if (val == '-') {
                val = '';
            }
            break;

            case 'relativeoutfile':
            if (et_params.log_file) {
                var outfilename = et_params.mode == 'log' ? et_params.output : null;
                if (shelveUtils.isSomeFilename(outfilename)) {
                    var outfile = shelveUtils.localFile(outfilename);
                    var relfile = outfile.getRelativeDescriptor(et_params.log_file.parent);
                    val = shelveUtils.convertToUnicode(relfile);
                }
            }
            break;

            case 'url':
            val = et_params.mode == 'log' ? shelveUtils.getDocumentURL(et_params) : null;
            break;

            case 'content':
            val = et_params.mode == 'log' ? shelveUtils.unixString(et_params.shelve_content || '') : null;
            break;

            case 'shelf':
            val = et_params.mode == 'log' ? et_params.shelve_name : null;
            break;


            default:
            if (name.charAt(0) == '$') {
                var env = Components.classes['@mozilla.org/process/environment;1'].
                getService(Components.interfaces.nsIEnvironment);
                var vname = name.substr(1);
                // shelveUtils.debug('shelve.expandVar vname=', vname)
                // shelveUtils.debug('shelve.expandVar', env.exists(vname))
                if (env.exists(vname)) {
                    val = env.get(vname);
                    // } else {
                    //     val = null;
                }
            } else {
                // val = null;
                fail_state = 0;
                alert(shelveUtils.localized('unknown') + ': %' + ch);
            }

        }

        if (val) {
            // shelveUtils.debug('shelve expandVar2: [val, length]=', [val, val.length]);
            val = shelveDb.rewrite(name, shelveUtils.getDocumentURL(et_params), val);
            if (!rawmode) {
                val = shelve.cleanValue(val);
            }
            if (typeof(width) == 'number' && val.length > width) {
                val = val.substr(0, width);
            }
        }
        // shelveUtils.debug('shelve.expandVar return val=', val);

        return [fail_state, val];
    },

    cleanValue: function (value) {
        if (value === null) {
            return value;
        } else {
            // alert('IN: ' + value);
            value = String(value).replace(/[*|<>?:&\\\/"]/g, '_');
            // value = value.replace(/^\\.+/g, '_');
            value = value.replace(/[\r\n\t]+/g, ' ');
            value = value.replace(/^\s+/g, '');
            value = value.replace(/\s+$/g, '');
            value = value.replace(/\s\s+/g, ' ');
            // alert('OUT: ' + value);
            return value;
        }
    },

    lpadString: function (str, fill) {
        str = String(str);
        var pad = fill.slice(0, fill.length - str.length);
        return pad + str;
    },

    getNote: function (et_params) {
        if (et_params.note) {
            switch (et_params.mime) {
                case 'text':
                case 'text_latin1':
                return et_params.note;
                break;
                default:
                return shelveUtils.escapeHTML(et_params.note);
            }
        } else {
            return null;
        }
    },

    userDirectory: null,

    nsIFilePicker: Components.interfaces.nsIFilePicker,

    queryDirectory: function (et_params, cd) {
        if (et_params.userDirectory) {
            return et_params.userDirectory;
        } else {
            // http://developer.mozilla.org/en/docs/nsIFilePicker
            var fp = Components.classes['@mozilla.org/filepicker;1']
            .createInstance(shelve.nsIFilePicker);
            fp.init(et_params.parentWindow, shelveUtils.localized('select.subdir'), shelve.nsIFilePicker.modeGetFolder);
            var initDir = shelveUtils.localFile(cd);
            if (initDir === null) {
                return null;
            } else if (!initDir.exists()) {
                alert(shelveUtils.localized('dir.notexists') + ': ' + cd);
            } else if (!initDir.isDirectory()) {
                alert(shelveUtils.localized('dir.not') + ': ' + cd);
            } else {
                try {
                    if (shelveUtils.getOS() == 'WINNT') {
                        var directoryEntries = initDir.directoryEntries;
                        while (directoryEntries.hasMoreElements()) {
                            var firstEntry = directoryEntries.getNext();
                            firstFile = firstEntry.QueryInterface(Components.interfaces.nsIFile);
                            if (firstEntry.isDirectory()) {
                                initDir = firstFile;
                                break;
                            }
                        }
                    }
                    fp.displayDirectory = initDir;
                    // fp.appendFilters(shelve.nsIFilePicker.filterAll | shelve.nsIFilePicker.filterText);
                    var rv = fp.show();
                    if (rv == shelve.nsIFilePicker.returnOK || rv == shelve.nsIFilePicker.returnReplace) {
                        if (cd == fp.file.path.slice(0, cd.length)) {
                            // var file = fp.file.leafName;
                            var file = fp.file.path.slice(cd.length);
                            et_params.userDirectory = file;
                            shelve.userDirectory = file;
                            return file;
                        } else {
                            alert(shelveUtils.localized('dir.notsub'));
                            throw ('Shelve: Illegal user input: ' + rv);
                        }
                    }
                } catch (e) {
                    shelveUtils.log('Error when listing directory: ' + cd + ': ' + e);
                }
            }
            // return null;
            alert(shelveUtils.localized('cancel') + ' ' + shelveUtils.localized('abort'));
            throw ('Shelve: User cancelled');
        }
        return null;
    },

    userInput: null,

    queryUser: function (et_params, query, text) {
        if (et_params.userInput) {
            return et_params.userInput;
        } else {
            var prompts = Components.classes['@mozilla.org/embedcomp/prompt-service;1']
            .getService(Components.interfaces.nsIPromptService);
            var check = {};
            var input = {value: text};
            var result = prompts.prompt(window, 'Shelve', query, input, null, check);
            if (result) {
                et_params.userInput = input.value;
                shelve.userInput = input.value;
                return input.value;
            } else {
                return null;
            }
        }
    },

    maybeExtension: function (filename, extension) {
        // shelveUtils.debug('shelve maybeExtension filename=', filename);
        // shelveUtils.debug('shelve maybeExtension extension=', extension);
        // shelveUtils.debug('shelve maybeExtension slice pos=', ('' || extension).length);
        // shelveUtils.debug('shelve maybeExtension slice=', filename.slice(filename.length - ('' || extension).length));
        if (extension !== null && filename.slice(filename.length - extension.length) !== extension) {
            if (extension.match(/^\./) && filename.match(/\.$/)) {
                return extension.slice(1);
            } else {
                return extension;
            }
        } else {
            return null;
        }
    },

    getDocumentClip: function (doc_params) {
        if ('clip' in doc_params && doc_params.clip !== null) {
            return doc_params.clip;
        } else {
            var rv = shelve.getDocumentClipInWindow(getBrowser().contentWindow);
            if (rv === null || rv === undefined) {
                return null;
            } else {
                return rv;
            }
        }
    },

    getDocumentClipInWindow: function (win) {
        var sel = shelve.getSelectionString(win);
        if (!sel) {
            var frames = win.frames;
            var fi = 0;
            var frame;
            while (!sel && fi < frames.length) {
                frame = frames[fi];
                sel = shelve.getSelectionString(frame) || shelve.getDocumentClipInWindow(frame);
                fi++;
            }
            // shelveUtils.debug("shelve.getDocumentClipInWindow sel=", sel);
        }
        return sel;
    },

    getSelectionString: function (elt) {
        var selection = elt.getSelection();
        return selection && selection.toString();
    },

    getShelfMime: function (shelfId, doc_params) {
        return doc_params.mime || shelveStore.getMime(shelfId);
    },

    getDocumentMime: function (doc_params) {
        // shelveUtils.debug("shelve.getDocumentMime doc_params.mime=", doc_params.mime);
        // shelveUtils.debug("shelve.getDocumentMime doc_params.mime_fix=", doc_params.mime_fix);
        if (doc_params.mime !== null && doc_params.mime !== undefined) {
            return doc_params.mime;
        } else {
            var doctype = shelveUtils.getDocumentType(doc_params);
            // shelveUtils.debug("shelve.getDocumentMime doctype=", doctype);
            switch (doctype) {
                case 'text/html':
                case 'application/xhtml+xml':
                var prefs = shelve.getPrefs('');
                var mime = shelve.getUnicharPref(prefs, 'mime') || 'default';
                // shelveUtils.debug("shelve.getDocumentMime mime=", mime);
                return mime;

                case 'text/plain':
                return 'text';

                default:
                return 'binary';
            }
        }
    },

    getDocumentTitle: function (doc_params) {
        return doc_params.title || shelveUtils.getDocument(doc_params).title;
    },

    getDocumentKeywords: function (doc_params) {
        if (doc_params.keywords !== null && doc_params.keywords !== undefined) {
            return doc_params.keywords;
        } else {
            var keywords = [];
            var doc = shelveUtils.getDocument(doc_params);
            if (!doc.mockup) {
                var tags = doc.getElementsByName('keywords');
                // shelveUtils.debug('getDocumentKeywords tags:', tags);
                for (var i = 0, len = tags.length; i < len; i++) {
                    // shelveUtils.debug('getDocumentKeywords tags i:', i);
                    var content = tags[i].content;
                    // shelveUtils.debug('getDocumentKeywords tags content:', content);
                    if (content) {
                        // Canonic separator
                        if (content.indexOf(';') == -1) {
                            if (content.indexOf(',') != -1) {
                                content = content.replace(/\s*,\s*/g, '; ');
                            }
                        } else {
                            content = content.replace(/\s*;\s*/g, '; ');
                        }
                        keywords.push(content);
                    }
                }
            }
            return keywords.join('; ');
        }
    },

    getDocumentFilename: function (et_params, filenametype, is_not_last) {
        var url = shelveUtils.getDocumentURL(et_params);
        // remove protocol and domain at the beginning of the url
        var url_no_proto = url.replace(/^(\w+:\/\/)?[^\/]*\/?/, '');
        // remove hash or querystring
        var path = url_no_proto.replace(/[#?&].*$/, '');
        var pathcomps = path.split('/');
        // filename is the last path component
        var filename = pathcomps.pop();
        if (filename == "" && !is_not_last)
            filename = 'index';
        
        var fileext_rx = RegExp(/\.[^/.]*$/);
        switch (filenametype) {
            case 1: // basename
            file = filename.replace(fileext_rx, '');
            break;
            
            case 2: // filename
            file = filename;
            break;
            
            case 3: // fullpath
            pathcomps.push(filename);
            file = pathcomps.join('/');
            break;
            
            case 4: // fullpath excluding the extension
            file = shelve.getDocumentFilename(et_params, 3, is_not_last) + et_params.extension;
            file = file.replace(fileext_rx, '');
            break;
            
            case 5: // path of only directory components
            file = pathcomps.join('/');
            break;
        }
        file = String(file);
        if (shelveUtils.getOS() == 'WINNT') {
            file = file.replace(/\//g, '\\');
            file = file.replace(/[<>:"/|?*]/g, '_');
        }
        // shelveUtils.debug('shelve getDocumentFilename: [file, filenametype, is_not_last]=', [file, filenametype, is_not_last]);
        return file;
    },

    getDocumentHost: function (et_params, mode) {
        var host = shelveUtils.getDocumentURL(et_params).match(/^\w+:\/\/([^?\/]+)/);
        if (host) {
            host = host[1];
            switch (mode) {
                case 1:
                host = host.replace(/^(www|ftp)[^.]*\./, '');
                // host = host.replace(/\.(com|info|net|org|gov)$/, '');
                break;
            }
            return host;
        } else {
            return 'localhost';
        }
    },

    getDocumentUrlQuery: function (et_params) {
        var url = shelveUtils.getDocumentURL(et_params);
        var rest = url.match(/\?(.*)$/);
        return rest ? rest[1] : rest;
    }

};

