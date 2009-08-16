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
/*jsl:import shelveStore.js*/
/*jsl:import shelveUtils.js*/


var editShelf = {

    strings: null,

    onLoad: function() {
        editShelf.strings = document.getElementById("shelve-strings");
        var shelfId = window.arguments[0].inn.item;
        for (var field in shelveStore.fields) {
            // shelveUtils.debug("editShelf: onLoad: field=", field);
            // shelveUtils.debug("editShelf: onLoad: value=", shelveStore.fields[field]);
            var value = shelveStore.get(shelfId, field, shelveStore.fields[field]);
            if (value === true || value === false) {
                document.getElementById(field).checked = value;
            } else {
                document.getElementById(field).value = value;
            }
        }
        var mime     = shelveStore.get(shelfId, 'mime', 'default');
        var mimelist = document.getElementById("mime");
        var mimeitem = document.getElementById("mime" + mime);
        mimelist.selectedItem = mimeitem;
        shelveUtils.validateTemplate(document.getElementById("dir"), false, "filename");
    },

    onOK: function() {
        var shelfId = window.arguments[0].inn.item;
        // shelveUtils.debug("editShelf onOK: shelfId=", shelfId);
        var template = document.getElementById("dir").value;
        // shelveUtils.debug("editShelf onOK: template=", template);
        if (template.match(/\S/)) {
            var name = document.getElementById("name").value || shelfId;
            // shelveUtils.debug("editShelf onOK: name=", name);
            var valid = shelveUtils.validTemplate(template, 'filename');
            if (valid <= 0) {
                alert(shelveUtils.localized('malformed_template'));
                if (valid === 0) {
                    template = shelveUtils.filenameJoin([template.replace(/%/g, '%%'), '%[tF]%e']);
                }
            }
            shelveStore.setUnichar(shelfId, 'dir', template);
            shelveStore.setUnichar(shelfId, 'name', name);
            shelveStore.setUnichar(shelfId, 'rx', document.getElementById("rx").value);
            shelveStore.setUnichar(shelfId, 'footer_text', document.getElementById("footer_text").value);
            shelveStore.setUnichar(shelfId, 'footer_html', document.getElementById("footer_html").value);
            shelveStore.setUnichar(shelfId, 'log_file', document.getElementById("log_file").value);
            shelveStore.setUnichar(shelfId, 'log_template', document.getElementById("log_template").value);
            shelveStore.setBool(shelfId, 'auto', document.getElementById("auto").checked);
            var autoselect = document.getElementById("autoselect").checked;
            shelveStore.setBool(shelfId, 'autoselect', autoselect);
            if (autoselect) {
                shelve.setupAutoSelect();
            }
            var hkk = document.getElementById("hotkey").value;
            var hkc = document.getElementById("hotkey_ctrl").checked;
            var hks = document.getElementById("hotkey_shift").checked;
            var hka = document.getElementById("hotkey_alt").checked;
            var hkm = document.getElementById("hotkey_meta").checked;
            var hk0 = shelveStore.get(shelfId, 'hotkey', null);
            // shelveUtils.debug("editShelf onOK: hkk=", hkk);
            if (hkk && hkk.match(/\S/)) {
                if (hkk != hk0 || 
                hka != shelveStore.get(shelfId, 'hotkey_alt', false) || 
                hkc != shelveStore.get(shelfId, 'hotkey_ctrl', false) || 
                hks != shelveStore.get(shelfId, 'hotkey_shift', false) || 
                hkm != shelveStore.get(shelfId, 'hotkey_meta', false)) {
                    var hkd = {
                        hotkey: hkk,
                        alt: false,
                        ctrl: false,
                        shift: false,
                        meta: false
                    };
                    shelveStore.setUnichar(shelfId, 'hotkey', hkk);
                    if (hka) {
                        shelveStore.setBool(shelfId, 'hotkey_alt', true);
                        hkd.alt = true;
                    } else {
                        shelveStore.clear(shelfId, 'hotkey_alt');
                    }
                    if (hkc) {
                        shelveStore.setBool(shelfId, 'hotkey_ctrl', true);
                        hkd.ctrl = true;
                    } else {
                        shelveStore.clear(shelfId, 'hotkey_ctrl');
                    }
                    if (hks) {
                        shelveStore.setBool(shelfId, 'hotkey_shift', true);
                        hkd.shift = true;
                    } else {
                        shelveStore.clear(shelfId, 'hotkey_shift');
                    }
                    if (hkm) {
                        shelveStore.setBool(shelfId, 'hotkey_meta', true);
                        hkd.meta = true;
                    } else {
                        shelveStore.clear(shelfId, 'hotkey_meta');
                    }
                    shelveUtils.withBrowserWindows(
                        function(win) { win.shelve.registerHotkeyForShelf(name, hkd); }
                    );
                }
            } else if (hk0 && hk0.match(/\S/)) {
                shelveUtils.withBrowserWindows(
                    function(win) { win.shelve.removeHotkeyForShelf(name); }
                );
                shelveStore.clear(shelfId, 'hotkey');
                shelveStore.clear(shelfId, 'hotkey_alt');
                shelveStore.clear(shelfId, 'hotkey_ctrl');
                shelveStore.clear(shelfId, 'hotkey_shift');
                shelveStore.clear(shelfId, 'hotkey_meta');
            }
            var mimetype = document.getElementById("mime").selectedItem;
            if (mimetype) {
                var mime = mimetype.value;
                if (mime != 'default') {
                    shelveStore.setUnichar(shelfId, 'mime', mime);
                } else {
                    shelveStore.clear(shelfId, 'mime');
                }
            }
            // shelveUtils.debug("editShelf onOK: ok=", true);
            window.arguments[0].out = {ok: true};
        }
    }
};

