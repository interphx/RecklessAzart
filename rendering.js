var fs = require('fs');
var path = require('path');
var config = require('./config');

var RactiveRenderer = (function() {
    var Ractive = require('ractive');
    var shallowMerge = require('./util').shallowMerge;
    var clientTemplateNames = config.rendering.clientOnly;
    
    function RactiveRenderer(templates) {
        this.renderers = {};
        this.defaults = {
            clientTemplates: []
        };
        for (var i = 0; i < templates.length; ++i) {
            var template = templates[i];
            console.log(template.name);
            if (clientTemplateNames.indexOf(template.name) >= 0) {
                this.defaults.clientTemplates.push(template);
                console.log('==========================')
                console.log(template.name, clientTemplateNames);
            }
            this.loadTemplate(template.name, template.text);
        }
    }
    
    RactiveRenderer.prototype = {
        loadTemplate: function(name, content, reloadFile) {
            reloadFile = reloadFile || false;
            if (reloadFile) {
                var filepath = path.join('templates', name + '.html');
                content = fs.readFileSync(filepath, {encoding: 'utf-8'});
            }
            this.renderers[name] = new Ractive({template: Ractive.parse(content), data: {}});
            // TODO: Global partials are unclean
            Ractive.partials[name] = this.renderers[name].template;
        },
        renderTemplate: function(name, data) {
            var renderer = this.renderers[name];
            if (!renderer) {
                throw new Error('No such template: ' + name);
            }
            renderer.reset(this.prepareData(data));
            return renderer.toHTML();
        },
        render: function(template, data) {
            return new Ractive({template: template, data: this.prepareData(data)}).toHTML();
        },
        setDefault: function(name, value) {
            this.defaults[name] = value;
        },
        getDefault: function(name) {
            return this.defaults[name];
        },
        deleteDefault: function(name) {
            delete this.defaults[name]
        },
        prepareData: function(data) {
            return shallowMerge([this.defaults, data || {}]);
        }
    };
    
    return RactiveRenderer;
})();

var walkSync = require('./util').walkSync;
var templates = walkSync('templates').map(function(filename) {
    var basename = path.basename(filename)
    return {
        name: basename.substr(0, basename.lastIndexOf('.')) || basename,
        text: fs.readFileSync(filename, {encoding: 'utf-8'})
    };
});
var renderer = new RactiveRenderer(templates);

module.exports = {
    renderTemplate: renderer.renderTemplate.bind(renderer),
    render: renderer.render.bind(renderer)
};