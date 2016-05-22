var fs = require('fs');
var path = require('path');
var config = require('./config');
var util = require('./util');

var hbs = (function() {
    var CLIENT_ONLY = config.rendering.clientOnly;
    
    var handlebars = require('handlebars').default;
    var hblayouts = require('handlebars-layouts');
    
    handlebars.registerHelper(hblayouts(handlebars));
    handlebars.registerHelper('jsonify', function(context) {
        return JSON.stringify(context);
    });
    handlebars.registerHelper('lt', function(a, b, options) { return a < b ? options.fn(this) : options.inverse(this); });
    handlebars.registerHelper('lte', function(a, b, options) { return a <= b ? options.fn(this) : options.inverse(this); });
    handlebars.registerHelper('eq', function(a, b, options) { return a == b ? options.fn(this) : options.inverse(this); });
    handlebars.registerHelper('equiv', function(a, b, options) { return a === b ? options.fn(this) : options.inverse(this); });
    handlebars.registerHelper('gte', function(a, b, options) { return a >= b ? options.fn(this) : options.inverse(this); });
    handlebars.registerHelper('gt', function(a, b, options) { return a > b ? options.fn(this) : options.inverse(this); });
    handlebars.registerHelper('neq', function(a, b, options) { return a != b ? options.fn(this) : options.inverse(this); });
    handlebars.registerHelper('nequiv', function(a, b, options) { return a !== b ? options.fn(this) : options.inverse(this); });
    
    handlebars.registerHelper('and', function(a, b, options) { return a && b ? options.fn(this) : options.inverse(this); });
    handlebars.registerHelper('or', function(a, b, options) { return a || b ? options.fn(this) : options.inverse(this); });
    
    //var cond_operator_regex = /{{\s*#\s*if\s*([^\{\}\!\=\<\>\&\|]+)\s*([\!\=\<\>\&\|]+)\s*([^\{\}]+)\s*}}/ig;
    //var cond_closed_operator_regex = /{{\s*#\s*if\s*([^\{\}\!\=\<\>\&\|]+)\s*([\!\=\<\>\&\|]+)\s*([^\{\}]+)\s*}}(.*){{\s*\/\s*if\s*}}/ig;
    var cond_closed_operator_regex = /{{\s*#\s*if\s*([^\{\}\!\=\<\>\&\|]+)\s*([\!\=\<\>\&\|]+)\s*([^\{\}]+)\s*}}([\s\S]*?){{\s*\/\s*if\s*}}/ig;
    function ractive2handlebars(s, _depth) {
        if (_depth == null) _depth = 0;
        if (_depth >= 30) {
            console.log('FUCK! TEMPLATE HANDLEBARS REPLACER REACHED 30 DEPTH!');
            return s;
        }
        var result = s;
        
        var result = result.replace(cond_closed_operator_regex, function(match, lhs, op, rhs, body) {

            if (!body) return match;
            var helper = ({
                '<': 'lt',
                '<=': 'lte',
                '==': 'eq',
                '===': 'equiv',
                '>=': 'gte',
                '>': 'gt',
                '!=': 'neq',
                '!==': 'nequiv',
                '&&': 'and',
                '||': 'or'
            })[op.trim()];
            if (!helper) return match;
            return '{{#' + helper + ' ' + lhs + ' ' + rhs + '}}' + body + '{{/' + helper +  '}}';
        });
        if (result !== s) return ractive2handlebars(result, _depth + 1);
        //console.log(result);
        return result;
    }
    
    var walkSync = require('./util').walkSync;
    var files = walkSync(__dirname + '/templates');
    
    var defaults = {
        clientTemplates: []
    };
    var loaded_templates = {};
    var compiled_templates = {};
    
    // TODO: Synchronous loading will fail horribly on large amount of clients
    function loadTemplate(template_name, _loaded) {
        if (!_loaded) _loaded = [];
        if (_loaded.indexOf(template_name) >= 0) return;
        _loaded.push(template_name);
        console.log('Actually loading template ', template_name);
        var filename = util.getLocalPath('templates/' + template_name + '.html');
        var file_contents = fs.readFileSync(filename, {encoding: 'utf-8'});
        handlebars.unregisterPartial(template_name);
        console.log(filename);
        
        // Partials
        var used_partial_match;
        var used_partial_re = /\{\{\s*\>\s*([a-zA-Z0-9\_\-\.\!\?]+)\s*\}\}/ig;
        while((used_partial_match = used_partial_re.exec(file_contents)) !== null) {
            console.log(used_partial_match[1]);
            if (used_partial_match.length < 2) continue;
            var nested_template_name = used_partial_match[1].trim();
            loadTemplate(nested_template_name, _loaded);
        }
        
        // Parents
        var used_parent_match;
        var used_parent_re = /\{\{\s*\#\s*extend\s+['"]?([a-zA-Z0-9\_\-\.\!\?]+)['"]?\s*\}\}/ig;
        while((used_parent_match = used_parent_re.exec(file_contents)) !== null) {
            console.log(used_parent_match[1]);
            if (used_parent_match.length < 2) continue;
            var nested_template_name = used_parent_match[1].trim();
            loadTemplate(nested_template_name, _loaded);
        }
        
        loaded_templates[template_name] = file_contents.replace(/\{\{\s*\>\s*([a-zA-Z0-9\_\-\.\!\?]+)\s*\}\}/ig, function(match, partial) {
            if (CLIENT_ONLY.indexOf(partial) >= 0) return '';
            return match;
        });
        if (CLIENT_ONLY.indexOf(template_name) < 0) {
            compiled_templates[template_name] = handlebars.compile(file_contents);
        }
        handlebars.registerPartial(template_name, ractive2handlebars(file_contents));
        
        // TODO: Probably change this list to map
        if (file_contents.indexOf('{{#block') < 0      &&
            file_contents.indexOf('{{#content') < 0    &&
            file_contents.indexOf('{{#extend') < 0) {
            var idx = defaults.clientTemplates.findIndex((x) => {return x.name === template_name});
            if (idx >= 0) {
                defaults.clientTemplates.splice(idx, 1);
            }
            defaults.clientTemplates.push({name: template_name, text: file_contents});
        }
    }
    
    files.forEach(function(filename) {
        //var file_contents = fs.readFileSync(filename, {encoding: 'utf-8'});
        var basename = path.basename(filename);
        var template_name = basename.substr(0, basename.lastIndexOf('.')) || basename;
        loadTemplate(template_name);
        //console.log(template_name);
        /*handlebars.registerPartial(template_name, file_contents);
        loaded_templates[template_name] = file_contents;
        compiled_templates[template_name] = handlebars.compile(file_contents);*/
    });
    
   /* defaults.clientTemplates = [];
    for (var key in loaded_templates) {
        if (!loaded_templates.hasOwnProperty(key)) continue;
        var template_text = loaded_templates[key];
        // TODO: This is very unsafe and inconvenient, but will do
        // TODO: at least change to regex
        if (template_text.indexOf('{{#block') >= 0      ||
            template_text.indexOf('{{#content') >= 0    ||
            template_text.indexOf('{{#extend') >= 0)
            continue;
        defaults.clientTemplates.push({
            name: key,
            text: template_text
        });
    }*/
    
    var shallowMerge = require('./util').shallowMerge;
    function prepareData(data) {
        return shallowMerge([defaults, data || {}]);
    }
    
    function render(template, data) {
        data = data || {};
        return handlebars.compile(ractive2handlebars(template))(prepareData(data));
    }
    
    return {
        handlebars: handlebars,
        render: render,
        renderTemplate: function(template_name, data) {
            if (typeof template_name !== 'string' || template_name.trim() === '') {
                throw new Error('Template name must be a valid non-empty string!');
            }
            if (!loaded_templates.hasOwnProperty(template_name)) {
                throw new Error('Unknown template: ' + template_name);
            }
            if (!config.rendering.cacheTemplates) {
                console.log('Reloading template ', template_name);
                loadTemplate(template_name);
            }
            //return ractive2handlebars(compiled_templates[template_name])(prepareData(data));
            return render(loaded_templates[template_name], data);
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