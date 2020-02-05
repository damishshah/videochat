io = require('socket.io-client');
should = require('should');

const connectUrl = 'http://localhost:8080';
const connectOpts = {
    'path' : '/chat/socket.io',
    'reconnection delay' : 0,
    'reopen delay' : 0,
    'force new connection' : true
  };

const test_room_id = 'test_room_id';
var connectionsList = [];

describe('Test Suite', function() {
  var socket;

  beforeEach(function(done) {
    socket = io.connect(connectUrl, connectOpts);
    socket.on('connect', function() {
      connectionsList.push(socket);
      done();
    });
  });

  afterEach(function(done) {
    disconnectAll();
    done();
  });

  describe('Tests', function() {

    it('Test first client creates room', function(done) {
      socket.emit('create or join', test_room_id);
      socket.on('created', function(roomId, socketId) {
        should.equal(test_room_id, roomId);
        should.equal(socket.id, socketId);
        done();
      });
    });
      
    it('Test second client joins room', function(done) {
      socket.emit('create or join', test_room_id);
      socket.on('created', async function(roomId, firstSocketId) {
        should.equal(test_room_id, roomId)
        should.equal(socket.id, firstSocketId);
        await testNewConnection();
        done();
      });
    });

    it('Test client joins full room', function(done) {
      socket.emit('create or join', test_room_id);
      socket.on('created', async function(roomId, firstSocketId) {
        should.equal(test_room_id, roomId)
        should.equal(socket.id, firstSocketId);
        await testNewConnection(); // Add second connection and ensure it connects
        await testNewConnection(); // Add third connection and ensure it connects

        io.connectAsync().then(function(newSocket) {
          newSocket.emit('create or join', test_room_id);
          newSocket.on('full', function(room) {
            done();
          });
        });
      });
    });

  });
});

io.connectAsync = function() {
  return new Promise(function(resolve, reject) {
    var newSocket = io.connect(connectUrl, connectOpts);
    newSocket.on('connect', function() {
      connectionsList.push(newSocket);
      resolve(newSocket);
    });
  });
}

function testNewConnection() {
  var currentSockets = connectionsList.slice(0);
  return new Promise(function(resolve, reject) {
    io.connectAsync().then(function(newSocket) {
      newSocket.emit('create or join', test_room_id);
      newSocket.on('joined', function(room) {
        should.equal(test_room_id, room.name);
        should.equal(currentSockets.length, room.members.length);
        currentSockets.forEach(function(currentSocket) {
          should.equal(true, room.members.includes(currentSocket.id));
        });
        resolve(newSocket);
      });
    });
  });
}

function disconnectAll() {
  connectionsList.forEach(function(conn) {
    conn.disconnect();
  });
  connectionsList = [];
}
