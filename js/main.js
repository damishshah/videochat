'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;

var pcConfig = {
  'iceServers': [{
    'urls': getStunServerList()
  }]
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};

/////////////////////////////////////////////

var room = window.location.hash.substring(1);
if (!room) {
  room = window.location.hash = randomToken();
}

var socket = io.connect();

socket.on('created', function(room, clientId) {
  console.log('Created room', room, '- my client ID is', clientId);
  isInitiator = true;
});

// TODO: Display some kind of nice error message for the user.
socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

socket.on('ipaddr', function(ipaddr) {
  console.log('Server IP address is: ' + ipaddr);
});

socket.emit('create or join', room);

if (location.hostname.match(/localhost|127\.0\.0|192\.168\.1/)) {
  socket.emit('ipaddr');
}

////////////////////////////////////////////////

// TODO: Make sure messaging passes room information for socket
function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

// This client receives a message
socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
})
.then(gotStream)
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});

function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

var constraints = {
  video: true
};

console.log('Getting user media with constraints', constraints);

// TODO: Configure and add a TURN server
// if (location.hostname !== '192.168.1.100') {
//   requestTurn(
//     'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
//   );
// }

function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function() {
  sendMessage('bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
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

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

// TODO: Configure and add a TURN server
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

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}

function randomToken() {
  return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}

// TODO: Get this list from our server
function getStunServerList() {
  return ['stun:stun.l.google.com:19302',
          'stun:23.21.150.121:3478',
          'stun:iphone-stun.strato-iphone.de:3478',
          'stun:numb.viagenie.ca:3478',
          'stun:s1.taraba.net:3478',
          'stun:s2.taraba.net:3478',
          'stun:stun.12connect.com:3478',
          'stun:stun.12voip.com:3478',
          'stun:stun.1und1.de:3478',
          'stun:stun.2talk.co.nz:3478',
          'stun:stun.2talk.com:3478',
          'stun:stun.3clogic.com:3478',
          'stun:stun.3cx.com:3478',
          'stun:stun.a-mm.tv:3478',
          'stun:stun.aa.net.uk:3478',
          'stun:stun.acrobits.cz:3478',
          'stun:stun.actionvoip.com:3478',
          'stun:stun.advfn.com:3478',
          'stun:stun.aeta-audio.com:3478',
          'stun:stun.aeta.com:3478',
          'stun:stun.alltel.com.au:3478',
          'stun:stun.altar.com.pl:3478',
          'stun:stun.annatel.net:3478',
          'stun:stun.antisip.com:3478',
          'stun:stun.arbuz.ru:3478',
          'stun:stun.avigora.com:3478',
          'stun:stun.avigora.fr:3478',
          'stun:stun.awa-shima.com:3478',
          'stun:stun.awt.be:3478',
          'stun:stun.b2b2c.ca:3478',
          'stun:stun.bahnhof.net:3478',
          'stun:stun.barracuda.com:3478',
          'stun:stun.bluesip.net:3478',
          'stun:stun.bmwgs.cz:3478',
          'stun:stun.botonakis.com:3478',
          'stun:stun.budgetphone.nl:3478',
          'stun:stun.budgetsip.com:3478',
          'stun:stun.cablenet-as.net:3478',
          'stun:stun.callromania.ro:3478',
          'stun:stun.callwithus.com:3478',
          'stun:stun.cbsys.net:3478',
          'stun:stun.chathelp.ru:3478',
          'stun:stun.cheapvoip.com:3478',
          'stun:stun.ciktel.com:3478',
          'stun:stun.cloopen.com:3478',
          'stun:stun.colouredlines.com.au:3478',
          'stun:stun.comfi.com:3478',
          'stun:stun.commpeak.com:3478',
          'stun:stun.comtube.com:3478',
          'stun:stun.comtube.ru:3478',
          'stun:stun.cope.es:3478',
          'stun:stun.counterpath.com:3478',
          'stun:stun.counterpath.net:3478',
          'stun:stun.cryptonit.net:3478',
          'stun:stun.darioflaccovio.it:3478',
          'stun:stun.datamanagement.it:3478',
          'stun:stun.dcalling.de:3478',
          'stun:stun.decanet.fr:3478',
          'stun:stun.demos.ru:3478',
          'stun:stun.develz.org:3478',
          'stun:stun.dingaling.ca:3478',
          'stun:stun.doublerobotics.com:3478',
          'stun:stun.drogon.net:3478',
          'stun:stun.duocom.es:3478',
          'stun:stun.dus.net:3478',
          'stun:stun.e-fon.ch:3478',
          'stun:stun.easybell.de:3478',
          'stun:stun.easycall.pl:3478',
          'stun:stun.easyvoip.com:3478',
          'stun:stun.efficace-factory.com:3478',
          'stun:stun.einsundeins.com:3478',
          'stun:stun.einsundeins.de:3478',
          'stun:stun.ekiga.net:3478',
          'stun:stun.epygi.com:3478',
          'stun:stun.etoilediese.fr:3478',
          'stun:stun.eyeball.com:3478',
          'stun:stun.faktortel.com.au:3478',
          'stun:stun.freecall.com:3478',
          'stun:stun.freeswitch.org:3478',
          'stun:stun.freevoipdeal.com:3478',
          'stun:stun.fuzemeeting.com:3478',
          'stun:stun.gmx.de:3478',
          'stun:stun.gmx.net:3478',
          'stun:stun.gradwell.com:3478',
          'stun:stun.halonet.pl:3478',
          'stun:stun.hellonanu.com:3478',
          'stun:stun.hoiio.com:3478',
          'stun:stun.hosteurope.de:3478',
          'stun:stun.ideasip.com:3478',
          'stun:stun.imesh.com:3478',
          'stun:stun.infra.net:3478',
          'stun:stun.internetcalls.com:3478',
          'stun:stun.intervoip.com:3478',
          'stun:stun.ipcomms.net:3478',
          'stun:stun.ipfire.org:3478',
          'stun:stun.ippi.fr:3478',
          'stun:stun.ipshka.com:3478',
          'stun:stun.iptel.org:3478',
          'stun:stun.irian.at:3478',
          'stun:stun.it1.hr:3478',
          'stun:stun.ivao.aero:3478',
          'stun:stun.jappix.com:3478',
          'stun:stun.jumblo.com:3478',
          'stun:stun.justvoip.com:3478',
          'stun:stun.kanet.ru:3478',
          'stun:stun.kiwilink.co.nz:3478',
          'stun:stun.kundenserver.de:3478',
          'stun:stun.l.google.com:19302',
          'stun:stun.linea7.net:3478',
          'stun:stun.linphone.org:3478',
          'stun:stun.liveo.fr:3478',
          'stun:stun.lowratevoip.com:3478',
          'stun:stun.lugosoft.com:3478',
          'stun:stun.lundimatin.fr:3478',
          'stun:stun.magnet.ie:3478',
          'stun:stun.manle.com:3478',
          'stun:stun.mgn.ru:3478',
          'stun:stun.mit.de:3478',
          'stun:stun.mitake.com.tw:3478',
          'stun:stun.miwifi.com:3478',
          'stun:stun.modulus.gr:3478',
          'stun:stun.mozcom.com:3478',
          'stun:stun.myvoiptraffic.com:3478',
          'stun:stun.mywatson.it:3478',
          'stun:stun.nas.net:3478',
          'stun:stun.neotel.co.za:3478',
          'stun:stun.netappel.com:3478',
          'stun:stun.netappel.fr:3478',
          'stun:stun.netgsm.com.tr:3478',
          'stun:stun.nfon.net:3478',
          'stun:stun.noblogs.org:3478',
          'stun:stun.noc.ams-ix.net:3478',
          'stun:stun.node4.co.uk:3478',
          'stun:stun.nonoh.net:3478',
          'stun:stun.nottingham.ac.uk:3478',
          'stun:stun.nova.is:3478',
          'stun:stun.nventure.com:3478',
          'stun:stun.on.net.mk:3478',
          'stun:stun.ooma.com:3478',
          'stun:stun.ooonet.ru:3478',
          'stun:stun.oriontelekom.rs:3478',
          'stun:stun.outland-net.de:3478',
          'stun:stun.ozekiphone.com:3478',
          'stun:stun.patlive.com:3478',
          'stun:stun.personal-voip.de:3478',
          'stun:stun.petcube.com:3478',
          'stun:stun.phone.com:3478',
          'stun:stun.phoneserve.com:3478',
          'stun:stun.pjsip.org:3478',
          'stun:stun.poivy.com:3478',
          'stun:stun.powerpbx.org:3478',
          'stun:stun.powervoip.com:3478',
          'stun:stun.ppdi.com:3478',
          'stun:stun.prizee.com:3478',
          'stun:stun.qq.com:3478',
          'stun:stun.qvod.com:3478',
          'stun:stun.rackco.com:3478',
          'stun:stun.rapidnet.de:3478',
          'stun:stun.rb-net.com:3478',
          'stun:stun.refint.net:3478',
          'stun:stun.remote-learner.net:3478',
          'stun:stun.rixtelecom.se:3478',
          'stun:stun.rockenstein.de:3478',
          'stun:stun.rolmail.net:3478',
          'stun:stun.rounds.com:3478',
          'stun:stun.rynga.com:3478',
          'stun:stun.samsungsmartcam.com:3478',
          'stun:stun.schlund.de:3478',
          'stun:stun.services.mozilla.com:3478',
          'stun:stun.sigmavoip.com:3478',
          'stun:stun.sip.us:3478',
          'stun:stun.sipdiscount.com:3478',
          'stun:stun.sipgate.net:10000',
          'stun:stun.sipgate.net:3478',
          'stun:stun.siplogin.de:3478',
          'stun:stun.sipnet.net:3478',
          'stun:stun.sipnet.ru:3478',
          'stun:stun.siportal.it:3478',
          'stun:stun.sippeer.dk:3478',
          'stun:stun.siptraffic.com:3478',
          'stun:stun.skylink.ru:3478',
          'stun:stun.sma.de:3478',
          'stun:stun.smartvoip.com:3478',
          'stun:stun.smsdiscount.com:3478',
          'stun:stun.snafu.de:3478',
          'stun:stun.softjoys.com:3478',
          'stun:stun.solcon.nl:3478',
          'stun:stun.solnet.ch:3478',
          'stun:stun.sonetel.com:3478',
          'stun:stun.sonetel.net:3478',
          'stun:stun.sovtest.ru:3478',
          'stun:stun.speedy.com.ar:3478',
          'stun:stun.spokn.com:3478',
          'stun:stun.srce.hr:3478',
          'stun:stun.ssl7.net:3478',
          'stun:stun.stunprotocol.org:3478',
          'stun:stun.symform.com:3478',
          'stun:stun.symplicity.com:3478',
          'stun:stun.sysadminman.net:3478',
          'stun:stun.t-online.de:3478',
          'stun:stun.tagan.ru:3478',
          'stun:stun.tatneft.ru:3478',
          'stun:stun.teachercreated.com:3478',
          'stun:stun.tel.lu:3478',
          'stun:stun.telbo.com:3478',
          'stun:stun.telefacil.com:3478',
          'stun:stun.tis-dialog.ru:3478',
          'stun:stun.tng.de:3478',
          'stun:stun.twt.it:3478',
          'stun:stun.u-blox.com:3478',
          'stun:stun.ucallweconn.net:3478',
          'stun:stun.ucsb.edu:3478',
          'stun:stun.ucw.cz:3478',
          'stun:stun.uls.co.za:3478',
          'stun:stun.unseen.is:3478',
          'stun:stun.usfamily.net:3478',
          'stun:stun.veoh.com:3478',
          'stun:stun.vidyo.com:3478',
          'stun:stun.vipgroup.net:3478',
          'stun:stun.virtual-call.com:3478',
          'stun:stun.viva.gr:3478',
          'stun:stun.vivox.com:3478',
          'stun:stun.vline.com:3478',
          'stun:stun.vo.lu:3478',
          'stun:stun.vodafone.ro:3478',
          'stun:stun.voicetrading.com:3478',
          'stun:stun.voip.aebc.com:3478',
          'stun:stun.voip.blackberry.com:3478',
          'stun:stun.voip.eutelia.it:3478',
          'stun:stun.voiparound.com:3478',
          'stun:stun.voipblast.com:3478',
          'stun:stun.voipbuster.com:3478',
          'stun:stun.voipbusterpro.com:3478',
          'stun:stun.voipcheap.co.uk:3478',
          'stun:stun.voipcheap.com:3478',
          'stun:stun.voipfibre.com:3478',
          'stun:stun.voipgain.com:3478',
          'stun:stun.voipgate.com:3478',
          'stun:stun.voipinfocenter.com:3478',
          'stun:stun.voipplanet.nl:3478',
          'stun:stun.voippro.com:3478',
          'stun:stun.voipraider.com:3478',
          'stun:stun.voipstunt.com:3478',
          'stun:stun.voipwise.com:3478',
          'stun:stun.voipzoom.com:3478',
          'stun:stun.vopium.com:3478',
          'stun:stun.voxgratia.org:3478',
          'stun:stun.voxox.com:3478',
          'stun:stun.voys.nl:3478',
          'stun:stun.voztele.com:3478',
          'stun:stun.vyke.com:3478',
          'stun:stun.webcalldirect.com:3478',
          'stun:stun.whoi.edu:3478',
          'stun:stun.wifirst.net:3478',
          'stun:stun.wwdl.net:3478',
          'stun:stun.xs4all.nl:3478',
          'stun:stun.xtratelecom.es:3478',
          'stun:stun.yesss.at:3478',
          'stun:stun.zadarma.com:3478',
          'stun:stun.zadv.com:3478',
          'stun:stun.zoiper.com:3478',
          'stun:stun1.faktortel.com.au:3478',
          'stun:stun1.l.google.com:19302',
          'stun:stun1.voiceeclipse.net:3478',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302',
          'stun:stun4.l.google.com:19302',
          'stun:stunserver.org:3478']
}