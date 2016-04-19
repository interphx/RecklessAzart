var fs = require('fs');
var path = require('path');

var hbs = (function() {
    var handlebars = require('handlebars').default;
    var hblayouts = require('handlebars-layouts');
    
    handlebars.registerHelper(hblayouts(handlebars));
    
    var walkSync = require('./util').walkSync;
    var files = walkSync(__dirname + '/templates');
    
    var defaults = {};
    var loaded_templates = {};
    var compiled_templates = {};
    
    files.forEach(function(filename) {
        var file_contents = fs.readFileSync(filename, {encoding: 'utf-8'});
        var basename = path.basename(filename);
        var template_name = basename.substr(0, basename.lastIndexOf('.')) || basename;
        console.log(template_name);
        handlebars.registerPartial(template_name, file_contents);
        loaded_templates[template_name] = file_contents;
        compiled_templates[template_name] = handlebars.compile(file_contents);
    });
    
    defaults.clientTemplates = [];
    for (var key in loaded_templates) {
        if (!loaded_templates.hasOwnProperty(key)) continue;
        var template_text = loaded_templates[key];
        // TODO: This is very unsafe and inconvenient, but will do
        if (template_text.indexOf('{{#block') >= 0      ||
            template_text.indexOf('{{#content') >= 0    ||
            template_text.indexOf('{{#extend') >= 0)
            continue;
        defaults.clientTemplates.push({
            name: key,
            text: template_text
        });
    }
    
    var shallowMerge = require('./util').shallowMerge;
    function prepareData(data) {
        return shallowMerge([defaults, data || {}]);
    }
    
    return {
        handlebars: handlebars,
        render: function(template, data) {
            data = data || {};
            return handlebars.compile(template)(prepareData(data));
        },
        renderTemplate: function(template_name, data) {
            if (typeof template_name !== 'string' || template_name.trim() === '') {
                throw new Error('Template name must be a valid non-empty string!');
            }
            if (!loaded_templates.hasOwnProperty(template_name)) {
                throw new Error('Unknown template: ' + template_name);
            }
            return compiled_templates[template_name](prepareData(data));
        },
        setDefault: function(name, value) {
            defaults[name] = value;
        },
        removeDefault: function(name) {
            delete defaults[name];
        },
        getDefault: function(name) {
            return defaults[name];
        }
    };
})();

module.exports = {
    renderTemplate: hbs.renderTemplate,
    render: hbs.render
};