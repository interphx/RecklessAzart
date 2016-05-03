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
        
        this.$container = $('.left-panel');
        this.socket = socket;
        this.ractive = new Ractive({
            el: this.$container[0],
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
        
        this.numbers = [4, 11, 6, 13, 2, 9, 1, 0, 14, 3, 10, 5, 12, 7, 8];
        this.blacksStartFrom = 8;
        
        this.slotWidth = 80;
        
        this.$container = $('.right-panel');
        this.socket = socket;
        this.ractive = new Ractive({
            el: this.$container[0],
            partials: loaded_templates,
            template: getTemplate('roulette'),
            magic: true,
            data: {
                me: DATA.user,
                betAmount: 0,
                betType: [],
                lastSubmittedBetAmount: 0,
                lastRollResult: 0,
                lastRolls: [0],
                roulettePos: 0,
                moneyResult: 0
            }
        });
        
        this.$wheelContainer = this.$container.find('.roulette__wheel-container');
        this.$wheel = this.$container.find('.roulette__wheel');
        this.$slots = $([]);
        this.initRouletteDOM(this.numbers);
        
        /*this.ractive.observe('');*/
        
        this.ractive.on('betChange', function(ev) {
            var $radio = $(ev.node);
            
            var bet_type = self.ractive.get('betType');
            if (bet_type.length > 0) {
                self.ractive.set('betType', [$radio.prop('value')]);
            }
            
            self.tryPlaceBet(self.getBetType(), self.getBetAmount());
        });
        
        this.ractive.on('changeBetAmount', function(ev) {
            var $node = $(ev.node);
            var amount_op = $node.attr('data-amount').trim();
            
            if (amount_op === 'max') {
                self.setBetAmount(self.ractive.get('me.balance.money'));
            } else if (/\+/.test(amount_op)) {
                var plusAmount = parseInt(amount_op.substr(1));
                if (isFinite(plusAmount)) {
                    console.log(self.getBetAmount(), plusAmount);
                    self.setBetAmount(self.getBetAmount() + plusAmount);
                }
            } else if (/\//.test(amount_op)) {
                var divisor = parseInt(amount_op.substr(1));
                if (isFinite(divisor)) {
                    self.setBetAmount(Math.floor(self.getBetAmount() / divisor));
                }
            } else {
                var amount = parseInt(amount_op);
                if (isFinite(amount)) {
                    self.setBetAmount(amount);
                }
            }
            
        });
        
        this.ractive.on('getFreeMoney', function(ev) {
            console.log('Sending free money request...');
            self.socket.emit('add-balance');
        });
        
        
        this.socket.on('roll-result', function(roll_result) {
            self.ractive.set('lastRollResult', roll_result);
            var bet_type = self.getBetType();
            var money_result = self.getBetResult(self.getBetType(), self.getBetAmount(), roll_result);// TODO: Share roulette logic between server and client
            self.ractive.set('moneyResult', money_result);
        });
        
        
        // TODO: move data gathering to separate utility class
        this.socket.on('data', function(){
            setTimeout(function(){
                self.ractive.set('user', DATA.user);
            }, 50);
        });
    }
    
    RouletteView.prototype = {
        constructor: RouletteView,
        getBetResult: function(type, amount, roll_result) {
            bet_type = bet_type.toString().trim();
            if (!isFinite(roll_result)) {
                console.log('Invalid roll result:', roll_result);
            }
            if (!isFinite(amount)) {
                console.log('Invalid bet amount:', amount);
            }
            if (['1-7', '0', '8-14'].indexOf(type) < 0) {
                console.log('Invalid bet type:', type);
            }
            // Wins
            if (type === '1-7' && roll_result >= 1 && roll_result <= 7) {
                return amount;
            } else if (type === '0' && roll_result === 0) {
                return amount * 14;
            } else if (type === '8-14' && roll_result >= 8 && roll_result <= 14) {
                return amount;
            } else {
                return -amount;
            }
        },
        getNumberCSSClasses: function(number) {
            if (number === 0) return ['roulette__slot--zero'];
            if (number < this.blacksStartFrom) return ['roulette__slot--red'];
            return ['roulette__slot--black'];
        },
        initRouletteDOM: function(numbers) {
            var repetitions = 3;
            var slot_width = this.slotWidth;
            var $wheel = this.$wheel;
            $wheel.empty();
            $wheel.css('width', this.numbers.length * repetitions * slot_width);
            
            for (var j = 0; j < repetitions; ++j) {
                var enabled_class = j === Math.floor(repetitions / 2) ? 'roulette__slot--enabled' : '';
                for (var i = 0; i < this.numbers.length; ++i) {
                    var number = this.numbers[i];
                    var color_class = this.getNumberCSSClasses(number).join(' ');
                    $wheel.append('<div class="roulette__slot noselect ' + color_class + ' ' + enabled_class + '">' + number + '</div>');
                }
            }
            
            this.$slots = this.$wheel.find('.roulette__slot.roulette__slot--enabled');
            this.updateRoulettePos();
        },
        getSlotElementByNumber: function(number) {
            return this.$slots.filter(':contains("' + number + '")').filter(function() { return $(this).text() === number.toString() });
        },
        getRequiredRoulettePos: function(number) {            
            var $choosen_slot = this.getSlotElementByNumber(number);
            var container_width = this.$wheelContainer.width();
            var center_slot_left = this.slotWidth * (container_width / this.slotWidth / 2);	
            
            var choosen_slot_index = $choosen_slot.index();
            var choosen_slot_left = this.slotWidth * choosen_slot_index;
            console.log(choosen_slot_index);
            return Math.floor(choosen_slot_left - center_slot_left + this.slotWidth / 2);
        },
        animateRoulettePos: function(number) {
            var time = 4000;
            var lastRollResult = this.ractive.get('lastRollResult');
            if (lastRollResult != null) {
                time = (Math.abs(this.numbers.indexOf(number) - this.numbers.indexOf(lastRollResult)) / (this.numbers.length - 1)) * 4000;
                console.log(time);
            }
            this.$wheel.transition({ x: -this.getRequiredRoulettePos(number) }, time, 'in-out');
            this.ractive.set('roulettePos', number);
        },
        setRoulettePos: function(number) {
            //console.log(-this.getRequiredRoulettePos(number));
            this.$wheel.transition({ x: -this.getRequiredRoulettePos(number) }, 0);
            this.ractive.set('roulettePos', number);
        },
        updateRoulettePos: function() {
            this.setRoulettePos(this.ractive.get('roulettePos'));
        },
        tryPlaceBet: function(type, amount) {
            if (!type) {
                console.log('Invalid bet type:', type);
                return;
            }
            type = type.toString().trim();
            if (!amount || !isFinite(amount)) {
                console.log('Invalid bet amount:', amount);
                return;
            }
            if (['1-7', '0', '8-14'].indexOf(type) < 0) {
                console.log('Invalid bet type:', type);
                return;
            }
            this.socket.emit('place-bet', {
                type: type,
                amount: amount
            });
        },
        tryRemoveBet: function() {
            this.socket.emit('remove-bet');
        },
        getBetType: function() {
            var bet_type = this.ractive.get('betType');
            if (bet_type.length == null) {
                return bet_type;
            }
            return bet_type[bet_type.length - 1];
        },
        getBetAmount: function() {
            var result = this.ractive.get('betAmount');
            if (!result || !isFinite(result)) {
                return 0;
            }
            return result;
        },
        setBetAmount: function(amount) {
            this.ractive.set('betAmount', Math.min(this.ractive.get('me.balance.money'), amount));
        }
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

$(document).ready(function() {
    function runController(controller_name) {
        if (typeof controller_name === 'string' && Controllers[controller_name]) {
            if (typeof Controllers[controller_name].onInit === 'function') {
                Controllers[controller_name].onInit();
            }
        }
    }
    
    runController('all');
    runController($(document.body).attr('data-controller'));
});