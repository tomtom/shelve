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

var shelveSubstitute = {

    getDB: function() {
        // var dbdir = shelveUtils.getShelveDir();
        var dbdir = shelveUtils.getProfDir();
        var db = dbdir.clone();
        db.append("shelve.sqlite");
        // shelveUtils.debug("shelveSubstitute getDB: db=", db.path);
        var create = !db.exists();
        var storageService = Components.classes["@mozilla.org/storage/service;1"].
        getService(Components.interfaces.mozIStorageService);
        var con = storageService.openDatabase(db);
        if (create) {
            con.executeSimpleSQL(
                'CREATE TABLE IF NOT EXISTS meta ( '+
                '  var VARCHAR(20) NOT NULL, '+
                '  value VARCHAR(255) '+
                ');'+
                'INSERT INTO meta VALUES("schema", "1");'+
                'CREATE TABLE IF NOT EXISTS replacements ( '+
                '  priority INTEGER NOT NULL, '+
                '  url VARCHAR(255) NOT NULL, '+
                '  klass VARCHAR(20) NOT NULL, '+
                '  rx VARCHAR(255) NOT NULL, '+
                '  subst VARCHAR(255), '+
                '  break INTEGER '+
                ');'
            );
        }
        return con;
    },

    selectSubstitutions: function(type, url) {
        var con = shelveSubstitute.getDB();
        if (con) {
            try {
                var statement = con.createStatement(
                    "SELECT r.rx, coalesce(r.subst, ''), coalesce(r.break, 0) "+
                    "FROM replacements r "+
                    "WHERE ?1 LIKE klass ESCAPE '^' AND ?2 LIKE url ESCAPE '^' "+
                    "ORDER BY priority DESC;"
                );
                try {
                    statement.bindUTF8StringParameter(0, type);
                    statement.bindUTF8StringParameter(1, url);
                    var values = [];
                    while (statement.executeStep()) {
                       // shelveUtils.debug('shelveSubstitute selectSubstitutions: ', [statement.getUTF8String(0), statement.getUTF8String(1)].join("; "));
                        values.push([statement.getUTF8String(0), statement.getUTF8String(1)]);
                    }
                    return values;
                } finally {
                    statement.finalize();
                }
            } catch(exception) {
                shelveUtils.log("Error when running sql query: "+ [exception, con.lastError]);
            } finally {
                con.close();
            }
        }
        return null;
    },

    rewrite: function(type, url, value) {
        // shelveUtils.debug('shelveSubstitute rewrite: ', [type, url, value]);
        var val = value;
        var replacements = shelveSubstitute.selectSubstitutions(type, url);
        if (replacements) {
            var rxs;
            var rx;
            var subst;
            var stop;
            for (idx in replacements) {
                [rxs, subst, stop] = replacements[idx];
                rx = new RegExp(rxs, 'g');
                if (val.match(rx)) {
                    // shelveUtils.debug('shelveSubstitute rewrite: ', [rx, subst, stop]);
                    val = val.replace(rx, subst);
                    if (stop) {
                        break;
                    }
                }
            }
        }
        return val;
    }

};

