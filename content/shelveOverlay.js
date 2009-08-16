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
/*jsl:declare gContextMenu*/ 
/*jsl:import shelveStore.js*/
/*jsl:import shelve.js*/


var shelveOverlay = {

    initialized: false,

    onLoad: function() {
        // initialization code
        shelveOverlay.initialized = true;
        shelveOverlay.strings = document.getElementById("shelve-strings");
        shelve.setupHotkeys();
        shelve.setupAutoshelf();
        shelve.setupAutoSelect();
        shelve.setupPopup();
    },

    onMenuItemCommand: function() {
        shelve.savePage();
    },

    onToolbarButtonCommand: function() {
        shelveOverlay.onMenuItemCommand();
        // TODO: <ctrl-mouseleft> ... switch back on auto-shelve
    },

    onPopupSelection: function(ev) {
        shelve.saveSelection();
    },

    onPopupLink: function(ev) {
        var title = gContextMenu.target.title || gContextMenu.target.innerHTML.toString();
        if (!title && gContextMenu.onImage) {
            title = shelveOverlay.imageTitle(gContextMenu.target);
        }
        if (title == gContextMenu.linkURL) {
            title = "";
        }
        shelve.saveURL(null, gContextMenu.linkURL, title);
    },

    onPopupImage: function(ev) {
        var contentType = 'image';
        var imageCache = Components.classes["@mozilla.org/image/cache;1"].
        getService(Components.interfaces.imgICache);
        var ioService = Components.classes["@mozilla.org/network/io-service;1"].
        getService(Components.interfaces.nsIIOService);
        var url = gContextMenu.target.src;
        var uri = ioService.newURI(url, null, null);
        var props = imageCache.findEntryProperties(uri);
        if (props) {
            contentType = props.get("type", Components.interfaces.nsISupportsCString).toString();
        }
        var title = shelveOverlay.imageTitle(gContextMenu.target, url);
        shelve.saveURL(contentType, gContextMenu.target.src, title);
    },

    onHotKey: function() {
        shelveOverlay.onMenuItemCommand();
    },

    imageTitle: function(image, url) {
        if (image.title && image.title != url) {
            return image.title;
        } else if (image.alt && image.alt != url) {
            return image.alt;
        } else {
            return "";
        }
    }

};

window.addEventListener("load", function(e) { shelveOverlay.onLoad(e); }, false);
