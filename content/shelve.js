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


var shelve = {

    withShelfName: function(name) {
        var shelfId = shelve.getShelfNumberByName(name);
        if (shelfId) {
            return shelve.withShelfNumber(shelfId);
        } else {
            return null;
        }
    },
    
    withShelfNumber: function(shelfId, doc_params) {
        // shelveUtils.debug("withShelfNumber shelfId=", shelfId);
        var sp_params = shelve.getSavePageToShelveParams(shelfId, doc_params || {});
        if (sp_params && shelve.savePageWithParams(sp_params)){
            // shelve.notifyUser("Shelved:", sp_params.filename);
            // shelve.notifyUser("", sp_params.filename, sp_params);
            return true;
        }
        return null;
    },

    savePage: function() {
        // if (shelve.onAutoPilot() == 1) {
        //     if (shelve.uninstallAutoShelve(false)) {
        //         shelve.notifyUser("Auto-save", "off", {});
        //     }
        // } else {
            try {
                var sp_params = shelve.getSavePageParams({});
                if (sp_params && sp_params.filename) {
                    shelve.savePageWithParams(sp_params);
                    if (sp_params.auto) {
                        // shelveUtils.debug("savePage: sp_params.interactive=", sp_params.interactive);
                        shelve.installAutoShelve(sp_params);
                    }
                }
            } catch(e) {
                // alert(e);
                throw('Shelve page: ' + e);
            }
        // }
    },

    saveSelection: function(doc) {
        try {
            var content = shelve.getDocumentClip({doc: doc});
            // shelveUtils.debug("shelve saveSelection: content=", content);
            var doc_params = {
                mime: "text",
                clip: ""
            };
            var sp_params = shelve.getSavePageParams(doc_params);
            sp_params.shelve_content = content;
            if (sp_params && sp_params.filename) {
                shelve.savePageWithParams(sp_params);
            }
        } catch(e) {
            throw('Shelve selection: ' + e);
        }
    },

    saveURL: function(type, url, title) {
        try {
            var doc_params = {
                url: url,
                content_type: type,
                // FIXME: doc = {} ok?
                doc: {
                    mockup: true,
                    documentURI: url,
                    URL: url,
                    //TODO: guess contentType
                    contentType: "",
                    title: title
                },
                title: "",
                // FIXME: getUrlMime()
                mime: "binary",
                keywords: ""
            };
            var sp_params = shelve.getSavePageParams(doc_params);
            if (sp_params && sp_params.filename) {
                shelve.savePageWithParams(sp_params);
            }
        } catch(e) {
            throw('Shelve URL ' + url + ': ' + e);
        }
    },

    savePageWithParams: function(sp_params) {
        var filename = sp_params.filename;
        if (shelve.shouldWriteFile(sp_params)) {
            if (filename) {
                // shelveUtils.debug("savePageWithParams filename=", filename);
                // http://developer.mozilla.org/en/docs/Code_snippets:Miscellaneous
                try {
                    var params_fix = shelve.frozenParams(sp_params);
                    if (filename != '-') {
                        var doc = shelve.getDocument(sp_params);
                        switch(doc.contentType) {
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
                        shelve.notifyUser(shelveUtils.localized("saved.as"), filename, params_fix);
                    }
                    shelve.log(params_fix);
                    return true;
                } catch(e) {
                    // alert(e);
                    throw('Shelve: Error when saving document: ' + e + " " + filename);
                }
            }
        } else {
            shelveUtils.log("Shelve: Do not (over)write file: "+ filename);
        }
        return false;
    },

    shouldWriteFile: function(sp_params) {
        // shelveUtils.debug("shouldWriteFile: sp_params=", sp_params);
        var filename = sp_params.filename;
        // shelveUtils.debug("shouldWriteFile: filename=", filename);
        var file = shelveUtils.localFile(filename);
        // shelveUtils.debug("shouldWriteFile: file.exists=", file.exists());
        if (file.exists()) {
            var shelfNo = sp_params.shelf;
            if (shelfNo) {
                var overwrite_files = shelveStore.getBool(null, "overwrite_files", 1);
                // shelveUtils.debug("shouldWriteFile: overwrite_files=", overwrite_files);
                var overwrite = shelveStore.get(shelfNo, 'overwrite', overwrite_files);
                // shelveUtils.debug("shouldWriteFile: overwrite=", overwrite);
                if (overwrite === 2) {
                    var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
                    getService(Components.interfaces.nsIPromptService);
                    // TODO: Localization
                    var result = prompts.confirm(window, "File already exists", "Overwrite file?");
                    // shelveUtils.debug("shelve.shouldWriteFile result=", result);
                    if (result) {
                        overwrite = 1;
                    }
                }
                return overwrite === 1;
            } else {
                shelveUtils.log("shouldWriteFile: Unknown shelfNo: Please report");
            }
        }
        return true;
    },

    saveDocument: function(doc, filename, sp_params) {
        // shelveUtils.debug("shelve saveDocument: sp_params=", sp_params);
        // shelveUtils.debug("shelve saveDocument: filename=", filename);
        var file = shelveUtils.localFile(filename);
        var dataname = filename.replace(/\.\w+$/, '_files');
        // shelveUtils.debug("shelve saveDocument: dataname=", dataname);
        var dir = file.parent;
        if (!dir.exists()) {
            /*jsl:ignore*/
            dir.create(dir.DIRECTORY_TYPE, 0755);
            /*jsl:end*/
        }

        var data = null;
        var mime = null;
        var encode = null;
        var wbp = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].
        createInstance(Components.interfaces.nsIWebBrowserPersist);
        // wbp.persistFlags |= wbp.PERSIST_FLAGS_FROM_CACHE;
        wbp.persistFlags |= wbp.PERSIST_FLAGS_FROM_CACHE | wbp.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
        switch(sp_params.mime) {
            case 'text':
            mime = 'text/plain';
            encode = wbp.ENCODE_FLAGS_FORMATTED |
            wbp.ENCODE_FLAGS_ABSOLUTE_LINKS |
            wbp.ENCODE_FLAGS_NOFRAMES_CONTENT;
            break;

            case 'text_latin1':
            mime = 'text/plain';
            encode = wbp.ENCODE_FLAGS_FORMATTED |
            wbp.ENCODE_FLAGS_ABSOLUTE_LINKS;
            // | wbp.ENCODE_FLAGS_NOFRAMES_CONTENT;
            break;

            case 'html':
            mime = 'text/html';
            encode = wbp.ENCODE_FLAGS_RAW;
            break;

            case 'webpage':
            mime = 'text/html';
            encode = wbp.ENCODE_FLAGS_RAW;
            /*jsl:fallthru*/

            default:
            data = shelveUtils.localFile(dataname);
            // alert(data);
            // alert(dataname);
            break;
        }
        // shelveUtils.debug("shelve saveDocument: mime=", mime);
        // shelveUtils.debug("shelve saveDocument: encode=", encode);
        shelve.addFooter(sp_params);
        var uri = shelveUtils.newURI(sp_params.url);
        var file_uri = shelveUtils.newFileURI(file);
        shelve.registerDownload("document", sp_params, wbp, uri, file_uri);
        try {
            wbp.saveDocument(doc, file, data, mime, encode, null);
        } catch(exception) {
            // alert(shelveUtils.localized("error.saving")+": "+ filename);
            shelve.notifyUser(shelveUtils.localized("error.saving"), filename, sp_params);
        }
    },

    saveBinary: function(doc, filename, sp_params) {
        var uri = shelveUtils.newURI(sp_params.url);

        // filename = filename.replace(/\\\\+/g, '\\');
        var file = shelveUtils.localFile(filename);
        if(!file.exists()) {
            /*jsl:ignore*/
            file.create(0x00,0644);
            /*jsl:end*/
        }
        var file_uri = shelveUtils.newFileURI(file); 

        var wbp = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].
        createInstance(Components.interfaces.nsIWebBrowserPersist);
        wbp.persistFlags |= wbp.PERSIST_FLAGS_FROM_CACHE;
        wbp.persistFlags &= ~wbp.PERSIST_FLAGS_NO_CONVERSION;
        shelve.registerDownload("binary", sp_params, wbp, uri, file_uri);
        wbp.saveURI(uri, null, null, null, null, file_uri);
        // cachekey = shelveUtils.asISupportsString(sp_params.url);
        // wbp.saveURI(uri, cachekey, null, null, null, file);
    },

    saveText: function(text, filename, sp_params) {
        // shelveUtils.debug('shelve saveText: filename=', filename);
        // shelveUtils.debug('shelve saveText: text=', text);
        var file = shelveUtils.localFile(filename);
        if(!file.exists()) {
            file.create(0x00, 0644);
        }

        var text_enc = shelve.getUnicharPref(shelve.getPrefs('text.'), 'encoding');
        // shelveUtils.debug('shelve saveText: text_enc=', text_enc);
        shelveUtils.writeTextFile(file, text, text_enc, 0x02 | 0x08 | 0x20);
        
        shelve.addFooter(sp_params);
    },

    registerDownload: function(mode, sp_params, persist, uri, file_uri) {
         var prefs_dlm = shelve.getPrefs("use_download_manager.");
         if (!sp_params.noAlertNotification && shelve.getBoolPref(prefs_dlm, mode) && !shelveUtils.appInfo().match(/^Firefox2/)) {
             // var dm = Components.classes["@mozilla.org/download-manager;1"].
             // getService(Components.interfaces.nsIDownloadManager);
             // var dl = dm.addDownload(0, uri, file_uri, "", null, null, null, persist);
             // persist.progressListener = dl;
            var tr = Components.classes["@mozilla.org/transfer;1"].
            createInstance(Components.interfaces.nsITransfer);
            tr.init(uri, file_uri, "", null, null, null, persist);
            persist.progressListener = new DownloadListener(window, tr);
            // dm.addListener(dl);
        }
    },

    hotkeys: {},

    hotkeysInstalled: false,

    installHotkeyListener: function() {
        if (!shelve.hotkeysInstalled) {
            window.addEventListener("keypress", shelve.onKeypressListener, true);
            shelve.hotkeysInstalled = true;
            // shelveUtils.log('Installed hotkey handler');
        }
    },

    uninstallHotkeyListener: function() {
        if (shelve.hotkeysInstalled) {
            window.removeEventListener("keypress", shelve.onKeypressListener, true);
            shelve.hotkeysInstalled = false;
            // shelveUtils.log('Uninstalled hotkey handler');
        }
    },

    restoreCount: 0,

    setupAutoshelf: function() {
        var autoshelf = shelve.getAutoshelf();
        if (autoshelf) {
            // shelveUtils.debug("setupAutoshelf: autoshelf=", autoshelf);
            var shelfId = shelve.getShelfNumberByName(autoshelf);
            if (shelfId) {
                var sp_params = shelve.getSavePageToShelveParams(shelfId, {});
                // shelveUtils.debug("setupAutoshelf: sp_params=", sp_params);
                sp_params.noAlertNotification = true;
                sp_params.interactive = false;
                shelve.installAutoShelve(sp_params);
                shelveUtils.log('Installed autoshelf: ' + autoshelf);
                shelve.restoreCount = 0;
                document.addEventListener("SSTabRestoring", shelve.autoDisableWhileRestoring, false);
                document.addEventListener("SSTabRestored", shelve.autoReEnableWhileRestoring, false);
            } else {
                shelveUtils.log('Unknown autoshelf: ' + autoshelf);
            }
        }
    },

    autoselect: false,

    setupAutoSelect: function() {
        if (!shelve.autoselect) {
            var max = shelveStore.max();
            for (var i = 1; i <= max; i++) {
                var autoselect = shelveStore.get(i, 'autoselect', null);
                if (autoselect) {
                    window.addEventListener("DOMContentLoaded", shelve.autoSelectShelve, true);
                    shelve.autoselect = true;
                    // shelveUtils.debug("setupAutoSelect autoselect=", shelveUtils.autoselect);
                    break;
                }
            }
        }
    },

    getAutoshelf: function() {
        var autoshelf = shelve.getAutoshelfPref();
        return autoshelf == "--" ? null : autoshelf;
    },

    autoDisableWhileRestoring: function() {
        // shelve.autoPilot = false;
        // shelve.restoreCount++;
    },

    autoReEnableWhileRestoring: function() {
        // shelve.restoreCount--;
        // if (shelve.restoreCount === 0) {
        //     shelve.autoPilot = true;
        //     // alert("autoReEnableWhileRestoring:"+ shelve.autoPilot);
        // }
    },

    setupHotkeys: function() {
        // global hotkey
        var prefs_hotkey = shelve.getPrefs("hotkey.");
        var kc = shelve.getUnicharPref(prefs_hotkey, 'keycode');
        if (kc && kc.match(/\S/)) {
            document.getElementById("key_shelve").setAttribute('keycode', 'VK_' + kc);
            var kt = shelve.getUnicharPref(prefs_hotkey, 'keytext');
            if (kt) {
                document.getElementById("key_shelve").setAttribute('keytext', kt);
            }
            var mod = [];
            if (shelve.getBoolPref(prefs_hotkey, 'alt')) {
                mod.push('alt');
            }
            if (shelve.getBoolPref(prefs_hotkey, 'ctrl')) {
                mod.push('control');
            }
            if (shelve.getBoolPref(prefs_hotkey, 'shift')) {
                mod.push('shift');
            }
            if (shelve.getBoolPref(prefs_hotkey, 'meta')) {
                mod.push('meta');
            }
            if (mod.length > 0) {
                mod = mod.join(' ');
                document.getElementById("key_shelve").setAttribute('modifiers', mod);
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

    setupPopup: function() {
        var contextMenu = document.getElementById("contentAreaContextMenu");
        if (contextMenu) {
            contextMenu.addEventListener("popupshowing", shelve.showHidePopupItems, false);
        }
    },

    showHidePopupItems: function(ev) {
        document.getElementById("context-shelve-url").hidden = true;
        document.getElementById("context-shelve-image").hidden = true;
        document.getElementById("context-shelve-selection").hidden = true;
        if (gContextMenu.onImage) {
            document.getElementById("context-shelve-image").hidden = false;
        }
        if (gContextMenu.onLink && !shelve.matchStopRx(gContextMenu.linkURL, "blacklist")) {
            document.getElementById("context-shelve-url").hidden = false;
        }
        if (gContextMenu.isTextSelected) {
            document.getElementById("context-shelve-selection").hidden = false;
        }
    },

    registerHotkeyForShelf: function(name, hotkeyDef) {
        shelve.hotkeys[name] = hotkeyDef;
        shelve.installHotkeyListener();
    },

    removeHotkeyForShelf: function(name) {
        if (shelve.hotkeys[name]) {
            delete shelve.hotkeys[name];
        }
    },

    onKeypressListener: function(ev) {
        var hkn = 0;
        for (var hk in shelve.hotkeys) {
            hkn++;
            var hkd = shelve.hotkeys[hk];
            // alert("onKeypressListener: "+ hk + hkd.hotkey + ev["DOM_VK_"+ hkd.hotkey] + hkd.alt + hkd.ctrl + hkd.shift + hkd.meta);
            // alert("onKeypressListener: "+ hk + hkd.hotkey + ev["DOM_VK_"+ hkd.hotkey] + ev.altKey + ev.ctrlKey + ev.shiftKey + ev.metaKey);
            // // alert(ev.keyCode + String(ev.altKey) + String(ev.ctrlKey) + String(ev.shiftKey) + String(ev.metaKey));
            // alert(String(ev.keyCode) + ev.altKey + ev.ctrlKey + ev.shiftKey + ev.metaKey);
            // alert(String(ev.keyCode == ev["DOM_VK_"+ hkd.hotkey])
            // + String(ev.altKey == hkd.alt)
            // + String(ev.ctrlKey == hkd.ctrl)
            // + String(ev.shiftKey == hkd.shift)
            // + String(ev.metaKey == hkd.meta));
            if (ev.keyCode == ev["DOM_VK_"+ hkd.hotkey] && 
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

    onAutoPilot: function() {
        if (shelve.autoPilot && shelve.autoPageParams) {
            return shelve.autoPageParams.interactive === true ? 1 : 2;
        } else {
            return 0;
        }
    },

    installAutoShelve: function(sp_params) {
        // shelveUtils.debug("installAutoShelve: sp_params=", sp_params);
        // http://developer.mozilla.org/en/docs/Code_snippets:Tabbed_browser#Detecting_page_load
        // http://developer.mozilla.org/en/docs/Code_snippets:On_page_load
        if (sp_params) {
            sp_params.doc = null;
            shelve.autoPageParams = shelveUtils.clone(sp_params);
        }
        if (shelve.autoPageParams) {
            // shelveUtils.assert(!sp_params.shelf, false, "sp_params.shelf is not empty");
            shelve.autoPilot = sp_params.shelf;
            shelve.autoFileParams = {
                template: shelve.autoPageParams.template,
                interactive: true,
                mime: shelve.autoPageParams.mime,
                extension: shelve.autoPageParams.extension,
                userInput: shelve.userInput,
                userDirectory: shelve.userDirectory
            };
            shelve.setToolbarButton(true);
            window.addEventListener("DOMContentLoaded", shelve.autoShelve, true);
        }
    },

    uninstallAutoShelve: function(stop) {
        // shelveUtils.debug("uninstallAutoShelve: shelve.autoPageParams.interactive=", shelve.autoPageParams.interactive);
        if (shelve.autoPageParams) {
            shelve.autoPilot = null;
            shelve.autoFileParams = null;
            shelve.autoPageParams = null;
            shelve.setToolbarButton(false);
            window.removeEventListener("DOMContentLoaded", shelve.autoShelve, true);
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

    setToolbarButton: function(value) {
        var tbb = document.getElementById("shelve-toolbar-button");
        if (tbb) {
            tbb.checked = value;
        }
    },

    autoSelectShelve: function(dclevent) {
        // shelveUtils.debug("autoSelectShelve dclevent=", dclevent);
        var doc_params = {doc: dclevent.originalTarget};
        var url = shelve.getDocumentURL(doc_params);
        // shelveUtils.debug("autoSelectShelve url=", url);
        if (!shelve.matchStopRx(url, "blacklist")) {
            // shelveUtils.debug("autoSelectShelve match stop_rx=", false);
            var max = shelveStore.max();
            for (var i = 1; i <= max; i++) {
                var autoselect = shelveStore.get(i, 'autoselect', null);
                // shelveUtils.debug("autoSelectShelve shelfNo=", i);
                // shelveUtils.debug("autoSelectShelve autoselect=", autoselect);
                if (autoselect) {
                    if (shelve.matchRx(i, url)) {
                        // shelveUtils.debug("autoSelectShelve match rx=", true);
                        shelve.withShelfNumber(i, doc_params);
                    }
                    break;
                }
            }
        }
    },

    autoShelve: function(dclevent) {
        if (shelve.autoPageParams) {
            if (shelve.autoPilot && dclevent.originalTarget instanceof HTMLDocument) {
                var doc = dclevent.originalTarget;
                // if (event.originalTarget.defaultView.frameElement) {
                //     // Frame within a tab was loaded. doc should be the root document of
                //     // the frameset. If you don't want do anything when frames/iframes
                //     // are loaded in this web page, uncomment the following line:
                //     // return;
                //     // Find the root document:
                //     while (doc.defaultView.frameElement) {
                //         doc = doc.defaultView.frameElement.ownerDocument;
                //     }
                // }

                try {
                    if (!shelve.matchStopRx(doc.URL)) {
                        // shelveUtils.debug("autoFileParams: ", shelve.autoFileParams);
                        var afp   = shelveUtils.clone(shelve.autoFileParams);
                        // shelveUtils.debug("afp0: ", afp);
                        afp.doc   = doc;
                        afp.title = doc.title;
                        afp.url   = doc.URL;
                        afp.clip  = '';
                        afp.parentWindow = window;
                        // shelveUtils.debug("afp1: ", afp);
                        var filename = shelve.expandTemplate(afp);
                        // shelveUtils.debug("filename: ", filename);
                        if (filename) {
                            var file = shelveUtils.localFile(filename);
                            if (filename == '-' || (file && !file.exists())) {
                                // shelveUtils.debug("autoPageParams: ", shelve.autoPageParams);
                                var app = shelveUtils.clone(shelve.autoPageParams);
                                // shelveUtils.debug("app0: ", app);
                                app.filename = filename;
                                app.doc = doc;
                                app.title = doc.title;
                                app.url = doc.URL;
                                // shelveUtils.debug("app1: ", app);
                                shelve.savePageWithParams(app);
                                // if (shelve.savePageWithParams(app)) {
                                //     shelve.notifyUser("Auto-saved as", filename, app);
                                // }
                            }
                        }
                    }
                } catch(e) {
                    // alert(e);
                    throw('Shelve (autoShelve): ' + e);
                }
            }
        } else {
            shelve.uninstallAutoShelve(true);
        }
    },

    getShelfNumberByName: function(name) {
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

    getSavePageToShelveParams: function(shelfId, doc_params) {
        // shelveUtils.debug("getSavePageToShelveParams: doc_params=", doc_params);
        var template = shelveStore.get(shelfId, 'dir');
        var mime = shelve.getShelfMime(shelfId, doc_params);
        var filename = shelve.expandTemplateNow(shelfId, template, doc_params);
        if (filename) {
            var sp_params = {
                filename: filename,
                mime: mime,
                shelf: shelfId,
                template: template,
                extension: shelveUtils.getExtension(doc_params.type, mime, shelve.getDocument(doc_params)),
                title: shelve.getDocumentTitle(doc_params),
                clip: shelve.getDocumentClip(doc_params),
                content_type: doc_params.content_type,
                auto: false
            };
            if (doc_params.doc) {
                sp_params.doc = doc_params.doc;
            }
            if (doc_params.keywords) {
                sp_params.keywords = doc_params.keywords;
            }
            if (doc_params.url) {
                sp_params.url = doc_params.url;
            }
            return sp_params;
        }
        return null;
    },

    getSavePageParams: function(doc_params) {
        var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
        getService(Components.interfaces.nsIPromptService);

        var list = [];
        var shelves = [];
        var shelfNos = [];
        var template;
        var max = shelveStore.max();
        var url = shelve.getDocumentURL(doc_params);
        for (var i = 1; i <= max; i++) {
            // shelveUtils.debug("shelve.getSavePageParams i=", i);
            template = shelveStore.get(i, 'dir', null);
            if (template && template.match(/\S/)) {
                if (template.match(/[*|<>&?"]/)) {
                    alert(shelveUtils.localized("malformed_template") + ": " + template);
                    template = shelve.cleanValue(template);
                }
                if (shelve.matchRx(i, url)) {
                    var spp = shelve.getSavePageToShelveParams(i, doc_params);
                    // shelve.notifyUser(shelveUtils.localized("saved.as") + ":", spp.filename, spp);
                    return spp;
                }
                // shelveUtils.debug("shelve.getSavePageParams template=", template);
                shelves.push(template);
                shelfNos.push(i);
                list.push(shelveStore.getDescription(i));
            }
        }
        var selected = {};
        var select_params = {
            inn: {
                list: list,
                doc: shelve.getDocument(doc_params),
                clip: shelve.getDocumentClip(doc_params),
                title: shelve.getDocumentTitle(doc_params),
                mime: shelve.getDocumentMime(doc_params),
                content_type: doc_params.content_type,

                autoPilot: shelve.autoPilot,

                shelves: shelves,
                shelfNos: shelfNos,
                shelve: this
            },
            sp_params: null
        };
        window.openDialog("chrome://shelve/content/selectShelf.xul", "",
        "chrome, dialog, modal, resizable=yes", select_params).focus();
        // shelveUtils.debug("getSavePageParams: select_params.sp_params=", select_params.sp_params);
        // shelveUtils.debug("getSavePageParams: onAutoPilot=", shelve.onAutoPilot());
        if (select_params.sp_params) {
            return select_params.sp_params;
        } else if (shelve.onAutoPilot()) {
            shelve.uninstallAutoShelve(true);
        }
        return null;
    },

    matchRx: function(shelfNo, url) {
        var rxs = shelveStore.get(shelfNo, 'rx', null);
        if (rxs && rxs.match(/\S/)) {
            var rx = new RegExp(rxs);
            if (url && url.match(rx)) {
                return true;
            }
        }
        return false;
    },

    matchStopRx: function(url, klass) {
        if (url) {
            var prefs_auto = shelve.getPrefs("auto.");
            var stop = shelve.getUnicharPref(prefs_auto, (klass || 'stop') + '_rx') || '';
            // shelveUtils.debug('shelve matchStopRx: url=', url);
            // shelveUtils.debug('shelve matchStopRx: klass=', klass);
            // shelveUtils.debug('shelve matchStopRx: stop=', stop);
            // shelveUtils.debug('shelve matchStopRx: match=', stop.match(/\S/) && url.match(new RegExp(stop)));
            return stop.match(/\S/) && url.match(new RegExp(stop));
        } else {
            return false;
        }
    },

    getAutoshelfPref: function() {
        var prefs_auto = shelve.getPrefs("auto.");
        return shelve.getUnicharPref(prefs_auto, 'shelf');
    },

    setAutoshelfPref: function() {
        var prefs_auto = shelve.getPrefs("auto.");
        return shelve.setUnicharPref(prefs_auto, 'shelf', '--');
    },

    getPrefs: function(ns) {
        var prefs = Components.classes["@mozilla.org/preferences-service;1"].
        getService(Components.interfaces.nsIPrefService).getBranch("extensions.shelve." + (ns || ""));
        return prefs;
    },

    getBoolPref: function(prefs, name, defaultValue) {
        if (prefs.getPrefType(name) == prefs.PREF_BOOL) {
            return prefs.getBoolPref(name);
        } else {
            return defaultValue;
        }
    },

    getIntPref: function(prefs, name, defaultValue) {
        if (prefs.getPrefType(name) == prefs.PREF_INT) {
            return prefs.getIntPref(name);
        } else {
            return defaultValue;
        }
    },

    getUnicharPref: function(prefs, name) {
        try {
            if (prefs.getPrefType(name)) {
                var val = prefs.getComplexValue(name, Components.interfaces.nsISupportsString);
                if (val) {
                    return val.data;
                }
            }
            return null;
        } catch(e) {
            throw(e);
        }
    },

    setUnicharPref: function(prefs, name, value) {
        var str = Components.classes["@mozilla.org/supports-string;1"].
        createInstance(Components.interfaces.nsISupportsString);
        str.data = value;
        prefs.setComplexValue(name, Components.interfaces.nsISupportsString, str);
    },

    footers: {},
    
    count: 0,

    addFooter: function(sp_params) {
        try {
            var template = shelve.getFooterTemplate(sp_params);
            if (template && template.match(/\S/)) {
                shelve.count++;
                var id = shelve.count;
                shelve.footers[id] = sp_params;
                shelve.delayedFooter(id);
            }
        } catch (ex) {
            shelveUtils.log('Error when preparing footer: ' + ex);
        }
    },

    delayedFooter: function(id) {
        // setTimeout('shelve.footer('+ id +')', 1000);
        // setTimeout(function(id) {shelve.footer(id)}, 1000, id);
        setTimeout(function() {shelve.footer(id);}, 1000);
    },

    getFooterTemplate: function(sp_params) {
        var template_mime;
        switch(sp_params.mime) {
            case "text":
            case "text_latin1":
            template_mime = "text";
            break;

            default:
            template_mime = "html";
            break;
        }
        return shelve.param('footer_'+ template_mime + sp_params.shelf, 'footer.', template_mime);
    },

    footer: function(id) {
        var sp_params = shelve.footers[id];
        // shelveUtils.debug("footer "+ id +": sp_params=", sp_params);
        var file = shelveUtils.localFile(sp_params.filename);
        if (file.exists() && file.isWritable()) {
            var template = shelve.getFooterTemplate(sp_params);
            if (template && template.match(/\S/)) {
                var et_params = shelve.expandTemplateParams(sp_params, template);
                // shelveUtils.debug("footer et_params=", et_params);
                var text = shelveUtils.osString(shelve.expandTemplate(et_params));
                // var text = shelveUtils.asISupportsString(shelve.expandTemplate(et_params)).toString();

                // FIXME: Use the document's encoding
                shelveUtils.writeTextFile(file, text);
                // shelveUtils.writeTextFile(file, text, 'UTF-8');
            }
            delete shelve.footers[id];
        } else {
            shelve.delayedFooter(id);
        }
    },

    log: function(sp_params) {
        // shelveUtils.debug("log: sp_params=", sp_params);
        var shelf = sp_params.shelf;
        var log_file_template = shelve.log_param(shelf, 'file');
        if (shelveUtils.isSomeFilename(log_file_template)) {
            var log_file = shelve.expandTemplateParams(sp_params, log_file_template);
            var log = shelve.expandTemplate(log_file);
            if (shelveUtils.isSomeFilename(log)) {
                var template = shelve.log_param(shelf, 'template');
                if (template && template.match(/\S/)) {
                    // shelveUtils.debug("log template=", template);
                    var et_params = shelve.expandTemplateParams(sp_params, template);
                    var log_entry = shelve.expandTemplate(et_params);
                    if (log_entry.match(/\S/)) {

                        // shelveUtils.debug("log log_entry=", log_entry);
                        log_entry = shelveUtils.osString(log_entry);

                        var log_enc = shelve.getUnicharPref(shelve.getPrefs('log.'), 'encoding');
                        // shelveUtils.debug("log: log_enc=", log_enc);
                        shelveUtils.writeTextFile(shelveUtils.localFile(log), log_entry, log_enc);
                    }
                }
            }
        }
    },

    log_param: function(shelf, name) {
        return shelve.param('log_' + name + shelf, 'log.', name);
    },

    param: function(local_name, namespace, global_name) {
        var val = shelveStore.get(null, local_name, null);
        if (!val) {
            var prefs = shelve.getPrefs(namespace);
            val = shelve.getUnicharPref(prefs, global_name);
        }
        return val;
    },

    notifyUser: function(title, text, sp_params) {
        // Log to error console
        shelveUtils.log(title + ': ' + text);
        var prefs_auto = shelve.getPrefs("auto.");
        if (shelve.getBoolPref(prefs_auto, 'notify_user', true)) {
            // Popup notification
            if (!sp_params.noAlertNotification) {
                try {
                    var alertsService = Components.classes["@mozilla.org/alerts-service;1"].
                    getService(Components.interfaces.nsIAlertsService);
                    // alertsService.showAlertNotification("chrome://mozapps/skin/downloads/downloadIcon.png", 
                    alertsService.showAlertNotification("chrome://shelve/content/shelve.png", 
                    "Shelve: " + title, text, false, "", null);
                } catch (e) {
                    // Alert failed
                    // nsIAlertsService not supported on Mac OSX?
                    shelveUtils.log('Error when notifying the user (nsIAlertsService not supported?): ' + e);
                }
                // alert(text);
            }
        }
    },

    frozenParams: function(sp_params) {
        if (!sp_params.url) {
            sp_params.url = shelve.getDocumentURL(sp_params);
        }
        return sp_params;
    },

    expandTemplateParams: function(sp_params, template) {
        var et_params = {
            clip: sp_params.clip,
            extension: sp_params.extension,
            interactive: sp_params.interactive === undefined || sp_params.interactive,
            mime: sp_params.mime,
            mode: "log",
            note: sp_params.note,
            output: sp_params.filename,
            parentWindow: window,
            shelve_name: shelveStore.get(sp_params.shelfNo, 'name'),
            template: template,
            title: sp_params.title,
            shelve_content: sp_params.shelve_content,
            url: shelve.getDocumentURL(sp_params)
        };
        return et_params;
    },

    expandTemplateNow: function(shelfId, template, doc_params) {
        var mime = shelve.getShelfMime(shelfId, doc_params);
        var et_params = {
            template: template,
            mime: mime,
            // interactive: doc_params.interactive === undefined || doc_params.interactive,
            interactive: true,
            title: shelve.getDocumentTitle(doc_params),
            clip: shelve.getDocumentClip(doc_params),
            url: shelve.getDocumentURL(doc_params),
            shelve_content: doc_params.shelve_content,
            extension: shelveUtils.getExtension(doc_params.type, mime, shelve.getDocument(doc_params)),
            parentWindow: window
        };
        // shelveUtils.debug("expandTemplateNow: et_params=", et_params);
        return shelve.expandTemplate(et_params);
    },

    expandTemplate: function(et_params) {
        // shelveUtils.debug("expandTemplate: et_params=", et_params);
        var max = et_params.template.length;
        var ch = "";
        var out = "";
        var state = 0;
        var val;
        var skip_sep = false;
        var line_start = 0;
        for (var pos = 0; pos < max; pos++) {
            ch = et_params.template[pos];
            switch(state) {

                // scan
                case 0:
                if (ch == '%') {
                    state = 1;
                } else if (skip_sep && (ch == "\\" || ch == "/")) {
                    null;
                } else {
                    if (ch == "\n") {
                        line_start = out.length + 1;
                    }
                    out += ch;
                }
                skip_sep = false;
                break;

                // single placeholder
                case 1:
                /*jsl:ignore*/
                [state, pos, out, skip_sep] = shelve.processCharacter(0, 0, et_params, pos, ch, out, line_start);
                /*jsl:end*/
                break;

                // multiple placeholders
                case 2:
                /*jsl:ignore*/
                [state, pos, out, skip_sep] = shelve.processCharacter(3, 2, et_params, pos, ch, out, line_start);
                /*jsl:end*/
                break;

                // end of multiple placeholders
                case 3:
                switch(ch) {
                    case ']':
                    state = 0;
                    break;
                }
                break;

                // skip line
                case 4:
                if (ch == "\n") {
                    state = 0;
                }
                break;

            }
        }
        return out;
    },

    processCharacter: function(success_state, fail_state, et_params, pos, ch, out, line_start) {
        /*jsl:ignore*/
        [pos, name, mode] = shelve.varName(et_params.template, pos, ch);
        [fail_state, val] = shelve.expandVar(out, fail_state, name, et_params);
        [next_state, out, skip_sep] = shelve.processValue(success_state, fail_state, name, mode, val, out, line_start);
        /*jsl:end*/
        return [next_state, pos, out, skip_sep];
    },

    varName: function(template, pos, ch) {
        switch(ch) {
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
            // alert(name +" "+ mode);
            return [pos1, name, mode];
            break;

            default:
            return [pos, ch, ''];
            break;
        }
    },

    processValue: function(success_state, fail_state, name, mode, value, out, line_start) {
        var skip_sep;
        var next_state;
        if (value === null || value === "") {
            next_state = fail_state;
            if (mode !== null) {
                if (mode.match(/!/)) {
                    var s_empty = shelveUtils.localized('missing');
                    alert(s_empty + " " + shelveUtils.localized('abort'));
                    throw s_empty;
                }
                if (mode.match(/\?/)) {
                    out = out.slice(0, line_start);
                    next_state = 4;
                }
            }
            skip_sep = next_state == 0 && out.match(/[\/\\]$/);
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
        'Y': 'fullyear',
        'y': 'year',
        'n': 'note',
        'o': 'outfile',
        'u': 'url',
        'v': 'shelf'
    },

    expandVar: function(out, fail_state, ch, et_params) {
        var name = shelve.expandVarNames[ch] || ch;
        // shelveUtils.debug('shelve expandVar: [ch, name]=', [ch, name]);
        var val;
        switch(name) {

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
                alert(s_empty + " " + shelveUtils.localized('abort'));
                throw s_empty;
            }
            break;

            case 'date':
            val = shelve.lpadString(new Date().getDate(), "00");
            break;

            case 'ext':
            if (ch === 'E') {
                alert(shelveUtils.localized('pct.e'));
            }
            val = shelve.maybeExtension(out, et_params.extension);
            break;

            case 'filename':
            val = shelve.getDocumentFilename(et_params, 2);
            break;

            case 'basename':
            val = shelve.getDocumentFilename(et_params, 1);
            break;

            case 'host':
            val = shelve.getDocumentHost(et_params, 0);
            break;

            case 'hostbasename':
            val = shelve.getDocumentHost(et_params, 1);
            break;

            case 'hours':
            val = shelve.lpadString(new Date().getHours(), "00");
            break;

            case 'input':
            val = et_params.interactive ? shelve.queryUser(et_params, "Input", "") : '%i';
            break;

            case 'subdir':
            val = et_params.interactive ? shelve.queryDirectory(et_params, out) : '%I';
            break;

            case 'keywords':
            val = shelve.getDocumentKeywords(et_params);
            break;

            case 'msecs':
            val = new Date().getMilliseconds();
            break;

            case 'minutes':
            val = shelve.lpadString(new Date().getMinutes(), "00");
            break;

            case 'month':
            val = shelve.lpadString(new Date().getMonth() + 1, "00");
            break;

            case 'fullpath':
            val = shelve.getDocumentFilename(et_params, 3);
            break;

            case 'path':
            val = shelve.getDocumentFilename(et_params, 4);
            break;

            case 'query':
            val = shelve.getDocumentUrlQuery(et_params);
            break;

            case 'secs':
            val = shelve.lpadString(new Date().getSeconds(), "00");
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
            val = shelve.lpadString(yr.slice(yr.length - 2), "00");
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

            case 'url':
            val = et_params.mode == 'log' ? shelve.getDocumentURL(et_params) : null;
            break;
            
            case 'content':
            val = et_params.mode == 'log' ? shelveUtils.unixString(et_params.shelve_content || "") : null;
            break;

            case 'shelf':
            val = et_params.mode == 'log' ? et_params.shelve_name : null;
            break;


            default:
            val = null;
            fail_state = 0;
            alert(shelveUtils.localized('unknown') + ": %" + ch);

        }

        if (val) {
            val = shelveDb.rewrite(name, shelve.getDocumentURL(et_params), val);
            if (et_params.mode != 'log') {
                val = shelve.cleanValue(val);
            }
        }

        return [fail_state, val];
    },

    cleanValue: function(value) {
        if (value == null) {
            return value;
        } else {
            // alert("IN: "+ value);
            value = String(value).replace(/[*|<>?:&\/"]/g, '_');
            value = value.replace(/[\r\n\t]+/g, ' ');
            value = value.replace(/^\s+/g, '');
            value = value.replace(/\s+$/g, '');
            // alert("OUT: "+ value);
            return value;
        }
    },

    lpadString: function(str, fill) {
        str = String(str);
        var pad = fill.slice(0, fill.length - str.length);
        return pad + str;
    },

    getNote: function(et_params) {
        if (et_params.note) {
            switch(et_params.mime) {
                case "text":
                case "text_latin1":
                return et_params.note;
                break;
                default:
                return "<pre>"+ shelveUtils.escapeHTML(et_params.note) +"</pre>";
            }
        } else {
            return null;
        }
    },

    userDirectory: null,

    queryDirectory: function(et_params, cd) {
        if (et_params.userDirectory) {
            return et_params.userDirectory;
        } else {
            // http://developer.mozilla.org/en/docs/nsIFilePicker
            const nsIFilePicker = Components.interfaces.nsIFilePicker;
            var fp = Components.classes["@mozilla.org/filepicker;1"]
            .createInstance(nsIFilePicker);
            fp.init(et_params.parentWindow, shelveUtils.localized("select.subdir"), nsIFilePicker.modeGetFolder);
            var initDir = shelveUtils.localFile(cd);
            if (!initDir.exists()) {
                alert(shelveUtils.localized('dir.notexists') + ': ' + cd);
            } else if (!initDir.isDirectory()) {
                alert(shelveUtils.localized('dir.not') + ': ' + cd);
            } else {
                try {
                    var directoryEntries = initDir.directoryEntries;
                    while (directoryEntries.hasMoreElements()) {
                        var firstEntry = directoryEntries.getNext();
                        firstFile = firstEntry.QueryInterface(Components.interfaces.nsILocalFile);
                        if (firstEntry.isDirectory()) {
                            initDir = firstFile;
                            break;
                        }
                    }
                    fp.displayDirectory = initDir;
                    // fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText);
                    var rv = fp.show();
                    if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
                        if (cd == fp.file.path.slice(0, cd.length)) {
                            // var file = fp.file.leafName;
                            var file = fp.file.path.slice(cd.length);
                            et_params.userDirectory = file;
                            shelve.userDirectory = file;
                            return file;
                        } else {
                            alert(shelveUtils.localized('dir.notsub'));
                            throw("Shelve: Illegal user input: "+ rv);
                        }
                    }
                } catch (e) {
                    shelveUtils.log("Error when listing directory: "+ cd +": "+ e);
                }
            }
            // return null;
            alert(shelveUtils.localized('cancel') +' '+ shelveUtils.localized('abort'));
            throw("Shelve: User cancelled");
        }
        return null;
    },

    userInput: null,

    queryUser: function(et_params, query, text) {
        if (et_params.userInput) {
            return et_params.userInput;
        } else {
            var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
            .getService(Components.interfaces.nsIPromptService);
            var check = {};
            var input = {value: text};
            var result = prompts.prompt(window, "Shelve", query, input, null, check);
            if (result) {
                et_params.userInput = input.value;
                shelve.userInput = input.value;
                return input.value;
            } else {
                return null;
            }
        }
    },

    maybeExtension: function(filename, extension) {
        // shelveUtils.debug('shelve maybeExtension filename=', filename);
        // shelveUtils.debug('shelve maybeExtension extension=', extension);
        // shelveUtils.debug('shelve maybeExtension slice pos=', ("" || extension).length);
        // shelveUtils.debug('shelve maybeExtension slice=', filename.slice(filename.length - ("" || extension).length));
        if (extension != null && filename.slice(filename.length - extension.length) != extension) {
            return extension;
        } else {
            return null;
        }
    },
    
    getDocumentClip: function(doc_params) {
        return doc_params.clip != null ? doc_params.clip : shelve.getDocumentClipInWindow(getBrowser().contentWindow);
    },

    getDocumentClipInWindow: function(win) {
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
        }
        return sel;
    },

    getSelectionString: function(elt) {
        var selection = elt.getSelection();
        return selection && selection.toString();
    },

    getShelfMime: function(shelfId, doc_params) {
        return doc_params.mime || shelveStore.getMime(shelfId);
    },

    getDocumentMime: function(doc_params) {
        if (doc_params.mime != null) {
            return doc_params.mime;
        } else {
            var doc = shelve.getDocument(doc_params);
            switch(doc.contentType) {
                case 'text/html':
                case 'application/xhtml+xml':
                var prefs = shelve.getPrefs("");
                return shelve.getUnicharPref(prefs, 'mime') || 'default';

                default:
                return 'binary';
            }
        }
    },

    getDocumentTitle: function(doc_params) {
        return doc_params.title || shelve.getDocument(doc_params).title;
    },

    getDocumentKeywords: function(doc_params) {
        if (doc_params.keywords != null) {
            return doc_params.keywords;
        } else {
            var keywords = [];
            var doc = shelve.getDocument(doc_params);
            if (!doc.mockup) {
                var tags = doc.getElementsByName('keywords');
                for (var i in tags) {
                    var content = tags[i].content;
                    if (content) {
                        keywords.push(content);
                    }
                }
            }
            return keywords.join('; ')
        }
    },

    getDocumentFilename: function(et_params, filenametype) {
        var url = shelve.getDocumentURL(et_params);
        var path = url.replace(/^(\w+:\/\/)?[^\/]*\/?/, '');
        var tail = path.replace(/^([^\/]*\/)*/, '');
        var file;
        switch(filenametype) {
            case 1:
            file = tail.match(/^[^#?&.]*/) || "";
            break;
            case 2:
            file = tail.match(/^[^#?&]*/) || "";
            break;
            case 3:
            file = path.replace(/[#?&].*$/, '');
            file = file.replace(/[*|<>?:"]/g, '_');
            if (file.match(/[\/\\]$/)) {
                file += 'index.html';
            }
            break;
            case 4:
            file = shelve.getDocumentFilename(et_params, 3);
            file = file.replace(/\.\w+$/, '');
            break;
        }
        file = String(file);
        if (shelveUtils.getOS() == "WINNT") {
            file = file.replace(/\//g, '\\');
        }
        if (file.match(/\S/)) {
            return file;
        } else {
            switch(filenametype) {
                case 1:
                return "index";
                break;
                default:
                return "index.html";
            }
        }
    },

    getDocument: function(doc_params) {
        return doc_params.doc || window._content.document;
    },

    getDocumentURL: function(doc_params) {
        var url = doc_params.url;
        if (url == null) {
            var doc = shelve.getDocument(doc_params);
            url = doc && doc.URL;
        }
        return url;
    },

    getDocumentHost: function(et_params, mode) {
        var host = shelve.getDocumentURL(et_params).match(/^\w+:\/\/([^?\/]+)/);
        if (host) {
            host = host[1];
            switch(mode) {
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

    getDocumentUrlQuery: function(et_params) {
        var url = shelve.getDocumentURL(et_params);
        var rest = url.match(/\?(.*)$/);
        return rest ? rest[1] : rest;
    }

};

