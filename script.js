let drone;
let room;
let pc;
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};
let roomHash = '';  // Will store the code generated for the room
let localStream;
let isMuted = false;

function onSuccess() {}
function onError(error) {
  console.error(error);
}

// Generate a random code for the room
function generateCode() {
  return Math.floor(Math.random() * 0xFFFFFF).toString(16);
}

// Start the call and generate a unique secret code
function startCall() {
  roomHash = generateCode();
  document.querySelector('.status-message').innerText = `Share your URL and secret code with someone to start the video call. Your code: ${roomHash}`;
  document.getElementById('startCallBtn').disabled = true;
  document.getElementById('joinBtn').disabled = false;
  document.getElementById('endCallBtn').disabled = false;
  document.getElementById('muteBtn').disabled = false;
  document.getElementById('shareBtn').disabled = false;

  drone = new ScaleDrone('yiS12Ts5RdNhebyM');  // Replace with your ScaleDrone channel ID
  const roomName = 'observable-' + roomHash;
  
  drone.on('open', error => {
    if (error) return console.error(error);
    room = drone.subscribe(roomName);
    room.on('open', error => {
      if (error) return onError(error);
    });
    room.on('members', members => {
      console.log('Members:', members);
      const isOfferer = members.length === 2;
      startWebRTC(isOfferer);
    });
  });
}

// Join the call using the secret code entered by the user
function joinCall() {
  const codeInput = document.getElementById('codeInput').value;
  if (!codeInput) {
    alert('Please enter a valid code!');
    return;
  }
  roomHash = codeInput;
  const roomName = 'observable-' + roomHash;

  drone = new ScaleDrone('yiS12Ts5RdNhebyM');  // Replace with your ScaleDrone channel ID
  drone.on('open', error => {
    if (error) return console.error(error);
    room = drone.subscribe(roomName);
    room.on('open', error => {
      if (error) return onError(error);
    });
    room.on('members', members => {
      console.log('Members:', members);
      const isOfferer = members.length === 2;
      startWebRTC(isOfferer);
    });
  });
}

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({ 'candidate': event.candidate });
    }
  };

  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
    };
  }

  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
    }
  };

  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  }).then(stream => {
    localVideo.srcObject = stream;
    localStream = stream;  // Save the local stream for muting/unmuting
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }, onError);

  room.on('data', (message, client) => {
    if (client.id === drone.clientId) return;

    if (message.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        if (pc.remoteDescription.type === 'offer') {
          pc.createAnswer().then(localDescCreated).catch(onError);
        }
      }, onError);
    } else if (message.candidate) {
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate), onSuccess, onError
      );
    }
  });
}

function localDescCreated(desc) {
  pc.setLocalDescription(
    desc,
    () => sendMessage({ 'sdp': pc.localDescription }),
    onError
  );
}

function sendMessage(message) {
  drone.publish({
    room: 'observable-' + roomHash,
    message
  });
}

// End the call
function endCall() {
  if (pc) {
    pc.close();
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  document.getElementById('startCallBtn').disabled = false;
  document.getElementById('joinBtn').disabled = true;
  document.getElementById('codeInput').value = '';
  document.querySelector('.status-message').innerText = 'Send your URL to a friend to start a video call';
}

// Mute or Unmute the microphone
function muteUnmute() {
  const track = localStream.getTracks().find(track => track.kind === 'audio');
  if (track) {
    isMuted = !isMuted;
    track.enabled = !isMuted;
    document.getElementById('muteBtn').innerText = isMuted ? 'Unmute' : 'Mute';
  }
}

// Share the URL with others
function shareURL() {
  const url = window.location.href + '#' + roomHash;
  prompt('Share this URL with others to join the call:', url);
}

