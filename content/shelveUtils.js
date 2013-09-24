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
/*jsl:declare alert*/
/*jsl:import shelveStore.js*/


var shelveUtils = {
    // Constants
    MAXNAMELEN: 255,

    // // Based on http://stackoverflow.com/questions/3774008/cloning-a-javascript-object
    // clone: (function(){ 
    //     return function (obj) {
    //         Clone.prototype=obj;
    //         return new Clone()
    //     };
    //     function Clone(){}
    // }()),
    
    clone: function(obj) { 
        return JSON.parse(JSON.stringify(obj));
    },

    pick: function(cid, mode) {
        // shelveUtils.debug("shelveUtils pick: cid=", cid);
        // shelveUtils.debug("shelveUtils pick: mode=", mode);
        const nsIFilePicker = Components.interfaces.nsIFilePicker;
        var fp = Components.classes['@mozilla.org/filepicker;1'].
        createInstance(nsIFilePicker);
        // shelveUtils.debug("shelveUtils pick: fp=", fp);

        var textbox = document.getElementById(cid);
        // shelveUtils.debug("shelveUtils pick: textbox=", textbox);
        var val = textbox.value;
        if (val === '') {
            var prefs = Components.classes['@mozilla.org/preferences-service;1'].
            getService(Components.interfaces.nsIPrefService).getBranch('');
            try {
                val = prefs.getCharPref('browser.download.lastDir');
            } catch (e) {
                try {
                    val = prefs.getCharPref('browser.download.dir');
                } catch (exception) {
                    val = '';
                }
            }
        }
        // shelveUtils.debug("shelveUtils pick: val=", val);
        var init = shelveUtils.localFile(val);
        // shelveUtils.debug("shelveUtils pick: init=", init);
        var fpMode;

        switch (mode) {
            case 'directory':
            case 'template':
            fpMode = nsIFilePicker.modeGetFolder;
            name = mode;
            if (init) {
                fp.displayDirectory = init;
            }
            break;

            case 'save':
            fpMode = nsIFilePicker.modeSave | nsIFilePicker.filterAll;
            name = 'file';
            if (init && val !== '') {
                fp.displayDirectory = init.parent;
            }
            break;

            case 'open':
            default:
            fpMode = nsIFilePicker.modeOpen;
            name = 'file';
            if (init) {
                fp.displayDirectory = init.parent;
            }
            break;
        }

        fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText |
        nsIFilePicker.filterHTML | nsIFilePicker.filterXML);
        fp.init(window, 'Select ' + name, fpMode);
        var rv = fp.show();
        // shelveUtils.debug("shelveUtils pick: rv=", rv);
        if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
            // shelveUtils.debug("shelveUtils pick: rv=", fp.file.path);
            textbox.value = fp.file.path;
            switch (mode) {
                case 'template':
                var tpl = shelveStore.getString(null, 'default_template', '');
                textbox.value = shelveUtils.filenameJoin([textbox.value, tpl]);
                break;

                default:
                break;
            }
        }

    },

    openDoc: function(url) {
        // window.open(url);
        shelveUtils.mainWindow().open(url);
    },

    mainWindow: function() {
        var wm = Components.classes['@mozilla.org/appshell/window-mediator;1'].
        getService(Components.interfaces.nsIWindowMediator);
        var win = wm.getMostRecentWindow('navigator:browser');
        // return win.content;
        return win;
    },

    withBrowserWindows: function(fn) {
        var wm = Components.classes['@mozilla.org/appshell/window-mediator;1'].
        getService(Components.interfaces.nsIWindowMediator);
        var enumerator = wm.getEnumerator('navigator:browser');
        while (enumerator.hasMoreElements()) {
            var win = enumerator.getNext();
            fn(win);
        }
    },

    // Determine if document is a document and not a frame
    isTopLevelDoc: function(doc, browser) {
        if (doc.nodeName != '#document') {
            shelveUtils.debug('shelveUtils.isTopLevelDoc doc not document or is frame: ', doc.location && doc.location.href);
            return false;
        // If there is a defaultView (window) ...
        } else if (doc.defaultView) {
            // ... and its location url is not the same as the current browser, skip
            // probably this is some kind of frame
            if (browser && doc.defaultView.location &&
                (doc.defaultView.location.href != browser.currentURI.spec)) {
                shelveUtils.debug('shelveUtils.isTopLevelDoc doc\'s url not same as browser\'s: ('+browser.currentURI.spec+'): ', doc.defaultView.location.href);
                return false;
            }
            // ... and it has a parent (window) that is not itself, skip
            // probably this is some kind of frame
            else if (doc.defaultView != doc.defaultView.parent) {
                shelveUtils.debug('shelveUtils.isTopLevelDoc doc not parent document: ', doc.location && doc.location.href);
                return false;
            }
        }
        
        return true;
    },

    emptyListbox: function(listbox) {
        listbox.clearSelection();
        while (listbox.getRowCount() > 0) {
            listbox.removeItemAt(0);
        }
    },

    fillListbox: function(listbox, selectedShelfId) {
        // shelveUtils.debug("shelveUtils.fillListbox selectedShelfId=", selectedShelfId);
        shelveUtils.emptyListbox(listbox);
        var selectedShelfIdNr = parseInt(selectedShelfId, 10);
        var max = shelveStore.max();
        var shelfIndex = -1;
        var shelfSearch = true;
        for (var shelfId = 1; shelfId <= max; shelfId++) {
            var template = shelveStore.get(shelfId, 'dir', null);
            // shelveUtils.debug("shelveUtils.fillListbox ", shelfId +" "+ template);
            if (template && template.match(/\S/)) {
                listbox.appendItem(shelveStore.getDescription(shelfId), shelfId);
                if (shelfSearch) {
                    shelfIndex++;
                    if (shelfId == selectedShelfIdNr) {
                        shelfSearch = false;
                    }
                }
            }
        }
        // shelveUtils.debug("shelveUtils.fillListbox shelfIndex=", shelfIndex);
        shelveUtils.selectListboxItem(listbox, shelfIndex);
    },

    getShelfListindex: function(listbox, shelfId) {
        // shelveUtils.debug("shelveUtils.getShelfListindex shelfId=", shelfId);
        for (var index = 0; index < listbox.getRowCount(); index++) {
            var listitem = listbox.getItemAtIndex(index);
            // shelveUtils.debug("shelveUtils.getShelfListindex value=", listitem);
            if (listitem.value == shelfId) {
                // shelveUtils.debug("shelveUtils.getShelfListindex index=", index);
                return index;
            }
        }
        return -1;
    },

    selectListboxItem: function(listbox, index) {
        // shelveUtils.debug("shelveUtils.selectListboxItem index=", index);
        if (index >= 0) {
            var listitem = listbox.getItemAtIndex(index);
            // shelveUtils.debug("shelveUtils.selectListboxItem shelf=", listitem.value);
            // listbox.selectedItem = listitem;
            listbox.ensureElementIsVisible(listitem);
            listbox.selectedItem = listitem;
            // listbox.selectedIndex = index;
        }
    },

    createNewShelf: function(listbox) {
        var newIndex = shelveStore.newIndex();
        var ed_params = {
            inn: {
                item: newIndex
            },
            out: null
        };
        window.openDialog('chrome://shelve/content/editShelf.xul',
        '', 'chrome, dialog, modal, resizable=yes', ed_params).focus();
        listbox.focus();
        if (ed_params.out && ed_params.out.ok) {
            shelveUtils.fillListbox(listbox, newIndex);
            return true;
        } else {
            return false;
        }
    },

    cloneSelected: function(listbox) {
        var selectedIndex = listbox.selectedIndex;
        // shelveUtils.debug("shelveUtils.cloneSelected selectedIndex=", selectedIndex);
        if (selectedIndex >= 0) {
            var selected = listbox.selectedItem;
            // shelveUtils.debug("shelveUtils.cloneSelected selected=", selected);
            var thisShelfId = selected.value;
            // shelveUtils.debug("shelveUtils.cloneSelected thisShelfId=", thisShelfId);
            var thatShelfId = shelveStore.newIndex();
            // shelveUtils.debug("shelveUtils.cloneSelected thatShelfId=", thatShelfId);
            shelveStore.copy(thisShelfId, thatShelfId);
            var name = shelveStore.get(thatShelfId, 'name', thisShelfId) + ' copy';
            shelveStore.setUnichar(thatShelfId, 'name', name);
            var ed_params = {
                inn: {
                    item: thatShelfId
                },
                out: null
            };
            window.openDialog('chrome://shelve/content/editShelf.xul',
            '', 'chrome, dialog, modal, resizable=yes', ed_params).focus();
            listbox.focus();
            if (ed_params.out && ed_params.out.ok) {
                shelveUtils.fillListbox(listbox, thatShelfId);
                return true;
            } else {
                shelveStore.remove(thatShelfId);
                return false;
            }
        }
        return false;
    },

    getWindow: function(doc_params) {
        // shelveUtils.debug('shelveUtils.getDocument doc_params=', doc_params);
        return doc_params.window || window;
    },

    getDocument: function(doc_params) {
        // shelveUtils.debug('shelveUtils.getDocument doc_params=', doc_params);
        return doc_params.doc || window._content.document;
    },

    getDocumentURL: function(doc_params) {
        var url = doc_params.url;
        if (url == null) {
            var doc = shelveUtils.getDocument(doc_params);
            url = doc && doc.URL;
            if (url && url.match(/\/ReadItLater\/RIL_pages\/.*?\/text\.html$/)) {
                url = doc.links[0].href;
            }
        }
        return url;
    },

    getDocumentType: function(doc_params) {
        var doc = shelveUtils.getDocument(doc_params);
        var doc_type;
        if (doc.baseURI && doc.baseURI.match(/^resource:\/\/pdf\.js\//)) {
            if (doc_params.shelve_content) {
                doc_type = 'text/html';
            } else {
                doc_type = 'application/pdf';
            }
        } else {
            // shelveUtils.debug("shelveUtils.getDocumentType", doc.contentType);
            doc_type = doc.contentType;
        }
        return doc_type;
    },

    getExtension: function(doc_params_ext, mime, mime_fix) {
        // shelveUtils.debug("shelveUtils getExtension doc_params_ext=", doc_params_ext);
        // shelveUtils.debug("shelveUtils getExtension mime=", mime);
        // shelveUtils.debug("shelveUtils getExtension mime_fix=", mime_fix);
        var doc = shelveUtils.getDocument(doc_params_ext);
        if (!mime_fix) {
            var content_type = doc_params_ext.type || shelveUtils.getDocumentType(doc_params_ext);
            // shelveUtils.debug("shelveUtils getExtension content_type=", content_type);
            if (content_type && !doc_params_ext.shelve_content) {
                var content_type_match = content_type.match(/^(image\/(.*)|application\/(pdf))$/);
                // shelveUtils.debug("shelveUtils getExtension content_type_match=", content_type_match);
                if (content_type_match) {
                    if (content_type_match[2]) {
                        var ctype = shelveDb.rewrite('extension', shelveUtils.getDocumentURL(doc_params_ext), content_type_match[2]);
                    } else if (content_type_match[3]) {
                        var ctype = shelveDb.rewrite('extension', shelveUtils.getDocumentURL(doc_params_ext), content_type_match[3]);
                    }
                    if (ctype !== '') {
                        return '.' + ctype;
                    }
                }
            }
        }
        switch (mime) {
            case 'binary':
                var ios = Components.classes['@mozilla.org/network/io-service;1'].
                    getService(Components.interfaces.nsIIOService);
                var uri = ios.newURI(doc.documentURI, null, null);
                var path = uri.path;
                path = path.replace(/[#?].*$/, '');
                var ext = path.match(/\.\w+$/);
                if (ext) {
                    // shelveUtils.debug("shelveUtils getExtension ext=", ext);
                    return ext[0];
                } else {
                    // shelveUtils.debug("shelveUtils getExtension", ".html");
                    return '.html';
                }

            case 'text':
            case 'text_latin1':
            // shelveUtils.debug("shelveUtils getExtension", "txt");
            return '.txt';

            case 'webpage_maf':
            // shelveUtils.debug("shelveUtils getExtension", "webpage_maf");
            if (shelveUtils.isMafEnabled(false)) {
                return '.maff';
            }

            case 'webpage_mht':
            // shelveUtils.debug("shelveUtils getExtension", "webpage_mht");
            if (shelveUtils.isMafEnabled(false)) {
                return '.mht';
            }

            case 'webpage':
            /*jsl:fallthru*/
            case 'html':
            case 'default':
            default:
            // shelveUtils.debug("shelveUtils getExtension", "default");
            return '.html';
        }
    },

    getClipboard: function() {
        // https://developer.mozilla.org/en/Using_the_Clipboard
        var clip = Components.classes['@mozilla.org/widget/clipboard;1'].
            getService(Components.interfaces.nsIClipboard);
        if (clip) {
            var trans = Components.classes['@mozilla.org/widget/transferable;1'].
                createInstance(Components.interfaces.nsITransferable);
            if (!trans) return '';
            if ('init' in trans)
                trans.init(null);
            trans.addDataFlavor('text/unicode');
            clip.getData(trans, clip.kGlobalClipboard);
            var str = new Object();
            var strLength = new Object();
            trans.getTransferData('text/unicode', str, strLength);
            if (str) {
                str = str.value.QueryInterface(Components.interfaces.nsISupportsString);
                if (str) {
                    return str.data.substring(0, strLength.value / 2);
                }
            }
        }
        return '';
    },

    // getContentType: function(url) {
    //     var cs = Components.classes['@mozilla.org/network/content-sniffer;1'].
    //     createInstance(Components.interfaces.nsIContentSniffer);
    //     cs.getMIMETypeFromContent()
    // },

    assert: function(value, expected, text) {
        if (value !== expected) {
            var t = '';
            if (text) {
                t += text + ': ';
            }
            try {
                t += 'expected ' + uneval(expected) + ' but got ' + uneval(value);
            } catch (e) {
                t += 'expected ' + expected + ' but got ' + value;
            }
            alert(t);
        }
    },

    exceptionWrap: function(func) {
        // This wrapper does not look exactly like func, namely the length
        // parameter (indicating the number of arguments).  If this turns out
        // to be a problem, then use eval to create a wrapper with the same
        // number of args.
        return function() {
            try {
                return func.apply(this, arguments);
            } catch(e) {
                let fname = func.name || "<anonymous function>";
                shelveUtils.log(fname+": Exception: "+e);
                if (e.stack)
                    shelveUtils.log(fname+": Stack Trace\n"+e.stack);
                throw e;
            }
        };
    },

    shouldDebug: function(log_level) {
        var rv = log_level == null ? shelveStore.getBool(null, 'debug', false) : shelveUtils.shouldLog(log_level);
        return rv;
    },

    debug: function(text, value, log_level) {
        if (shelveUtils.shouldDebug(log_level)) {
            var sval = (typeof value) + ':';
            var done = false;
            try {
                sval += uneval(value);
                done = true;
                // sval = uneval(value);
            } catch (e) {
                // shelveUtils.log('DEBUG: shelveUtils debug uneval(value) error=' + e);
            }
            if (!done) {
                try {
                    sval += value.toSource();
                    done = true;
                } catch (e) {
                    // shelveUtils.log('DEBUG: shelveUtils debug value.toSource() error=' + e);
                }
            }
            if (!done) {
                try {
                    sval += value;
                    shelveUtils.log('DEBUG: shelveUtils debug value=' + sval);
                } catch (e) {
                    // shelveUtils.log('DEBUG: shelveUtils debug value error=' + e);
                    sval += '???';
                }
            }
            shelveUtils.log('DEBUG: ' + text + ' ' + sval);
            // alert('DEBUG: ' + text + ' ' + sval);
        }
    },

    shouldLog: function(level) {
        var rv = typeof(level) !== 'number' || level <= shelveStore.getBool(null, 'log_level', 2);
        return rv;
    },

    log: function(text, log_level) {
        if (shelveUtils.shouldLog(log_level)) {
            var logval = shelveStore.getString(null, 'logger', 'none');
            if (logval == 'none') {
                // do nothing
            // } else if (logval == 'js') {
            //     if (window.console !== undefined) {
            //         window.console.error("Shelve: %d", text);
            //     }
            } else if (logval == 'console') {
                var aConsoleService = Components.classes['@mozilla.org/consoleservice;1'].
                getService(Components.interfaces.nsIConsoleService);
                aConsoleService.logStringMessage('Shelve: ' + text);
            } else if (logval == 'stdout') {
                dump('Shelve: ' + text + "\n");
            }
        }
    },

    localFile: function(path) {
        try {
            if (path != '-') {
                var localFile = Components.classes['@mozilla.org/file/local;1'];
                var file = localFile.createInstance(Components.interfaces.nsIFile);
                // FIXME: initWithPath if path == ""?
                if (path !== '') {
                    file.initWithPath(path);
                }
                return file;
            }
            return null;
        } catch (e) {
            shelveUtils.log('Malformed path: ' + String(path));
        }
        return null;
    },

    isSomeFilename: function(filename) {
        return filename && filename.match(/\S/) && !filename.match(/^-+$/);
    },

    writeTextFile: function(file, text, enc, init_flags0) {
        // shelveUtils.debug('shelveUtils writeTextFile file=', file);
        // shelveUtils.debug('shelveUtils writeTextFile text=', text);
        if (file === null) {
            return false;
        }

        var init_flags = init_flags0 === undefined ? 0x02 | 0x10 | 0x08 : init_flags0;
        // shelveUtils.debug('shelveUtils writeTextFile enc=', enc);
        // shelveUtils.debug('shelveUtils writeTextFile init_flags=', init_flags);

        try {
            if (!file.exists()) {
                file.create(0x00, 0644);
            }

            var fos = Components.classes['@mozilla.org/network/file-output-stream;1'].
            createInstance(Components.interfaces.nsIFileOutputStream);
            fos.init(file, init_flags, -1, 0);

            if (enc) {
                var os = Components.classes['@mozilla.org/intl/converter-output-stream;1'].
                createInstance(Components.interfaces.nsIConverterOutputStream);
                os.init(fos, enc, 0, '_'.charCodeAt(0));
                os.writeString(text);
                os.close();
            } else {
                fos.write(text, text.length);
                fos.close();
            }
            // shelveUtils.debug('shelveUtils writeTextFile ok=', true);
            return true;
        } catch (ex) {
            shelveUtils.log('Error when writing text file:' + ex + '; file=' + file + '; text=' + text);
        }
        return false;
    },

    readText: function(filename) {
        if (filename.match(/^chrome:/)) {
            // http://forums.mozillazine.org/viewtopic.php?p=921150#921150
            var ioService = Components.classes['@mozilla.org/network/io-service;1'].
            getService(Components.interfaces.nsIIOService);
            var scriptableStream = Components.classes['@mozilla.org/scriptableinputstream;1'].
            getService(Components.interfaces.nsIScriptableInputStream);
            var channel = ioService.newChannel(filename, null, null);
            var input = channel.open();
            scriptableStream.init(input);
            var str = scriptableStream.read(input.available());
            scriptableStream.close();
            input.close();
            return str;
        } else {
            var file = shelveUtils.localFile(filename);
            if (file.exists()) {
                var data = '';
                var fstream = Components.classes['@mozilla.org/network/file-input-stream;1'].
                createInstance(Components.interfaces.nsIFileInputStream);
                var cstream = Components.classes['@mozilla.org/intl/converter-input-stream;1'].
                createInstance(Components.interfaces.nsIConverterInputStream);
                fstream.init(file, -1, 0, 0);
                cstream.init(fstream, 'UTF-8', 0, 0);
                var strobj = {};
                cstream.readString(-1, strobj);
                data = strobj.value;
                cstream.close();
                return data;
            } else {
                return '';
            }
        }
    },

    convertToUnicode: function(acstring) {
        var converter = Components.classes['@mozilla.org/intl/scriptableunicodeconverter'].
        createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
        converter.charset = 'UTF-8';
        var text = converter.ConvertToUnicode(acstring);
        return text;
    },

    getProfDir: function() {
        var dir = Components.classes['@mozilla.org/file/directory_service;1'].
        getService(Components.interfaces.nsIProperties).
        get('ProfD', Components.interfaces.nsIFile);
        return dir.clone();
    },

    getShelveDir: function() {
        var shelveDir = shelveUtils.getProfDir();
        shelveDir.append('shelve');
        if (!shelveDir.exists()) {
            /*jsl:ignore*/
            shelveDir.create(0x01, 0755);
            /*jsl:end*/
        }
        return shelveDir;
    },

    newURI: function(url) {
        var ios = Components.classes['@mozilla.org/network/io-service;1'].
        getService(Components.interfaces.nsIIOService);
        return ios.newURI(url, null, null);
    },

    newFileURI: function(file) {
        var ios = Components.classes['@mozilla.org/network/io-service;1'].
        getService(Components.interfaces.nsIIOService);
        return ios.newFileURI(file);
    },

    json: function() {
        // http://developer.mozilla.org/en/JSON
        return Components.classes['@mozilla.org/dom/json;1'].
        createInstance(Components.interfaces.nsIJSON);
    },

    getOS: function() {
        // http://developer.mozilla.org/en/docs/Code_snippets:Miscellaneous
        // Returns "WINNT" on Windows Vista, XP, 2000, and NT systems;
        // "Linux" on GNU/Linux; and "Darwin" on Mac OS X.
        var osString = Components.classes['@mozilla.org/xre/app-info;1'].
        getService(Components.interfaces.nsIXULRuntime).OS;
        return osString;
    },

    osString: function(str) {
        if (shelveUtils.getOS() == 'WINNT') {
            return str.replace(/\n/g, '\r\n');
        } else {
            return str;
        }
    },

    unixString: function(str) {
        return str.replace(/\r/g, '');
    },

    asISupportsString: function(str) {
        var sstr = Components.classes['@mozilla.org/supports-string;1'].createInstance(Components.interfaces.nsISupportsString);
        sstr.data = str;
        return sstr;
    },

    encode: function(something) {
        return shelveUtils.json.encode(something);
    },

    decode: function(json) {
        return shelveUtils.json.decode(json);
    },

    hashstring: function(str, b64encode, method) {
        var converter =
          Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
            createInstance(Components.interfaces.nsIScriptableUnicodeConverter);

        // we use UTF-8 here, you can choose other encodings.
        converter.charset = "UTF-8";
        // result is an out parameter,
        // result.value will contain the array length
        var result = {};
        // data is an array of bytes
        var data = converter.convertToByteArray(val, result);
        var ch = Components.classes["@mozilla.org/security/hash;1"]
                           .createInstance(Components.interfaces.nsICryptoHash);

        if (!method)
            method = ch.MD5;
        else if (ch[method])
            method = ch[method];
        else
            throw new Error("Undefined crypto hash method: "+method);

        ch.init(method);
        ch.update(data, data.length);
        return ch.finish(b64encode);
    },

    escapeChar: function(text, chars) {
        return text.replace(new RegExp('([' + chars + '])', 'g'), '\\$1');
    },

    escapeHTML: function(html) {
        if (html === null) {
            return null;
        } else {
            var text = html.replace(/&/g, '&amp;');
            text = text.replace(/</g, '&lt;');
            text = text.replace(/>/g, '&gt;');
            text = text.replace(/"/g, '&quot;');
            return text;
        }
    },

    validateTemplate: function(templateBox, optional, klass) {
        var template = templateBox.value;
        if ((optional && template === '') || shelveUtils.validTemplate(template, klass) > 0) {
            templateBox.setAttribute('style', '');
            templateBox.setAttribute('tooltiptext', '');
        } else {
            templateBox.setAttribute('style', '-moz-appearance:none; background-color:yellow;');
            templateBox.setAttribute('tooltiptext', shelveUtils.localized('malformed_template'));
        }
    },

    validTemplate: function(template, klass) {
        if (template == '-') {
            return true;
        } else {
            var phn = 0;
            var phs = shelveUtils.validPlaceholders(klass);
            var good_rx = new RegExp('^\\d*(' + phs + '|\\[' + phs + '+\\])');
            var text = template;
            var malformed = false;
            while (true) {
                var i = text.indexOf('%');
                if (i == -1) {
                    break;
                } else {
                    text = text.slice(i + 1);
                    var ph = text.match(good_rx);
                    if (ph === null) {
                        malformed = true;
                        text = text.slice(1);
                    } else {
                        text = text.slice(ph[0].length);
                        if (ph[0] != '%') {
                            phn++;
                        }
                    }
                }
            }
            if (phn === 0 && klass == 'logfilename') {
                phn = 1;
            }
            var rv = malformed ? -phn : phn;
            return rv;
        }
    },

    validPlaceholders: function(klass) {
        var chars = 'cCdDeEfFhHBhiIklmMpPqstxyY%/';
        var names = 'clip|clip!|clipboard|date|input|subdir|host|hostbasename|query|queryhash|queryq|queryhashq|dirname|dirnameshorten|fullpath|path|filename|basename|fullpathi|pathi|filenamei|basenamei|archivefilename|ext|title|keywords|fullyear|year|month|day|hours|minutes|secs|msecs|shelvedir|separator';
        switch (klass) {
            case 'log':
            case 'footer':
            chars += 'noOuv';
            names += '|note|outfile|relativeoutfile|url|shelf|content';
            break;

            case 'filename':
            case 'logfilename':
            default:
            break;
        }
        return '([' + chars + ']|\\{(\\$\\w+|' + names + ')[!?]?\\})';
    },

    filenameJoin: function(parts) {
        var sep = shelveUtils.filenameSeparator();
        // return parts.join(sep);
        var acc = [];
        var last = parts.length - 1;
        for (var i in parts) {
            var p = parts[i];
            if (i < last && p[p.length - 1] != sep) {
                p += sep;
            }
            acc.push(p);
        }
        return acc.join('');
    },

    filenameSeparator: function() {
        if (shelveUtils.getOS() == 'WINNT') {
            return '\\';
        } else {
            return '/';
        }
    },

    localized: function(name) {
        var bundles = Components.classes['@mozilla.org/intl/stringbundle;1'].
        getService(Components.interfaces.nsIStringBundleService);
        var bundle = bundles.createBundle('chrome://shelve/locale/shelve.properties');
        return bundle.GetStringFromName('extensions.shelve.' + name);
    },

    appVersion: function() {
        var info = Components.classes['@mozilla.org/xre/app-info;1'].
        getService(Components.interfaces.nsIXULAppInfo);
        return info.version;
    },

    appInfo: function() {
        var info = Components.classes['@mozilla.org/xre/app-info;1'].
        getService(Components.interfaces.nsIXULAppInfo);
        return info.name + info.version;
    },

    mafObjects: null,

    isMafEnabled: function(doAlert) {
        if (shelveUtils.mafObjects === false) {
            return false;
        } else if (shelveUtils.mafObjects === null) {
            try {
                var MafObjects = {};
                /*jsl:ignore*/
                Components.utils.import('resource://maf/modules/mafObjects.jsm', MafObjects);
                /*jsl:end*/
                shelveUtils.mafObjects = MafObjects;
                return true;
            } catch (e) {
                if (doAlert) {
                    shelveUtils.log('Error when creating MAF object: ' + e);
                    shelveUtils.log(shelveUtils.localized('require.maf'));
                    alert(shelveUtils.localized('require.maf'));
                }
                shelveUtils.mafObjects = false;
                return false;
            }
        } else {
            return true;
        }
    },

    checkMimeItems: function(doc, mime) {
        if (mime === 'binary') {
            doc.getElementById('mimewebpage').hidden = true;
            doc.getElementById('mimewebpage_mht').hidden = true;
            doc.getElementById('mimewebpage_maf').hidden = true;
            doc.getElementById('mimehtml').hidden = true;
            doc.getElementById('mimetext').hidden = true;
            doc.getElementById('mimetext_latin1').hidden = true;
        } else if (!shelveUtils.isMafEnabled(false)) {
            doc.getElementById('mimewebpage_mht').hidden = true;
            doc.getElementById('mimewebpage_maf').hidden = true;
        }
    },

    getMafSaver: function(sp_params, doc, file, format, enable_dlm) {
        if (shelveUtils.isMafEnabled(true)) {
            return function(doc, file, dataPath, outputContentType, encodingFlags, wrapColumn) {
                var fileUri = shelveUtils.newFileURI(file);
                var browsers = sp_params.browser;
                if (!browsers)
                    browsers = null;
                else if (!browsers.map) {
                    browsers = [browsers];
                }
                var persistObject = new shelveUtils.mafObjects.MafArchivePersist(browsers, format);
                if (enable_dlm) {
                    var uri = shelveUtils.newURI(sp_params.url);
                    shelve.registerDownload(persistObject, uri, fileUri, sp_params, null);
                }
                persistObject.saveDocument(doc, fileUri);
            };
        } else {
            return null;
        }
    }

};

