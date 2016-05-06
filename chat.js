var EventEmitter = require('events').EventEmitter;
var ChatEntry = require('./models').ChatEntry;
var util = require('./util');

var ChatServer = (function(){
    function ChatServer(options) {
        EventEmitter.call(this);
        this.io = options.io;
        this.latestCount = options.latestCount || 7;
        
        var self = this;
        this.io.on('connection', function(socket) {
            self.fetchLatest(function(err, results) {
                if (err) throw err;
                socket.emit('chat-messages', results);
            });
            socket.on('chat-message', function(message) {
                if (!socket.request.user.logged_in) return;
                self.addMessage(socket.request.user, message.text, function(err, message) {
                    if (err) throw err;
                    self.io.emit('chat-messages', [message]);
                });
            })
        });
    }
    
    ChatServer.prototype = {
        constructor: ChatServer,
        addMessage: function(author, text, cb) {
            console.log(author.avatars.steamAvatarSmall);
            ChatEntry.insert({
                authorName: author.name,
                authorAvatar: author.avatars.steamAvatarSmall,
                text: text,
                createdAt: util.now()
            }, cb || util.noop);
        },
        fetchLatest: function(cb) {
            ChatEntry.find({}).sort({ createdAt: -1 }).limit(this.latestCount).exec(function(err, results) {
                if (err) { 
                    cb(err); 
                    return;
                }
                cb(null, results.reverse());
            });
        },
        purgeAll: function(cb) {
            ChatEntry.remove({}, { multi: true }, cb);
        }
    };
    
    ChatServer.prototype = util.shallowMerge([
        Object.create(EventEmitter.prototype),
        ChatServer.prototype
    ]);
    
    return ChatServer;
})();

module.exports = {
    ChatServer: ChatServer
};