/*var ChatClient = (function() {
    function ChatClient() {
        
    }
    
    ChatClient.prototype = {
        constructor: ChatClient
    }
    
    return ChatClient;
})();*/

var getTemplate = (function() {
    var loaded_templates = {};
    $('[data-define-template]').each(function() {
        var $this = $(this);
        var template_name = $this.attr('data-define-template');
        var template_text = $this.html();
        loaded_templates[template_name] = template_text;
    });

    function getTemplate(template_name) {
        return loaded_templates[template_name];
    }
    
    getTemplate.loadedTemplates = loaded_templates;
    
    return getTemplate;
})();

var loaded_templates = getTemplate.loaded_templates;

var ChatView = (function() {
    function ChatView(socket) {
        var self = this;
        
        this.$chat = $('.chat');
        this.socket = socket;
        this.ractive = new Ractive({
            el: this.$chat[0],
            partials: loaded_templates,
            template: getTemplate('chat'),
            magic: true,
            data: {
                me: DATA.user,
                chatMessage: '',
                messages: []
            }
        });
        
        this.ractive.on('chatSend', function() {
            console.log('Sending to chat...');
            var text = self.ractive.get('chatMessage');
            if (!text || text.trim().length < 1) return;
            self.socket.emit('chat-message', {
                text: text
            });
           self.ractive.set('chatMessage', '');
        });
        
        
        this.socket.on('chat-messages', function(messages) {
            self.ractive.set('messages', self.ractive.get('messages').concat(messages));
        });
        
        this.socket.emit('chat-message', {
            text:'hi guts'
        });
    }
    
    return ChatView;
})();

var RouletteView = (function() {
    function RouletteView(socket) {
        var self = this;
        
        this.$roulette = $('.roulette');
        this.socket = socket;
        this.ractive = new Ractive({
            el: this.$roulette[0],
            partials: loaded_templates,
            template: getTemplate('roulette'),
            magic: true,
            data: {
                me: DATA.user,
                betAmount: 0,
                betType: null,
                rollResult: 'Not rolled yet',
                resultMessage: ''
            }
        });
        
        this.ractive.on('bet', function(ev) {
            var bet_type = parseInt($(ev.node).attr('data-bet-type'));
            if (!isFinite(bet_type)) console.log('Problems!');

            self.ractive.set('betType', bet_type);
            self.ractive.set('betAmount', 50);
            console.log('Bet made!');
            self.socket.emit('bet', {
                type: self.ractive.get('betType'),
                amount: self.ractive.get('betAmount')
            });
        });
        
        this.ractive.on('getFreeMoney', function(ev) {
            console.log('Sending free money request...');
            self.socket.emit('add-balance');
        });
        
        
        this.socket.on('roll-result', function(roll_result) {
            self.ractive.set('rollResult', roll_result);
            var bet_type = self.ractive.get('betType');
            var win = (bet_type === 0 && roll_result >= 1 && roll_result <= 18) ||
                        (bet_type === 1 && roll_result >= 19 && roll_result <= 35) ||
                        (bet_type === 2 && roll_result === 0);
            
            if (win) {
                self.ractive.set('resultMessage', 'Whoah! You won!');
            } else {
                self.ractive.set('resultMessage', 'Fail :(((');
            }
        });
        
        this.socket.on('data', function(){
            setTimeout(function(){
                self.ractive.set('user', DATA.user);
            }, 50);
        });
    }
    
    return RouletteView;
})();

var View = (function() {
    function View() {
        var socket = io();
        
        socket.on('data', function(new_data) {
            $.extend(true, DATA, new_data);
        });
        
        this.chatView = new ChatView(socket);
        this.rouletteView = new RouletteView(socket);
        window.chatView = this.chatView;
        window.rouletteView = this.rouletteView;
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