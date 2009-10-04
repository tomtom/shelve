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

    clone: function(obj) {
        return eval(uneval(obj));
    },

    pick: function(cid, mode) {
        // shelveUtils.debug("shelveUtils pick: cid=", cid);
        // shelveUtils.debug("shelveUtils pick: mode=", mode);
        const nsIFilePicker = Components.interfaces.nsIFilePicker;
        var fp = Components.classes["@mozilla.org/filepicker;1"].
        createInstance(nsIFilePicker);
        // shelveUtils.debug("shelveUtils pick: fp=", fp);

        var textbox = document.getElementById(cid);
        // shelveUtils.debug("shelveUtils pick: textbox=", textbox);
        var val = textbox.value;
        if (val === "") {
            var prefs = Components.classes["@mozilla.org/preferences-service;1"].
            getService(Components.interfaces.nsIPrefService).getBranch("");
            try {
                val = prefs.getCharPref("browser.download.lastDir");
            } catch (e) {
                val = "";
            }
        }
        // shelveUtils.debug("shelveUtils pick: val=", val);
        var init = shelveUtils.localFile(val);
        var fpMode;

        switch(mode) {
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
            if (init) {
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
        fp.init(window, "Select " + name, fpMode);
        var rv = fp.show();
        // shelveUtils.debug("shelveUtils pick: rv=", rv);
        if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
            // shelveUtils.debug("shelveUtils pick: rv=", fp.file.path);
            textbox.value = fp.file.path;
            switch(mode) {
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
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
        getService(Components.interfaces.nsIWindowMediator);
        var win = wm.getMostRecentWindow('navigator:browser');
        // return win.content;
        return win;
    },

    withBrowserWindows: function(fn) {
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
        getService(Components.interfaces.nsIWindowMediator);
        var enumerator = wm.getEnumerator('navigator:browser');
        while(enumerator.hasMoreElements()) {
            var win = enumerator.getNext();
            fn(win);
        }
    },

    getExtension: function(content_type, mime, doc) {
        // alert("DBG getExtension: "+ content_type +": "+ mime);
        switch(mime) {
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
                if (content_type !== null && content_type.match(/^image/)) {
                    var img_type = content_type.match(/^image\/(.*)$/);
                    return img_type ? ('.' + img_type[1]) : '.gif';
                } else {
                    return '.html';
                }
            }

            case 'text':
            case 'text_latin1':
            return '.txt';

            default:
            return '.html';
        }
    },

    // getContentType: function(url) {
    //     var cs = Components.classes['@mozilla.org/network/content-sniffer;1'].
    //     createInstance(Components.interfaces.nsIContentSniffer);
    //     cs.getMIMETypeFromContent()
    // },

    assert: function(value, expected, text) {
        if (value !== expected) {
            var t = "";
            if (text) {
                t += text +": ";
            }
            try {
                t += "expected "+ uneval(expected) +" but got "+ uneval(value);
            } catch(e) {
                t += "expected "+ expected + " but got "+ value;
            }
            alert(t);
        }
    },

    debug: function(text, value) {
        // var log_level = shelveStore.getBool(null, 'log_level', 1);
        // if (log_level >= 3) {
            try {
                shelveUtils.log("DEBUG: "+ text + uneval(value));
            } catch(e) {
                shelveUtils.log("DEBUG: "+ text + value);
            }
        // }
    },

    log: function(text) {
        var aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].
        getService(Components.interfaces.nsIConsoleService);
        aConsoleService.logStringMessage('Shelve: ' + text);
    },

    localFile: function(path) {
        try {
            if (path != '-') {
                var localFile = Components.classes["@mozilla.org/file/local;1"];
                var file = localFile.createInstance(Components.interfaces.nsILocalFile);
                if (path !== "") {
                    // FIXME
                    file.initWithPath(path);
                }
                return file;
            }
            return null;
        } catch(e) {
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

        var init_flags = init_flags0 === undefined ? 0x02 | 0x10 | 0x08 : init_flags0;
        // shelveUtils.debug('shelveUtils writeTextFile enc=', enc);
        // shelveUtils.debug('shelveUtils writeTextFile init_flags=', init_flags);
        
        if(!file.exists()) {
            file.create(0x00,0644);
        }

        var fos = Components.classes["@mozilla.org/network/file-output-stream;1"].
        createInstance(Components.interfaces.nsIFileOutputStream);
        fos.init(file, init_flags, -1, 0); 

        try {
            if (enc) {
                var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"].
                createInstance(Components.interfaces.nsIConverterOutputStream);
                os.init(fos, enc, 0, "_".charCodeAt(0));
                os.writeString(text);
                os.close();
            } else {
                fos.write(text, text.length);
                fos.close();
            }
            // shelveUtils.debug('shelveUtils writeTextFile ok=', true);
        } catch (ex) {
            shelveUtils.log('Error when writing text file:' +  ex);
        }
    },

    getProfDir: function() {
        var dir = Components.classes["@mozilla.org/file/directory_service;1"].
        getService(Components.interfaces.nsIProperties).
        get("ProfD", Components.interfaces.nsIFile);
        return dir.clone();
    },

    getShelveDir: function() {
        var shelveDir = shelveUtils.getProfDir();
        shelveDir.append("shelve");
        if (!shelveDir.exists()) {
            /*jsl:ignore*/
            shelveDir.create(0x01,0755);
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
        return Components.classes["@mozilla.org/dom/json;1"].
        createInstance(Components.interfaces.nsIJSON);
    },

    getOS: function() {
        // http://developer.mozilla.org/en/docs/Code_snippets:Miscellaneous
        // Returns "WINNT" on Windows Vista, XP, 2000, and NT systems;
        // "Linux" on GNU/Linux; and "Darwin" on Mac OS X.
        var osString = Components.classes["@mozilla.org/xre/app-info;1"].
        getService(Components.interfaces.nsIXULRuntime).OS;
        return osString;
    },

    osString: function(str) {
        if (shelveUtils.getOS() == "WINNT") {
            return str.replace(/\n/g, "\r\n");
        } else {
            return str;
        }
    },

    unixString: function(str) {
        return str.replace(/\r/g, "");
    },

    asISupportsString: function(str) {
        var sstr  = Components.classes['@mozilla.org/supports-string;1'].createInstance(Components.interfaces.nsISupportsString);
        sstr.data = str; 
        return sstr;
    },
    
    encode: function(something) {
        return shelveUtils.json.encode(something);
    },

    decode: function(json) {
        return shelveUtils.json.decode(json);
    },

    escapeChar: function(text, chars) {
        return text.replace(new RegExp('(['+ chars +'])', 'g'), '\\$1');
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
        if ((optional && template === "") || shelveUtils.validTemplate(template, klass) > 0) {
            templateBox.setAttribute('style', '');
            templateBox.setAttribute('tooltiptext', '');
        } else {
            templateBox.setAttribute('style', '-moz-appearance:none; background-color:yellow;');
            templateBox.setAttribute('tooltiptext', shelveUtils.localized('malformed_template'));
        }
    },

    validTemplate: function(template, klass) {
        if (template == "-") {
            return true;
        } else {
            var phn = 0;
            var phs = shelveUtils.validPlaceholders(klass);
            var good_rx = new RegExp('^('+ phs +'|\\['+ phs +'+\\])');
            var text = template;
            var malformed = false;
            while (true) {
                var i = text.indexOf("%");
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
            if (phn === 0 && klass == "logfilename") {
                phn = 1;
            }
            var rv = malformed ? -phn : phn;
            return rv;
        }
    },

    validPlaceholders: function(klass) {
        var chars = "cCDeEfFhBhiIklmMpPqstyY%";
        var names = "clip|clip!|input|subdir|host|hostbasename|query|fullpath|path|filename|basename|ext|title|keywords|fullyear|year|month|day|hours|minutes|secs|msecs";
        switch(klass) {
            case 'log':
            case 'footer':
            chars += "nouv";
            names += "|note|outfile|url|shelf|content";
            break;

            case 'filename':
            case 'logfilename':
            default:
            break;
        }
        return '(['+ chars +']|\\{('+ names +')[!?]?\\})';
    },

    filenameJoin: function(parts) {
        var sep  = shelveUtils.filenameSeparator();
        // return parts.join(sep);
        var acc  = [];
        var last = parts.length - 1;
        for (var i in parts) {
            var p = parts[i];
            if (i < last && p[p.length - 1] != sep) {
                p += sep;
            }
            acc.push(p);
        }
        return acc.join("");
    },

    filenameSeparator: function() {
        if (shelveUtils.getOS() == "WINNT") {
            return '\\';
        } else {
            return '/';
        }
    },

    localized: function(name) {
        var bundles = Components.classes["@mozilla.org/intl/stringbundle;1"].
        getService(Components.interfaces.nsIStringBundleService);  
        var bundle = bundles.createBundle("chrome://shelve/locale/shelve.properties");
        return bundle.GetStringFromName('extensions.shelve.' + name);
    },

    appInfo: function () {
        var info = Components.classes["@mozilla.org/xre/app-info;1"].
        getService(Components.interfaces.nsIXULAppInfo);  
        return info.name + info.version;
    }

};

