// Engines and libraries initialization
var fs = require('fs');
var express = require('express');
var expressSession = require('express-session');
var passport = require('passport');
var passportSocketIo = require('passport.socketio');
var LocalStrategy = require('passport-local').Strategy;
var app = express();

var http = require('http').Server(app);
var io = require('socket.io')(http);

var config = require('./config');
var User = require('./models').User;

passport.use(new LocalStrategy(
    { passReqToCallback: true },
    function(req, username, password, cb) {
        console.log('Auth attempt: ', username, password);
        User.findOne({name: username}, function(err, user) {
            if (err) cb(err);
            if (!user) {console.log('No such user: ', username); return cb(null, false); }
            if (user.password !== password) { console.log('Invalid password: ', password); return cb(null, false); }
            return cb(null, user);
        });
    }
));

passport.serializeUser(function(user, cb) {
    cb(null, user._id);
});

passport.deserializeUser(function(id, cb) {
    User.findOne({ _id: id }, function(err, user) {
        if (err) { return cb(err); }
        if (!user) {
            console.log('No user found!');
            cb(null, false);
        } else {
            cb(null, user);
        }
    });
});

// Utility functions

function rootpath(path) {
    return __dirname + '/' + path;
}

var renderTemplate = require('./rendering').renderTemplate;


// Initializing sessions

var NedbStore = require('nedb-session-store')(expressSession);

var sessionSecret = config.secret;
var sessionStore = new NedbStore({
    filename: __dirname + '/database/session_store.db'
});
var sessionMiddleware = expressSession({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    /*cookie: {
        path: '/',
        maxAge: 365 * 24 * 60 * 60 * 1000
    },*/
    store: sessionStore
});

app.use(sessionMiddleware);

app.use(require('body-parser').urlencoded({ extended: false }));
var cookieParser = require('cookie-parser')();
app.use(cookieParser);
app.use(passport.initialize());
app.use(passport.session());

io.use(passportSocketIo.authorize({
    cookieParser: require('cookie-parser'),
    key: 'connect.sid',
    secret: sessionSecret,
    store: sessionStore,
    success: function(data, accept) { console.log('Successful auth through socket.io!'); accept(); },
    fail: function(data, message, error, accept) {
        if (error) throw new Error(message);
        accept();
        console.log('Failed socket.io auth: ', message);
        if (error) {
            accept(new Error(message));
        }
    }
}));

/*
io.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res, next);
});*/

// Initializing front-end serving
app.use(express.static(rootpath('static')));

app.get('/', function(req, res) {
    //chatServer.fetchLatest(function(err, results) {
        if (!req.user.getClientSideData) {
            console.log('Weird user object: ', req.user);
        }
        res.send(renderTemplate('index', {
            messages: [],
            $clientData: {
                user: (req.user && req.user.logged_in && req.user.getClientSideData) ? req.user.getClientSideData() : { name: 'Anonymous', balance: 0, roles: ['guest'] }
            }
        }));
    //});
});

app.get('/forbidden', function(req, res) {
    res.send('Forbidden. Please authorize via /login/username/password');
});

app.get('/admin',
    function(req, res) {
        if(req.user) {
            res.send('Woohoo, you are viewving this page as ' + req.user.name);
        } else {
            res.send('Admin panel: Please authorize via /login/username/password');
        }
    }
);

app.get('/login',
    function(req, res) {
        res.send('<form method="POST">Username:<input type="text" name="username">Password<input type="text" name="password"><input type="submit"></form>');
    }
);

app.post('/login',
    function(req, res, next) {
        next();
    },
    passport.authenticate('local', { failureRedirect: '/forbidden' }),
    function(req, res) {
        res.redirect('/admin');
    }
);

// Initializing sockets

var ChatServer = require('./chat').ChatServer;

var chatServer = new ChatServer({
    io: io,
    latestCount: config.chat.latestCount || 7
});

io.on('connection', function(socket) {
    console.log('Some fucker connected: ', socket.id);
    /*socket.on('chat-message', function(message) {
        if (!socket.request || !socket.request.user) {
            console.log('Something is wrong: we\'ve got request with no "user" property');
        }
        if (!socket.request.user.logged_in) return;
        io.emit('chat-message', {
            name: socket.request.user.name,
            text: message.text
        });
    });*/
    socket.on('add-balance', function() {
        if (!socket.request.user.logged_in) return;
        console.log('Free money requested by ' + socket.request.user.name);
        socket.request.user.deposit(100);
        socket.request.user.persist();
        socket.emit('data', { user: {balance: socket.request.user.balance} });
    });
    
    socket.on('bet', function(bet) {
        if (!socket.request.user.logged_in) return;
        console.log('Bet made by by ' + socket.request.user.name + '! Rolling...');
        var roll_result = Math.floor(Math.random() * 38);
        console.log('Rolled ' + roll_result);
        io.emit('roll-result', roll_result);
        
        var bet_type = bet.type;
        var bet_amount = bet.amount;
        
        var win = (bet_type === 0 && roll_result >= 1 && roll_result <= 18) ||
                    (bet_type === 1 && roll_result >= 19 && roll_result <= 35) ||
                    (bet_type === 2 && roll_result === 0);
        if (win && bet_type === 2) {
            socket.request.user.deposit(bet.amount * 14);
        } else if (win) {
            socket.request.user.deposit(bet.amount);
        } else {
            socket.request.user.deposit(-bet.amount);
        }
        socket.request.user.persist();
        socket.emit('data', { user: {balance: socket.request.user.balance} });
    });
});


var lord = require('./steam').overlord;

// Starting the server

http.listen(80, function() {
    console.log('Listening on port 80...');
});