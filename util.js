var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

// TODO: Unsafe, especially for dates. Redo to safe variant
function deepCopyPOD(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function getLocalPath(p) {
    return path.join(global.appRoot || __dirname, p);
}

function writeLocalFile(p, contents, encoding, cb) {
    p = path.join(__dirname, p);
    mkdirp(path.dirname(path.resolve(p)), function(err) {
        if (err) {
            cb(err);
        } else {
            fs.writeFile(path.resolve(p), contents, encoding, cb);
        }
    });
}

function readLocalFile(p, opts, cb) {
    p = path.join(__dirname, p);
    fs.exists(p, opts, function(err, data) {
        cb(err, data);
    });
}

var now = function() {
    return Date.now();
};

var camelCaseToUnderscore = function(s) {
    return s.replace(/\.?([A-Z]+)/g, function (x, y){
        return "_" + y.toLowerCase()
    }).replace(/^_/, "")
};

var shallowMerge = function(objects) {
    if (!objects.length) {
        throw new Error('shallowMerge must receive a collection!');
    }
    var result = {};
    for (var i = 0; i < objects.length; ++i) {
        var obj = objects[i];
        for (var key in obj) {
            if (!obj.hasOwnProperty(key)) continue;
            result[key] = obj[key];
        }
    }
    return result;
};

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
    now: now,
    walkSync: walkSync,
    shallowMerge: shallowMerge,
    camelCaseToUnderscore: camelCaseToUnderscore,
    noop: function() {},
    getLocalPath: getLocalPath,
    writeLocalFile: writeLocalFile,
    readLocalFile: readLocalFile,
    deepCopyPOD: deepCopyPOD
};