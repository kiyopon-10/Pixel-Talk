var mapPeers = {}

var labelUsername = document.querySelector('#label-username')
var usernameInput = document.querySelector('#username')
var codeInput = document.querySelector('#code')
var btnJoin = document.querySelector('#btn-join')
var btnCreate = document.querySelector('#btn-create')

var username
var code
var webSocket

function generateRandomCode() {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return code;
}

function webSocketOnMessage(event){
    console.log("Hey")
    var parsedData = JSON.parse(event.data)
    var peerUsername = parsedData['peer']
    var action = parsedData['action']

    console.log("username - ", username)
    console.log("peerUsername - ", peerUsername)

    // the user who sends the message will also recieve the message from the backend which should be ignored
    if(username == peerUsername){
        return;
    }

    var receiver_channel_name = parsedData['message']['receiver_channel_name']

    if(action=='new-peer'){
        createOffer(peerUsername, receiver_channel_name)
        return;
    }

    if(action=='new-offer'){
        var offer = parsedData['message']['sdp']

        createAnswer(offer, peerUsername, receiver_channel_name)

        return;
    }
    
    if(action=='new-answer'){
        var answer = parsedData['message']['sdp']

        var peer = mapPeers[peerUsername][0]
        peer.setRemoteDescription(answer)

        return;
    }

    // console.log(message)
}

btnCreate.addEventListener('click', ()=> {
    username = usernameInput.value;

    console.log('Username : ',username)

    if(username == ""){
        return;
    }

    usernameInput.value = ""
    usernameInput.disabled = true
    usernameInput.style.visibility = 'hidden'
    
    btnJoin.disabled = true
    btnJoin.style.visibility = 'hidden'
    btnCreate.disabled = true
    btnCreate.style.visibility = 'hidden'

    code = generateRandomCode()
    console.log('Code : ',code)

    labelUsername.innerHTML = 'Username - ' + username + '||' + "Room Code - " + code

    var loc = window.location
    var wsStart = 'ws://';

    if(loc.protocol == 'https:'){
        wsStart = 'wss://'
    }

    //var endPoint = wsStart + loc.host + loc.pathname
    var endPoint = wsStart + `127.0.0.1:8000/${code}`
    console.log(endPoint)

    webSocket = new WebSocket(endPoint)

    webSocket.addEventListener('open', (e)=> {
        console.log('Connection open')
        
        sendSignal('new-peer', {})
    })

    webSocket.addEventListener('message', webSocketOnMessage)

    webSocket.addEventListener('close', (e)=> {
        console.log('Connection close')
    })

    webSocket.addEventListener('error', (e)=> {
        console.log('Error occured')
    })
})

btnJoin.addEventListener('click', ()=> {
    username = usernameInput.value;
    code = codeInput.value;

    console.log('Username : ',username)

    if(username == "" || code == ""){
        return;
    }

    usernameInput.value = ""
    usernameInput.disabled = true
    usernameInput.style.visibility = 'hidden'
    
    codeInput.value = ""
    btnJoin.disabled = true
    btnJoin.style.visibility = 'hidden'
    btnCreate.disabled = true
    btnCreate.style.visibility = 'hidden'

    labelUsername.innerHTML = 'Username - ' + username + '||' + "Room Code - " + code

    var loc = window.location
    var wsStart = 'ws://';

    if(loc.protocol == 'https:'){
        wsStart = 'wss://'
    }

    //var endPoint = wsStart + loc.host + loc.pathname
    var endPoint = wsStart + `127.0.0.1:8000/${code}`
    console.log(endPoint)

    webSocket = new WebSocket(endPoint)

    webSocket.addEventListener('open', (e)=> {
        console.log('Connection open')
        
        sendSignal('new-peer', {})
    })

    webSocket.addEventListener('message', webSocketOnMessage)

    webSocket.addEventListener('close', (e)=> {
        console.log('Connection close')
    })

    webSocket.addEventListener('error', (e)=> {
        console.log('Error occured')
    })
})


//----------------------------------------------------------------------------------------------------------------------------------

var localStream = new MediaStream()

const constraints = {
    'video': true,
    'audio': true
}

const localVideo = document.querySelector('#local-video')

const btnToggleAudio = document.querySelector('#btn-toggle-audio')
const btnToggleVideo = document.querySelector('#btn-toggle-video')

var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream
        localVideo.srcObject = localStream
        localVideo.muted = true

        var audioTracks = stream.getAudioTracks()
        var videoTracks = stream.getVideoTracks()

        audioTracks[0].enabled = true;
        videoTracks[0].enabled = true;

        btnToggleAudio.addEventListener('click', ()=>{
            audioTracks[0].enabled = !audioTracks[0].enabled
            if(audioTracks[0].enabled){
                btnToggleAudio.innerHTML = 'Audio Mute'
                return;
            }
            btnToggleAudio.innerHTML = 'Audio Unmute'
        })

        btnToggleVideo.addEventListener('click', ()=>{
            videoTracks[0].enabled = !videoTracks[0].enabled
            if(videoTracks[0].enabled){
                btnToggleVideo.innerHTML = 'Video Off'
                return;
            }
            btnToggleVideo.innerHTML = 'Video On'
        })
    })
    .catch(error => {
        console.log("Error accessing media devices.", error)
    })


function sendSignal(action, message){
    var jsonStr = JSON.stringify({
        'peer': username,
        'action': action,
        'message': message
    })
    webSocket.send(jsonStr)
}

