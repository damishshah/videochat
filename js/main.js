import { connect } from 'socket.io-client';
'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var peerConnections = {};
var dataChannels = {};
var localStream;
var lastMessageName;
var membersAtTimeOfJoining;

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var dataChannelSend = document.getElementById('dataChannelSend');
var dataChannelReceive = document.getElementById('dataChannelReceive');
var nameInput = document.getElementById('name');

const chatWindow = document.querySelector('#chatWindow');

// TODO: Get this list from our server
// Using more than two STUN/TURN servers slows down discovery
var stunServerList = [  'stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302',
                    // 'stun:stun2.l.google.com:19302',
                    // 'stun:stun3.l.google.com:19302',
                    // 'stun:stun4.l.google.com:19302',
                    // 'stun:stunserver.org:3478'
                  ];

var pcConfig = {
  'iceServers': [{
    'urls': stunServerList
  }]
};

// Currently sets up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};

var room = window.location.hash.substring(1);
if (!room) {
  room = window.location.hash = randomToken();
}

// --- Handle socket setup ---

var socket = connect();

socket.on('created', function(room, clientId) {
  console.log('Created room', room, '- my client ID is', clientId);
  isInitiator = true;
  setupUserMedia();
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
  alert('Sorry! This room is full, please try again');
});

socket.on('join', function (room) {
  console.log('Another peer made a request to join room ' + room);
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room.name);
  console.log('members: ' + room.members);
  membersAtTimeOfJoining = room.members;
  isChannelReady = true;
  setupUserMedia();
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

// This client receives a message
socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message.content.type === 'offer') {
    // New client connections are responsible for making offers to the existing clients
    peerConnections[message.socketId] = createPeerConnection();
    isStarted = true;
    peerConnections[message.socketId].setRemoteDescription(new RTCSessionDescription(message.content));
    peerConnections[message.socketId].ondatachannel = function (event) {
      console.log("Data channel for socket: " + message.socketId + " was setup!")
      setupDataChannel(event.channel);
      dataChannels[message.socketId] = event.channel;
    };
    console.log("Set offer from socket id: " + message.socketId);
    doAnswer(message.socketId);  
  } else if (message.content.type === 'answer' && isStarted) {
    peerConnections[message.socketId].setRemoteDescription(new RTCSessionDescription(message.content));
    console.log("Set answer from socket id: " + message.socketId);
    console.log(message.socketId + " connectionState: " + peerConnections[message.socketId].connectionState + " signalState: " + peerConnections[message.socketId].signalingState)
  } else if (message.content.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.content.label,
      candidate: message.content.candidate
    });
    peerConnections[message.socketId].addIceCandidate(candidate);
    console.log(message.socketId + " connectionState: " + peerConnections[message.socketId].connectionState + " signalState: " + peerConnections[message.socketId].signalingState)
  } else if (message.content === 'bye' && isStarted) {
    handleRemoteHangup(message.socketId);
  }
});

socket.on('ipaddr', function(ipaddr) {
  console.log('Server IP address is: ' + ipaddr);
});

// --- Start client-side code ---

socket.emit('create or join', room);

if (location.hostname.match(/localhost|127\.0\.0|192\.168\.1/)) {
  socket.emit('ipaddr');
}

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

function messagePeer(socketId, message) {
  console.log('Client sending message to peer ' + socketId + ': ', message )
  socket.emit('messagePeer', {recipient: socketId, content: message})
}

function setupUserMedia() {
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
  })
  .then(gotStream)
  .catch(function (e) {
    alert('getUserMedia() error: ' + e.name + ' ' + e.message);
  });
}

// TODO: Decouple getting local user media from joining room
function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  if (!isInitiator) {
    for (var i=0; i<membersAtTimeOfJoining.length; i++) {
      var currentMember = membersAtTimeOfJoining[i]
      peerConnections[currentMember] = createPeerConnection();
      // var dataChannel = createDataChannel(peerConnections[membersAtTimeOfJoining[i]]);
      var dataChannel = peerConnections[currentMember].createDataChannel('chat');
      setupDataChannel(dataChannel);
      dataChannels[currentMember] = dataChannel;
      doCall(currentMember);
    }
    isStarted = true;
  }
}

