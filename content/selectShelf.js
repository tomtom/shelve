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
/*jsl:import shelveUtils.js*/


var selectShelf = {
    finalized: false,
    auto: null,
    mime_fix: false,
    mime0: null,
    mime: null,

    onLoad: function() {
        document.getElementById("clip").value = window.arguments[0].inn.clip;
        document.getElementById("title").value = window.arguments[0].inn.title;
        shelveUtils.checkMafMimeItems(document);
        selectShelf.mime0 = window.arguments[0].inn.mime;
        selectShelf.mime_fix = window.arguments[0].inn.mime_fix;
        // shelveUtils.debug("selectShelf.onLoad mime0=", selectShelf.mime0);
        // selectShelf.mime = selectShelf.mime0 || 'default';
        selectShelf.mime = 'default';
        // shelveUtils.debug("selectShelf.onLoad mime=", selectShelf.mime);
        selectShelf.dlgSetMime(selectShelf.mime);
        var autoPilot = window.arguments[0].inn.autoPilot;
        // shelveUtils.debug("selectShelf.onLoad: autoPilot=", autoPilot);
        var selectedIndex = 0;
        var list = window.arguments[0].inn.list;
        var shelfNos = window.arguments[0].inn.shelfNos;
        var listbox = document.getElementById("theShelves");
        // shelveUtils.debug("shelveUtils.onLoad: suppressonselect=", listbox.suppressonselect);
        // shelveUtils.debug("shelveUtils.onLoad: seltype=", listbox.seltype);
        for (var i = 0; i < list.length; i++) {
            listbox.appendItem(list[i], shelfNos[i]);
            // shelveUtils.debug("selectShelf.onLoad: shelfNos["+ i +"]=", shelfNos[i]);
            if (autoPilot && shelfNos[i] === autoPilot) {
                selectedIndex = i;
            }
        }
        // shelveUtils.selectListboxItem(listbox, selectedIndex);
        if (autoPilot) {
            selectShelf.selectThisShelf(autoPilot, false, true);
            // document.getElementById("auto").checked = true;
        } else if (shelfNos.length > 0) {
            selectShelf.selectThisShelf(""+ shelfNos[0], false, true);
        }
        // shelveUtils.selectListboxItem(listbox, selectedIndex);
        selectShelf.finalized = false;
    },

    onDblClick: function() {
        var dialog = document.getElementById("selectShelf");
        return dialog.acceptDialog();
    },

    onOK: function() {
        // shelveUtils.debug("onOK1 filename=", filename);
        // shelveUtils.debug("onOK1 ext=", selectShelf.getExtension());
        var listbox = document.getElementById("theShelves");
        var shelfIndex = listbox.selectedIndex;
        if (shelfIndex < 0) {
            alert(shelveUtils.localized("select.shelf"));
            return false;
        } else if (selectShelf.finalized || selectShelf.onSelect(true, false)) {
            var filename = document.getElementById("filename").value;
            // shelveUtils.debug("onOK2 filename=", filename);
            // shelveUtils.debug("onOK2 ext=", selectShelf.getExtension());
            window.arguments[0].sp_params = {
                doc: window.arguments[0].inn.doc,
                filename: filename,
                mime: selectShelf.getMime(),
                shelf: selectShelf.getShelfId(),
                template: selectShelf.getTemplate(),
                extension: selectShelf.getExtension(),
                title: document.getElementById("title").value,
                clip: document.getElementById("clip").value,
                auto: document.getElementById("auto").checked,
                note: document.getElementById("text_note").value
            };
            return true;
        } else {
            return false;
        }
    },

    onCancel: function() {
        window.arguments[0].sp_params = null;
    },

    selectThisShelf: function(shelfId, interactive, setmime) {
        // shelveUtils.debug("selectShelf.selectThisShelf shelfId=", shelfId);
        // shelveUtils.debug("selectThisShelf interactive=", interactive);
        // shelveUtils.debug("selectThisShelf setmime=", setmime);
        try {
            // selectShelf.alertMime("onSelect 1");
            var mime;
            // shelveUtils.debug("selectThisShelf mime0=", selectShelf.mime0);
            // if (setmime && (selectShelf.mime0 === null || selectShelf.mime0 === 'default')) {
                if (!selectShelf.mime_fix) {
                    mime = shelveStore.get(shelfId, 'mime', selectShelf.mime);
                    // shelveUtils.debug("selectThisShelf mime=", mime);
                    selectShelf.dlgSetMime(mime);
                }
                // shelveUtils.debug("selectShelf selectThisShelf: auto=", selectShelf.auto);
                if (selectShelf.auto === null) {
                    // shelveUtils.debug("selectShelf selectThisShelf: shelf.auto=", shelveStore.get(shelfId, 'auto', false));
                    document.getElementById("auto").checked = shelveStore.get(shelfId, 'auto', false);
                }
                var template = selectShelf.getTemplate(shelfId);
                // shelveUtils.debug("selectThisShelf template=", template);
                if (template) {
                    var et_params = {
                        doc: window.arguments[0].inn.doc,
                        template: template,
                        interactive: interactive,
                        title: document.getElementById("title").value,
                        clip: document.getElementById("clip").value,
                        mime: selectShelf.getMime(),
                        extension: selectShelf.getExtension(),
                        parentWindow: window
                    };
                    var filename = window.arguments[0].inn.shelve.expandTemplate(et_params);
                    // shelveUtils.debug("selectThisShelf filename=", filename);
                    document.getElementById("filename").value = filename;
                }
                // if (!interactive) {
                //     var listbox = document.getElementById("theShelves");
                //     shelveUtils.selectListboxItem(listbox, shelveUtils.getShelfListindex(listbox, shelfId));
                // }
            return true;
        } catch(e) {
            // alert(e);
            throw(e);
            // return false;
        }
    },

    onSelect: function(interactive, setmime) {
        return selectShelf.selectThisShelf(selectShelf.getShelfId(), interactive, setmime);
    },

    onSelectAuto: function() {
        selectShelf.auto = document.getElementById("auto").checked;
        return selectShelf.onSelect(false, false);
    },

    onFinalize: function() {
        if (!selectShelf.finalized){
            selectShelf.onSelect(true, false);
            selectShelf.finalized = true;
        }
    },

    onSelectMime: function() {
        selectShelf.mime = selectShelf.getMime();
        selectShelf.onSelect(false, false);
    },

    create: function() {
        var listbox = document.getElementById("theShelves");
        shelveUtils.createNewShelf(listbox);
    },
    
    clone: function() {
        var listbox = document.getElementById("theShelves");
        shelveUtils.cloneSelected(listbox);
    },


    getShelfId: function() {
        var listbox = document.getElementById("theShelves");
        var shelfIndex = listbox.selectedIndex;
        // shelveUtils.debug("selectShelf getShelfId shelfIndex Index=", shelfIndex);
        if (shelfIndex >= 0) {
            // var rv1 = window.arguments[0].inn.shelfNos[shelfIndex];
            // shelveUtils.debug("selectShelf getShelfId rv1=", rv1);
            var rv2 = listbox.selectedItem.value;
            // shelveUtils.debug("selectShelf getShelfId rv2=", rv2);
            return rv2;
        } else {
            return null;
        }
    },

    getListIndexForShelfNumber: function(shelfId) {
        // shelveUtils.debug("getListIndexForShelfNumber shelfId=", shelfId);
        var shelfNos = window.arguments[0].inn.shelfNos;
        // shelveUtils.debug("getListIndexForShelfNumber shelfNos=", shelfNos);
        for (var e in shelfNos) {
            if (shelfNos[e] === shelfId) {
                e = parseInt(e, 10);
                // shelveUtils.debug("getListIndexForShelfNumber e=", e);
                return e;
            }
        }
        return 0;
    },

    getTemplate: function(shelfId) {
        // shelveUtils.debug("selectShelf: getTemplate: shelfId=", shelfId);
        var shelfIndex = 0;
        if (shelfId) {
            var listbox = document.getElementById("theShelves");
            shelfIndex = listbox.selectedIndex;
        } else {
            shelfIndex = selectShelf.getListIndexForShelfNumber(shelfId);
        }
        // shelveUtils.debug("selectShelf: getTemplate: shelfIndex=", shelfIndex);
        if (shelfIndex >= 0) {
            return window.arguments[0].inn.shelves[shelfIndex];
        } else {
            return null;
        }
    },

    dlgSetMime: function(mime) {
        // selectShelf.alertMime("dlgSetMime1 "+ mime);
        var mimelist = document.getElementById("mime");
        if (!mimelist.disabled) {
            // if (selectShelf.mime0 == 'binary') {
            // if (selectShelf.mime0 != 'default') {
            if (selectShelf.mime_fix) {
                mimelist.disabled = true;
            } else {
                var mimeitem = document.getElementById("mime" + mime);
                mimelist.selectedItem = mimeitem;
            }
            // selectShelf.alertMime("dlgSetMime2");
        }
    },

    getMime: function() {
        if (selectShelf.mime0 == "binary") {
            return selectShelf.mime0;
        } else {
            var mimetype = document.getElementById("mime").selectedItem;
            // shelveUtils.debug("selectShelf.getMime mimetype=", mimetype);
            var mime = mimetype ? mimetype.value : (selectShelf.mime || 'default');
            // shelveUtils.debug("selectShelf.getMime mime=", mime);
            return mime == "default" ? selectShelf.mime0 : mime;
        }
    },

    getExtension: function() {
        var type = window.arguments[0].inn.content_type;
        var mime = selectShelf.mime0 === 'binary' ? 'binary' : selectShelf.getMime();
        var doc = window.arguments[0].inn.doc;
        return shelveUtils.getExtension(type, mime, doc);
    },

    alertMime: function(prefix) {
        var mime = document.getElementById("mime").selectedItem;
        alert(prefix +": "+ (mime && mime.value) +" -- "+ selectShelf.mime);
    }

};

