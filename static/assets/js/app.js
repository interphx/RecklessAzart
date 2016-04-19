var loaded_templates = {};
$('[data-define-template]').each(function() {
    var $this = $(this);
    var template_name = $this.attr('data-define-template');
    var template_text = $this.html();
    loaded_templates[template_name] = template_text;
});

function getTemplate(template_name) {
    //return $('script[data-define-template=' + template_name + ']').html();
    return loaded_templates[template_name];
}

var ChatView = (function() {
    function ChatView() {
        var $chat = $('.chat');
        this.ractive = new Ractive({
            el: $chat[0],
            partials: loaded_templates,
            template: getTemplate('chat'),
            data: {
                messages: []
            }
        });
    }
    
    return ChatView;
})();

var View = (function() {
    function View() {
        this.chatView = new ChatView();
        console.log('Main view initialized!');
    }
    
    View.prototype = {
        constructor: View,
    };
    
    return View;
})();

var Controllers = {
    'all': {
        onInit: function() {
            var view = new View();
        }
    }
};

(function() {
    function runController(controller_name) {
        if (typeof controller_name === 'string' && Controllers[controller_name]) {
            if (typeof Controllers[controller_name].onInit === 'function') {
                Controllers[controller_name].onInit();
            }
        }
    }
    
    runController('all');
    runController($(document.body).attr('data-controller'));
})();