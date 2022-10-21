var fs = require('fs');
var path = require('path');
var util = require('util');

module.exports = function() {
    var obj = {};

    // plugs keyed by their ordinal (or '$' if no order).
    // each entry will contain an array of plugs for that order.
    var plugs = {};
    
    //
    // loads plugs from a file or directory (recursive)
    //
    // require('/path/to/plugs')
    // require('/path/to/plugs/myplug.js')
    // require([ 'dir1', 'dir2', ... ])
    // require('dir1', 'myplug2.js', ...)
    //
    obj.require = function() {
        var args = [].slice.call(arguments);
        
        args.forEach(function(arg) {
            if (!util.isArray(arg)) arg = [arg];
            arg.forEach(function(what) {

                what = path.resolve(what);
                var stat = fs.statSync(what);
                if (stat.isDirectory()) {
                    var files = fs.readdirSync(what);
                    return files.forEach(function(file) {
                        var filePath = path.join(what, file);
                        obj.require(filePath);
                    });
                }
                else {
                    var basename = path.basename(what);
                    var plugin = parse(basename);
                    if (!plugin) return; // continue
                    plugin.ordinal = plugin.ordinal || '$'; 
                    var bucket = plugs[plugin.ordinal] || (plugs[plugin.ordinal] = []);
                    bucket.push({
                        name: plugin.name,
                        path: what,
                        payload: require(what),
                    });
                }
            });
        });

        return obj.plugs;
    };

    // returns the plugs in a hash ordered by ordinal (unordered last)
    obj.__defineGetter__('plugs', function() {
        var out = {};
        for (var ordinal in plugs) {
            var bucket = plugs[ordinal];
            bucket.forEach(function(plugin) {
                out[plugin.name] = plugin.payload;
            });
        }
        return out;
    });

    // -- private

    // parses a file name  and extracts the name (without .js) and an ordinal (prefix index), if provided.
    function parse(fileName) {
        var extractName = /^(\d+)?\.?(.+)\.js/;
        var match = extractName.exec(fileName);
        return match && {
            name: match[2],
            ordinal: match[1]
        };
    }
    
    return obj;
};