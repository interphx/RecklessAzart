var EventEmitter = require('events').EventEmitter;
var SteamOverlordBot = require('./models').SteamOverlordBot;
var config = require('./config');

var SteamOverlord = (function() {
    function SteamOverlord(options) {
        EventEmitter.call(this);
        options = options || {};
        this.lazyLogin = (options.lazyLogin != null) ? options.lazyLogin : true;
        
        this.bots = [];
        var self = this;
        SteamOverlordBot.find({}, function(err, results) {
            if (err) throw err;
            self.bots = results;
            self.onBotsLoaded(results);
        });
    }
    
    SteamOverlord.prototype = Object.create(EventEmitter.prototype);
    SteamOverlord.prototype.constructor = SteamOverlord;
    SteamOverlord.prototype.onBotsLoaded = function(bots) {
        if (!this.lazyLogin) {
            this.bots.forEach(function(bot) {
                bot.activate();
            });
        }
    };
    
    return SteamOverlord;
})();

return {
    overlord: new SteamOverlord(config.overlord)
};