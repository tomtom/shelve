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
    mime0: null,
    mime: null,

    onLoad: function() {
        document.getElementById("clip").value = window.arguments[0].inn.clip;
        document.getElementById("title").value = window.arguments[0].inn.title;
        selectShelf.mime0 = window.arguments[0].inn.mime;
        selectShelf.mime = selectShelf.mime0 || 'default';
        selectShelf.dlgSetMime(selectShelf.mime);
        var autoPilot = window.arguments[0].inn.autoPilot;
        // shelveUtils.debug("selectShelf.onLoad: autoPilot=", autoPilot);
        var selectThisShelf = -1;
        var list = window.arguments[0].inn.list;
        var shelfNos = window.arguments[0].inn.shelfNos;
        var listbox = document.getElementById("theShelves");
        // shelveUtils.debug("shelveUtils.onLoad: suppressonselect=", listbox.suppressonselect);
        // shelveUtils.debug("shelveUtils.onLoad: seltype=", listbox.seltype);
        for (var i = 0; i < list.length; i++) {
            listbox.appendItem(list[i], i);
            // shelveUtils.debug("selectShelf.onLoad: shelfNos["+ i +"]=", shelfNos[i]);
            if (autoPilot && shelfNos[i] === autoPilot) {
                selectThisShelf = i;
            }
        }
        // listbox.selectItem(listbox.getItemAtIndex(0));
        // selectShelf.selectThisShelf(0, false, true);
        // shelveUtils.debug("shelveUtils.onLoad: selectThisShelf=", selectThisShelf);
        // if (selectThisShelf >= 0) {
        //     listbox.selectItem(listbox.getItemAtIndex(selectThisShelf));
        //     // var e = document.createEvent("Event");
        //     // e.initEvent("change", true, false);
        //     // listbox.dispatchEvent(e);
        //     shelveUtils.debug("shelveUtils.onLoad: selectedIndex=", listbox.selectedIndex);
        // }
        if (autoPilot) {
            selectShelf.selectThisShelf(autoPilot, false, true);
            document.getElementById("auto").checked = true;
        }
        selectShelf.finalized = false;
    },

    onDblClick: function() {
        var dialog = document.getElementById("selectShelf");
        return dialog.acceptDialog();
    },

    onOK: function() {
        // shelveUtils.debug("onOK1 filename=", filename);
        // shelveUtils.debug("onOK1 ext=", selectShelf.getExtension());
        if (selectShelf.finalized || selectShelf.onSelect(true, false)) {
            var filename = document.getElementById("filename").value;
            // shelveUtils.debug("onOK2 filename=", filename);
            // shelveUtils.debug("onOK2 ext=", selectShelf.getExtension());
            window.arguments[0].sp_params = {
                doc: window.arguments[0].inn.doc,
                filename: filename,
                mime: selectShelf.getMime(),
                shelf: selectShelf.getShelfIndex(),
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

    selectThisShelf: function(shelf, interactive, setmime) {
        // shelveUtils.debug("selectThisShelf shelf=", shelf);
        // shelveUtils.debug("selectThisShelf interactive=", interactive);
        // shelveUtils.debug("selectThisShelf setmime=", setmime);
        try {
            // selectShelf.alertMime("onSelect 1");
            var mime;
            // shelveUtils.debug("selectThisShelf mime0=", selectShelf.mime0);
            if (setmime && (selectShelf.mime0 === null || selectShelf.mime0 === 'default')) {
                mime = shelveStore.get(shelf, 'mime', selectShelf.mime);
                // shelveUtils.debug("selectThisShelf mime=", mime);
                selectShelf.dlgSetMime(mime);
            }
            // shelveUtils.debug("selectShelf selectThisShelf: auto=", selectShelf.auto);
            if (selectShelf.auto === null) {
                // shelveUtils.debug("selectShelf selectThisShelf: shelf.auto=", shelveStore.get(shelf, 'auto', false));
                document.getElementById("auto").checked = shelveStore.get(shelf, 'auto', false);
            }
            var template = selectShelf.getTemplate(shelf);
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
            return true;
        } catch(e) {
            // alert(e);
            throw(e);
            // return false;
        }
    },

    onSelect: function(interactive, setmime) {
        return selectShelf.selectThisShelf(selectShelf.getShelfIndex(), interactive, setmime);
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

    getShelfIndex: function() {
        var listbox = document.getElementById("theShelves");
        var shelfNo = listbox.selectedIndex;
        // shelveUtils.debug("selectShelf getShelfIndex shelfNo Index=", shelfNo);
        if (shelfNo >= 0) {
            // shelveUtils.debug("selectShelf getShelfIndex shelf=", window.arguments[0].inn.shelfNos[shelfNo]);
            return window.arguments[0].inn.shelfNos[shelfNo];
        } else {
            return null;
        }
    },

    getShelfIndexForShelfNumber: function(shelf) {
        var shelfNos = window.arguments[0].inn.shelfNos;
        for (var e in shelfNos) {
            if (shelfNos[e] === shelf) {
                return e;
            }
        }
        return 0;
    },

    getTemplate: function(shelf) {
        // shelveUtils.debug("selectShelf: getTemplate: shelf=", shelf);
        var shelfNo = 0;
        if (shelf >= 0) {
            shelfNo = selectShelf.getShelfIndexForShelfNumber(shelf);
        } else {
            var listbox = document.getElementById("theShelves");
            shelfNo = listbox.selectedIndex;
        }
        // shelveUtils.debug("selectShelf: getTemplate: shelfNo=", shelfNo);
        if (shelfNo >= 0) {
            return window.arguments[0].inn.shelves[shelfNo];
        } else {
            return null;
        }
    },

    dlgSetMime: function(mime) {
        // selectShelf.alertMime("dlgSetMime1 "+ mime);
        var mimelist = document.getElementById("mime");
        if (!mimelist.disabled) {
            if (mime == 'binary') {
                mimelist.disabled = true;
            } else {
                var mimeitem = document.getElementById("mime" + mime);
                mimelist.selectedItem = mimeitem;
            }
            // selectShelf.alertMime("dlgSetMime2");
        }
    },

    getMime: function() {
        var mimetype = document.getElementById("mime").selectedItem;
        // selectShelf.alertMime("getMime1");
        if (mimetype) {
            return mimetype.value;
        } else {
            // selectShelf.alertMime("getMime2");
            return selectShelf.mime || 'default';
        }
    },

    getExtension: function() {
        var type = window.arguments[0].inn.content_type;
        var mime = window.arguments[0].inn.mime == 'binary' ? 'binary' : selectShelf.getMime();
        var doc = window.arguments[0].inn.doc;
        return shelveUtils.getExtension(type, mime, doc);
    },

    alertMime: function(prefix) {
        var mime = document.getElementById("mime").selectedItem;
        alert(prefix +": "+ (mime && mime.value) +" -- "+ selectShelf.mime);
    }

};

