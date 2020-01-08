// TODO: Get this list from our server

// Using more than two STUN/TURN servers slows down discovery
stunServerList = [  'stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302',
                    // 'stun:stun2.l.google.com:19302',
                    // 'stun:stun3.l.google.com:19302',
                    // 'stun:stun4.l.google.com:19302',
                    // 'stun:stunserver.org:3478'
                  ]

function getStunServerList() {
    return stunServerList
  }