function createOffer(peerUsername, receiver_channel_name){
    var peer = new RTCPeerConnection(null)

    addLocalTracks(peer)

    var dc = peer.createDataChannel('channel')
    dc.addEventListener('open', () => {
        console.log('Connection  opened !')
    })
    dc.addEventListener('message', dcOnMessage)

    var remoteVideo = createVideo(peerUsername)
    setOnTrack(peer, remoteVideo)

    mapPeers[peerUsername] = [peer, dc]

    // After we create our remoteVideo Element, we are gonna call setOnTrack and it will set the onTrack listener which will add the
    // remoteMedia tracks to the media stream and the media stream will be the src object for the remoteVideo.

    peer.addEventListener('iceconnectionstatechange', () => {
        var iceConnectionState = peer.iceConnectionState;

        if(iceConnectionState == 'failed' || iceConnectionState == 'disconnected' || iceConnectionState == 'closed'){
            delete mapPeers[peerUsername]

            if(iceConnectionState != 'closed'){
                peer.close()
            }

            removeVideo(remoteVideo)
        }
    })

    peer.addEventListener('icecandidate', (event) => {
        if(event.candidate){
            // console.log("New ice candidate", JSON.stringify(peer.localDescription))

            return
        }

        sendSignal('new-offer', {
            'sdp' : peer.localDescription,
            'receiver_channel_name' : receiver_channel_name
        })
    })

    peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(()=>{
            console.log("Local description set successfully")
        })

}

function createAnswer(offer, peerUsername, receiver_channel_name){
    var peer = new RTCPeerConnection(null)

    addLocalTracks(peer)

    var remoteVideo = createVideo(peerUsername)
    setOnTrack(peer, remoteVideo)

    peer.addEventListener('datachannel', e => {
        peer.dc = e.channel
        peer.dc.addEventListener('open', () => {
            console.log('Connection  opened !')
        })
        peer.dc.addEventListener('message', dcOnMessage)
        mapPeers[peerUsername] = [peer, peer.dc]
    })

    // After we create our remoteVideo Element, we are gonna call setOnTrack and it will set the onTrack listener which will add the
    // remoteMedia tracks to the media stream and the media stream will be the src object for the remoteVideo.

    peer.addEventListener('iseconnectionstatechange', () => {
        var iceConnectionState = peer.iceConnectionState;

        if(iceConnectionState == 'failed' || iceConnectionState == 'disconnected' || iceConnectionState == 'closed'){
            delete mapPeers[peerUsername]

            if(iceConnectionState != 'closed'){
                peer.close()
            }

            removeVideo(remoteVideo)
        }
    })

    peer.addEventListener('icecandidate', (event) => {
        if(event.candidate){
            // console.log("New ice candidate", JSON.stringify(peer.localDescription))

            return
        }

        sendSignal('new-answer', {
            'sdp' : peer.localDescription,
            'receiver_channel_name' : receiver_channel_name
        })
    })

    peer.setRemoteDescription(offer)
        .then(()=>{
            console.log('Remote description set successfully for %s', peerUsername)

            return peer.createAnswer()
        })
        .then(a=>{
            console.log('Answer created')

            peer.setLocalDescription(a)
        })
}

function addLocalTracks(peer){
    localStream.getTracks().forEach(track =>{
        peer.addTrack(track, localStream)
    })

    return;
}

function dcOnMessage(event){
    var message = event.data

    var li = document.createElement('li')
    li.appendChild(document.createTextNode(message))
    messageList.appendChild(li)
}

function createVideo(peerUsername){
    var videoContainer = document.querySelector("#video-container")
    var remoteVideo = document.createElement('video')

    remoteVideo.id = peerUsername + '-video';
    remoteVideo.autoplay = true
    remoteVideo.playsnline = true

    var videoWrapper = document.createElement('div')
    videoContainer.appendChild(videoWrapper)
    videoWrapper.appendChild(remoteVideo)

    return remoteVideo;
}

function setOnTrack(peer, remoteVideo){
    var remoteStream = new MediaStream()

    remoteVideo.srcObject = remoteStream

    peer.addEventListener('track', async(event) => {
        remoteStream.addTrack(event.track, remoteStream)
        console.log("remote video added for ", username)
    })

    // console.log("remote video added for ", username)
}

function removeVideo(video){
    var videoWrapper = video.parentNode
    videoWrapper.parentNode.removeChild(videoWrapper)
}

// Get necessary DOM elements
// const btnShareScreen = document.getElementById('btn-share-screen');
const videoContainer = document.getElementById('video-container');

// Function to handle screen sharing
// async function startScreenSharing() {
//     try {
//         const stream = await navigator.mediaDevices.getDisplayMedia();
//         const videoElement = document.createElement('video');
//         videoElement.srcObject = stream;
//         videoElement.autoplay = true;
//         videoElement.controls = true;
//         videoContainer.appendChild(videoElement);
//     } catch (error) {
//         console.error('Error accessing screen:', error);
//     }
// }

// Event listener for screen sharing button
// btnShareScreen.addEventListener('click', startScreenSharing);

var btnSendMsg = document.querySelector('#btn-send-message')
var messageList = document.querySelector('#message-list')
var messageInput = document.querySelector('#msg')

btnSendMsg.addEventListener('click', sendMsgOnClick)

function sendMsgOnClick(){
    var message = messageInput.value
    console.log("message: ", message)

    var li = document.createElement('li')
    li.appendChild(document.createTextNode("Me: " + message))
    messageList.appendChild(li)

    var dataChannels = getDataChannels()

    message = username + ": " + message

    for(index in dataChannels){
        dataChannels[index].send(message)
    }

    messageInput.value = ''
}

function getDataChannels(){
    var dataChannels = []
    
    for(peerUsername in mapPeers){
        var dataChannel = mapPeers[peerUsername][1]
        dataChannels.push(dataChannel)
    }

    return dataChannels
}