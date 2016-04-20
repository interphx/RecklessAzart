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
    function ChatView(socket) {
        var self = this;
        
        this.$chat = $('.chat');
        this.socket = socket;
        this.ractive = new Ractive({
            el: this.$chat[0],
            partials: loaded_templates,
            template: getTemplate('chat'),
            data: {
                me: DATA.user,
                chatMessage: '',
                messages: []
            }
        });
        
        this.ractive.on('chatSend', function() {
            var text = self.ractive.get('chatMessage');
            if (!text || text.trim().length < 1) return;
            self.socket.emit('chat-message', {
                text: text
            });
           self.ractive.set('chatMessage', '');
        });
        
        
        this.socket.on('chat-message', function(message) {
            self.ractive.push('messages', message);
        });
        
        this.socket.emit('chat-message', {
            name: this.ractive.get('myname'),
            text:'HI I AM CONNECTED NOW'
        });
    }
    
    return ChatView;
})();

var View = (function() {
    function View() {
        var socket = io();
        this.chatView = new ChatView(socket);
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