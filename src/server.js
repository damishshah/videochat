'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io')({path: '/chat/socket.io'});
const maxClients = 3;

var fileServer = new nodeStatic.Server();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(8080);

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    for (var room in socket.rooms) {
      if (room !== socket.id) {
        log('Socket ', socket.id, ' broadcasting to room ', room);
        socket.broadcast.to(room).emit('message', {content: message, socketId: socket.id});
      }
    }
  });

  socket.on('messagePeer', function(message) {
    console.log('Client said the following to ' + message.recipient + ': ', message.content);
    socket.broadcast.to(message.recipient).emit('message', {content: message.content, socketId: socket.id});
  });

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    if (numClients === 0) {
      log('Room ' + room + ' does not yet exist');
    } else {
      log('Room ' + room + ' currently has ' + numClients + ' client(s)');
    }

    if (numClients === 0) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);
    } else if (numClients > 0 && numClients < maxClients) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', {name: room, members: Object.keys(clientsInRoom.sockets).filter(function(key) {return key != socket.id})});
      io.sockets.in(room).emit('ready');
    } else if (numClients >= maxClients) {
      socket.emit('full', room);
    }
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '192.168.1.135') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(room){
    console.log('received bye');
    socket.leave(room)
  });

});
