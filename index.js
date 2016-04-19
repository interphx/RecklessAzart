// Engines and libraries initialization
var fs = require('fs');
var express = require('express');
var app = express();

var renderTemplate = require('./rendering').renderTemplate;

var http = require('http').Server(app);
var io = require('socket.io')(http);

function rootpath(path) {
    return __dirname + '/' + path;
}

// Initializing front-end serving
console.log(rootpath('static'));
app.use(express.static(rootpath('static')));

app.get('/', function(req, res) {
    res.send(renderTemplate('index', {
        messages: [
            {name: 'foo', text: 'bar!'},
            {name: 'Jesus', text: 'amen'},
            {name: 'adolf', text: 'lol'},
            {name: 'adolf', text: 'go play dota komrads'},
            {name: 'adolf', text: 'sorry bad english'},
        ]
    }));
});

// Initializing sockets

io.on('connection', function(socket) {
    console.log('Some fucker connected!');
    socket.on('chat-message', function(message) {
        io.emit('chat-message', message);
    });
});

io.on('connection', function(socket) {
    console.log('Some fucker connected!');
});

// Starting the server

http.listen(80, function() {
    console.log('Listening on port 3000...');
});