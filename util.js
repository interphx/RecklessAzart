var fs = require('fs');
var path = require('path');

var shallowMerge = function(objects) {
    var result = {};
    for (var i = 0; i < objects.length; ++i) {
        var obj = objects[i];
        for (var key in obj) {
            if (!obj.hasOwnProperty(key)) continue;
            result[key] = obj[key];
        }
    }
    return result;
}

var walkSync = function(dir) {
    var path = require('path');
    var results = [];
    var visited_dirs = [];
    var list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        if (visited_dirs.indexOf(file) >= 0) return;
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            visited_dirs.push(file);
            results = results.concat(walkSync(file));
        } else {
            results.push(file);
        } 
    })
    return results;
};

module.exports = {
    walkSync: walkSync,
    shallowMerge: shallowMerge
};