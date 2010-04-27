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
/*jsl:declare Components*/ 
/*jsl:import shelveStore.js*/
/*jsl:import shelveUtils.js*/


var shelveStore = {
    
    fields: {
        'name': '',
        'dir': '',
        'rx': '',
        'mime': '',
        'log_file': '',
        'log_template': '',
        'footer_text': '',
        'footer_html': '',
        'auto': false,
        'autoselect': false,
        'noautosave': false,
        'autocontinue': false,
        'overwrite': true,
        'hotkey': '',
        'hotkey_alt': false,
        'hotkey_ctrl': false,
        'hotkey_shift': false,
        'hotkey_meta': false
    },

    prefs: null,

    data: null,

    init: function() {
        if (!shelveStore.data) {
            shelveStore.data = Components.classes["@mozilla.org/preferences-service;1"].
            getService(Components.interfaces.nsIPrefService).getBranch("extensions.shelve.");
        }
    },

    max: function() {
        return shelveStore.getInt(null, 'max', 0);
    },

    setMax: function(value) {
        return shelveStore.setInt(null, 'max', value);
    },

    newIndex: function() {
        var max = shelveStore.max();
        var newIdx = null;
        for (var shelfId = 1; shelfId <= max; shelfId++) {
            if (!shelveStore.get(shelfId, 'dir', null) && !shelveStore.get(shelfId, 'name', null)) {
                newIdx = shelfId;
                break;
            }
        }
        if (!newIdx) {
            newIdx = max + 1;
            shelveStore.setMax(newIdx);
        }
        return "" + newIdx;
    },

    copy: function(thisShelfId, thatShelfId) {
        for (var name in shelveStore.fields) {
            var cval = shelveStore.get(thisShelfId, name, null);
            if (cval) {
                var type = shelveStore.getType(thisShelfId, name);
                shelveStore.set(thatShelfId, name, type, cval);
            } else if (shelveStore.get(thatShelfId, name, null)) {
                shelveStore.clear(thatShelfId, name);
            }
        }
    },

    remove: function(shelfId) {
        for (var name in shelveStore.fields) {
            shelveStore.clear(shelfId, name);
        }
    },

    getDefault: function(field) {
        // TODO: throw an exception if the field/key doesn't exist
        return shelveStore.fields[field];
    },

    prefName: function(shelfId, pname) {
        var name = shelfId ? (pname + shelfId) : pname;
        return name;
    },

    clear: function(shelfId, pname) {
        var name = shelveStore.prefName(shelfId, pname);
        // if (shelveStore.data.getPrefType(name)) {
        if (shelveStore.data.prefHasUserValue(name)) {
            shelveStore.data.clearUserPref(name);
        }
    },

    setInt: function(shelfId, pname, value) {
        if (value) {
            var name = shelveStore.prefName(shelfId, pname);
            shelveStore.data.setIntPref(name, value);
        } else {
            shelveStore.clear(shelfId, pname);
        }
    },

    setBool: function(shelfId, pname, value) {
        var name = shelveStore.prefName(shelfId, pname);
        if (value) {
            shelveStore.data.setBoolPref(name, value);
        } else {
            shelveStore.clear(shelfId, pname);
        }
    },

    setString: function(shelfId, pname, value) {
        if (value) {
            return shelveStore.data.setCharPref(shelveStore.prefName(shelfId, pname), value);
        } else {
            shelveStore.clear(shelfId, pname);
            return null;
        }
    },

    setUnichar: function(shelfId, pname, value) {
        var name = shelveStore.prefName(shelfId, pname);
        // alert(name +": "+ value)
        if (value) {
            var str = Components.classes["@mozilla.org/supports-string;1"].
            createInstance(Components.interfaces.nsISupportsString);
            str.data = value;
            shelveStore.data.setComplexValue(name, Components.interfaces.nsISupportsString, str);
        } else {
            shelveStore.clear(shelfId, pname);
        }
    },

    getString: function(shelfId, pname, defaultValue) {
        var name = shelveStore.prefName(shelfId, pname);
        if (shelveStore.data.getPrefType(name) == shelveStore.data.PREF_STRING) {
            return shelveStore.data.getCharPref(name);
        } else {
            return defaultValue;
        }
    },

    getBool: function(shelfId, pname, defaultValue) {
        var name = shelveStore.prefName(shelfId, pname);
        if (shelveStore.data.getPrefType(name) == shelveStore.data.PREF_BOOL) {
            return shelveStore.data.getBoolPref(name);
        } else {
            return defaultValue;
        }
    },

    getInt: function(shelfId, pname, defaultValue) {
        var name = shelveStore.prefName(shelfId, pname);
        if (shelveStore.data.getPrefType(name) == shelveStore.data.PREF_INT) {
            return shelveStore.data.getIntPref(name);
        } else {
            return defaultValue;
        }
    },

    getUnichar: function(shelfId, pname, defaultValue) {
        var name = shelveStore.prefName(shelfId, pname);
        try {
            if (shelveStore.data.getPrefType(name)) {
                var val = shelveStore.data.getComplexValue(name, Components.interfaces.nsISupportsString);
                if (val) {
                    return val.data;
                }
            }
        } catch(e) {
            // throw('Shelve: getUnichar("' + name +'", '+ String(defaultValue) +') :' + e);
            shelveUtils.log('getUnichar("' + name +'", '+ String(defaultValue) +') :' + e);
        }
        return defaultValue;
    },

    getType: function(shelfId, pname) {
        var name = shelveStore.prefName(shelfId, pname);
        return shelveStore.data.getPrefType(name);
    },

    get: function(shelfId, pname, defaultValue) {
        var name = shelveStore.prefName(shelfId, pname);
        // TODO: Comment out before release
        // if (!shelveStore.data.prefHasUserValue(name) && shelveStore.data.getPrefType(name) !== 0) {
        //     // shelveUtils.debug("shelveStore.get name=", name);
        //     // shelveUtils.debug("shelveStore.get preftype=", shelveStore.data.getPrefType(name));
        //     alert("shelveStore.get "+ name +" type="+ shelveStore.data.getPrefType(name));
        // }
        try {
            // if (shelveStore.data.prefHasUserValue(name)) {
                switch(shelveStore.data.getPrefType(name)) {

                    case shelveStore.data.PREF_INVALID:
                    return defaultValue;

                    // case shelveStore.data.PREF_STRING:
                    // return shelveStore.getString(shelfId, pname, defaultValue);

                    case shelveStore.data.PREF_INT:
                    return shelveStore.getInt(shelfId, pname, defaultValue);

                    case shelveStore.data.PREF_BOOL:
                    return shelveStore.getBool(shelfId, pname, defaultValue);
                    
                    case 0:
                    return defaultValue;

                    default:
                    return shelveStore.getUnichar(shelfId, pname, defaultValue);
                }
            // }
        } catch(e) {
            shelveUtils.log('get("' + name +'", '+ String(defaultValue) +') :' + e);
        }
        return defaultValue;
    },

    getMime: function(shelfId) {
        var mime = shelveStore.get(shelfId, 'mime', null);
        if (!mime) {
            mime = shelveStore.get(null, 'mime', 'default');
        }
        return mime;
    },

    getDescription: function(shelfId) {
        // String(shelfId % 10)
        var desc = shelveStore.get(shelfId, 'name', shelfId);
        var auto = shelveStore.get(shelfId, 'autoselect', false);
        if (auto) {
            desc += '*';
        }
        var hk   = shelveStore.get(shelfId, 'hotkey', null);
        if (hk) {
            desc += ' <';
            if (shelveStore.get(shelfId, 'hotkey_alt', false)) { desc += 'ALT+'; }
            if (shelveStore.get(shelfId, 'hotkey_ctrl', false)) { desc += 'CTRL+'; }
            if (shelveStore.get(shelfId, 'hotkey_shift', false)) { desc += 'SHIFT+'; }
            if (shelveStore.get(shelfId, 'hotkey_meta', false)) { desc += 'META+'; }
            desc += hk + '>';
        }
        desc += ': ' + shelveStore.get(shelfId, 'dir', '');
        return desc;
    },

    set: function(shelfId, pname, type, value) {
        var name = shelveStore.prefName(shelfId, pname);
        try {
            switch(type) {
                case shelveStore.data.PREF_INVALID:
                return null;

                // case shelveStore.data.PREF_STRING:
                // return shelveStore.setString(shelfId, pname, value);

                case shelveStore.data.PREF_INT:
                return shelveStore.setInt(shelfId, pname, value);

                case shelveStore.data.PREF_BOOL:
                return shelveStore.setBool(shelfId, pname, value);

                default:
                return shelveStore.setUnichar(shelfId, pname, value);
            }
        } catch(e) {
            shelveUtils.log('set("' + name +'", '+ String(value) +'/'+ type +') :' + e);
        }
        return null;
    }

};

shelveStore.init();
