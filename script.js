// Initialize Scaledrone
const drone = new ScaleDrone('yiS12Ts5RdNhebyM');

// This is the room name based on the secret code
let roomHash = window.location.hash.substring(1) || Math.floor(Math.random() * 0xFFFFFF).toString(16);

// Room name needs to be prefixed with 'observable-'
const roomName = 'observable-' + roomHash;

const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};

let room;
let pc;
let isMuted = false;

// Elements
const startCallBtn = document.getElementById('startCallBtn');
const endCallBtn = document.getElementById('endCallBtn');
const muteBtn = document.getElementById('muteBtn');
const shareBtn = document.getElementById('shareBtn');
const secretCodeField = document.getElementById('secretCodeField');
const joinButton = document.getElementById('joinButton');

// Handlers for buttons
startCallBtn.addEventListener('click', startCall);
endCallBtn.addEventListener('click', endCall);
muteBtn.addEventListener('click', mute);
shareBtn.addEventListener('click', shareLink);
joinButton.addEventListener('click', joinCall);

// Start the call and request media permissions
function startCall() {
  startCallBtn.disabled = true;
  endCallBtn.disabled = false;

  navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    .then(stream => {
      localVideo.srcObject = stream;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      room = drone.subscribe(roomName);
      room.on('open', (error) => {
        if (error) return console.error(error);
      });

      room.on('members', (members) => {
        const isOfferer = members.length === 2;
        startWebRTC(isOfferer);
      });

      room.on('data', handleSignalingData);
    })
    .catch(err => console.log('Error: ', err));
}

// End the call and stop media
// End the call and stop media
function endCall() {
  if (pc) { // Check if the peer connection exists
    pc.close();
    pc = null; // Reset pc to prevent further use

    // Stop all media tracks
    const localStream = localVideo.srcObject;
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    const remoteStream = remoteVideo.srcObject;
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
  }

  // Disable the buttons after ending the call
  startCallBtn.disabled = false;
  endCallBtn.disabled = true;

  // Reset video elements
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
}

// Mute/Unmute the microphone
function mute() {
  const stream = localVideo.srcObject;
  const audioTrack = stream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;

  isMuted = !isMuted;
  muteBtn.textContent = isMuted ? "Unmute" : "Mute";
}

// Share the link with the secret code
function shareLink() {
  const url = `${window.location.origin}${window.location.pathname}#${roomHash}`;
  prompt("Share this link with others:", url);
}

// Join the call with the secret code
function joinCall() {
  const code = secretCodeField.value;
  if (code) {
    window.location.hash = code;
    roomHash = code;
    startCall();
  } else {
    alert('Please enter a valid secret code!');
  }
}

// Start WebRTC Connection
function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendMessage({ 'candidate': event.candidate });
    }
  };

  pc.ontrack = (event) => {
    const stream = event.streams[0];
    remoteVideo.srcObject = stream;
  };

  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer()
        .then(localDescCreated)
        .catch(handleError);
    };
  }

  // Handle media stream from the user
  navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    .then(stream => {
      localVideo.srcObject = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    })
    .catch(handleError);
}

// Send signaling message
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

// Handle incoming signaling data
function handleSignalingData(message, client) {
  if (client.id === drone.clientId) return;

  if (message.sdp) {
    pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
      if (pc.remoteDescription.type === 'offer') {
        pc.createAnswer().then(localDescCreated).catch(handleError);
      }
    }, handleError);
  } else if (message.candidate) {
    pc.addIceCandidate(new RTCIceCandidate(message.candidate), () => {}, handleError);
  }
}

function localDescCreated(desc) {
  pc.setLocalDescription(desc, () => {
    sendMessage({ 'sdp': pc.localDescription });
  }, handleError);
}

function handleError(error) {
  console.log('Error: ', error);
}