function createPeerConnection() {
  try {
    var pc = new RTCPeerConnection(pcConfig);
    pc.addStream(localStream);
    pc.onicecandidate = handleIceCandidate;
    pc.ontrack = handleRemoteStreamAdded;
    pc.onremovetrack = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
    return pc;
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function doCall(id) {
  console.log('Sending offer to peer');
  peerConnections[id].createOffer(sdpConstraints).then(function(offer) {
    return peerConnections[id].setLocalDescription(offer);
  }).then(function() {
    messagePeer(id, peerConnections[id].localDescription);
  }).catch(handleCreateOfferError);
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doAnswer(id) {
  console.log('Sending answer to peer.');
  peerConnections[id].createAnswer().then(function(answer) {
    return peerConnections[id].setLocalDescription(answer)
  }).then(function() {
    messagePeer(id, peerConnections[id].localDescription);
  }).catch(onCreateSessionDescriptionError);
}

function onCreateSessionDescriptionError(error) {
  console.log('Failed to create session description: ' + error.toString());
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteVideo.srcObject = event.streams[0];
}

// --- Functions related to data channels & messaging ---

function createDataChannel(peerConnection) {
  try {
    console.log('Created RTCDataChannel')
    return peerConnection.createDataChannel('chat')
  } catch (e) {
    console.log('Failed to create RTCDataChannel, exception: ' + e.message);
    alert('Cannot create RTCDataChannel.');
    return;
  }
}

function setupDataChannel(dataChannel) {
  console.log('Setup Data Channel');
  dataChannel.onmessage = onReceiveMessageCallback;
  dataChannel.onerror = (error) => {
    console.log("Data Channel Error:", error);
  };
}

export function sendData(name, text) {
  console.log("Sending text \"" + text+ "\" from \"" + name + "\"");
  const data = {
    name: name,
    content: text
  }
  var didSendMessage = false;
  for (var dc in dataChannels) {
    try {
      dataChannels[dc].send(JSON.stringify(data));
      didSendMessage = true;  
    } catch (e) {
      console.error('Error while trying to send message: ' + e)
    }
  }
  // dataChannelSend.value = '';
  if (didSendMessage) { 
    console.log('Sent Data: ' + JSON.stringify(data)); 
    insertMessageToDOM(data, true);
  }
}

function onReceiveMessageCallback(event) {
  console.log('Received Message: ' + event.data);
  insertMessageToDOM(JSON.parse(event.data), false);
}

function insertMessageToDOM(options, isFromMe) {
  console.log("Trying to insert text \"" + options.content + "\" from \"" + options.name + "\" into DOM.");
  const template = document.querySelector('template[data-template="message"]');
  const nameEl = template.content.querySelector('.message__name');
  if (options.name && (lastMessageName === null || lastMessageName !== options.name)) {
    lastMessageName = options.name;
    nameEl.innerText = options.name;
  } else {
    nameEl.innerText = null
  }
  template.content.querySelector('.message__bubble').innerText = options.content;
  const clone = document.importNode(template.content, true);
  const messageEl = clone.querySelector('.message');
  if (isFromMe) {
    messageEl.classList.add('message--mine');
  } else {
    messageEl.classList.add('message--theirs');
  }

  dataChannelReceive.appendChild(clone);

  // Scroll to bottom
  dataChannelReceive.scrollTop = dataChannelReceive.scrollHeight - dataChannelReceive.clientHeight;
}

// --- Handle callers leaving ---

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
  remoteVideo.srcObject.remove
}

function handleRemoteHangup(socketId) {
  console.log('Remote socket ' + socketId + ' ended their call.');
  stop(socketId);
}

// TODO: Gracefully handle stream disconnecting by removing the leavers video stream.
function stop(socketId) {
  console.log('Stopping stream from socket: ' + socketId);
  peerConnections[socketId].close();
  delete peerConnections[socketId];
  delete dataChannels[socketId];
  if (peerConnections.length === 0) {
    isStarted = false;
    // TODO: Currently only shifting isInitiator when all other callers have left. Think about if that's ok.
    isInitiator = true;
  }
}

// --- Utils ---

function randomToken() {
  return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}

// --- Window functions ---

window.onbeforeunload = function() {
  sendMessage('bye');
}

// TODO: Configure and add a TURN server
// 
// var turnReady;
// 
// if (location.hostname !== '192.168.1.100') {
//   requestTurn(
//     'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
//   );
// }
// 
// function requestTurn(turnURL) {
//   var turnExists = false;
//   for (var i in pcConfig.iceServers) {
//     if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
//       turnExists = true;
//       turnReady = true;
//       break;
//     }
//   }
//   if (!turnExists) {
//     console.log('Getting TURN server from ', turnURL);
//     // No TURN server. Get one from computeengineondemand.appspot.com:
//     var xhr = new XMLHttpRequest();
//     xhr.onreadystatechange = function() {
//       if (xhr.readyState === 4 && xhr.status === 200) {
//         var turnServer = JSON.parse(xhr.responseText);
//         console.log('Got TURN server: ', turnServer);
//         pcConfig.iceServers.push({
//           'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
//           'credential': turnServer.password
//         });
//         turnReady = true;
//       }
//     };
//     xhr.open('GET', turnURL, true);
//     xhr.send();
//   }
// }
