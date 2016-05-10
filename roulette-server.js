var RouletteServer = (function(){
    function RouletteServer(options) {
        // TODO: Share namespace name between server and client
        this.io = options.io.of('/roulette');
        this.io.on('connection', this.onClientConnected.bind(this));
        // Keys are userids
        this.bets = {};
    }
    
    RouletteServer.prototype = {
        constructor: RouletteServer,
        onClientConnected: function(socket) {
            var self = this;
            if (!socket.request.user) {
                console.log('A guest tried to connect to /roulette');
                return;
            }
            socket.on('bet-place', function(bet) {
                self.bets[socket.request.user._id] = {
                    type: bet.type,
                    amount: bet.amount
                };
            });
            socket.on('bet-remove', function(bet) {
                if (!self.bets[socket.request.user._id]) return;
                self.bets[socket.request.user._id] = undefined;
            });
        },
        startCountdown: function(time) {
            this.io.emit('time-before-roll', time);
            var self = this;
            setTimeout(function() {
                self.doRoll(14);
            }, time);
        },
        // TODO: Share this between server and client
        // TODO: Move harcoded values to config
        getBetResult: function(type, amount, roll_result) {
            type = type.toString().trim();
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
        handleBets: function(roll_result) {
            var userids = Object.keys(this.bets);
            var self = this;
            userids.forEach(function(userid) {
                var bet_type = self.bets[userid].type;
                var bet_amount = self.bets[userid].amount;
                User.findOne({ _id: userid }, function(err, user) {
                    if (err) throw err;
                    if (!user) {
                        console.log('Got non-existing userid when handling bets: ', userid, user);
                        return;
                    }
                    var bet_result = self.getBetResult(bet_type, bet_amount, roll_result);
                    // TODO: Use transactions instead
                    // TODO: Fill user transactions' withdrawable progress
                    user.balance.money = user.balance.money || 0;
                    user.balance.money += bet_result;
                    // TODO: Probably notify users on balance change or make clients poll it
                });
            });
        },
        doRoll: function(max_value) {
            var result = Math.floor(Math.random() * (max_value + 1));
            this.handleBets(result);
        }
    };
    
    return RouletteServer;
})();