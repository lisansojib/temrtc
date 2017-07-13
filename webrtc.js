window.PeerConnection = window.webkitRTCPeerConnection || window.mozRTCPeerConnection || window.RTCPeerConnection;
window.SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.RTCSessionDescription;
window.IceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.RTCIceCandidate;

window.URL = window.webkitURL || window.URL;
navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.getUserMedia;

/* -------------------------------------------------------------------------------------------------------------------------- */
var global = { };

var RTC = { }, peerConnection;

var clientVideo = document.getElementById("client-video");
var remoteVideo = document.getElementById("remote-video");

RTC.init = function () {
    try {
        var iceServers = [];

        iceServers.push({
            url: 'stun:23.21.150.121'
        });

        iceServers.push({
            url: 'stun:stun.services.mozilla.com'
        });

        peerConnection = new window.PeerConnection({ "iceServers": iceServers });
        peerConnection.onicecandidate = RTC.checkLocalICE;

        peerConnection.onaddstream = RTC.checkRemoteStream;
        peerConnection.addStream(global.clientStream);
    } catch (e) {
        document.title = 'WebRTC is not supported in this web browser!';
        console.log(e);
        alert('WebRTC is not supported in this web browser!');
    }
};

var sdpConstraints = {
    optional: [],
    mandatory: {
        OfferToReceiveAudio: true,
        OfferToReceiveVideo: true
    }
};

RTC.createOffer = function () {    
    RTC.init();

    peerConnection.createOffer(function (sessionDescription) {
        peerConnection.setLocalDescription(sessionDescription);        
        sdp = JSON.stringify(sessionDescription);
        var data = {
            sdp: sdp,
            userToken: global.userToken,
            roomToken: global.roomToken,            
        };

        $.post("/WebRTC/PostSDP", data, function (response) {
            if (response != false) {
                console.log("Posted offer successfully!");
                RTC.waitForAnswer();
            }
        });

    }, function (e) { console.log(e); }, sdpConstraints);
};

RTC.waitForAnswer = function () {
    console.log("Waiting for answer...");

    $.get("/WebRTC/GetSDP?userToken=" + global.userToken + "&roomToken=" + global.roomToken, {}, function (response) {
        if (response != false) {
            console.log("Got answer...");
            response = response.sdp;
            try {
                sdp = JSON.parse(response);
                peerConnection.setRemoteDescription(new window.SessionDescription(sdp));
            } catch (e) {
                sdp = response;
                peerConnection.setRemoteDescription(new window.SessionDescription(sdp));
            }


            RTC.checkRemoteICE();
        } else
            setTimeout(RTC.waitForAnswer, 3000);
    });
};

RTC.waitForOffer = function () {
    console.log("Waiting for offer...");

    $.get("/WebRTC/GetSDP?userToken=" + global.userToken + "&roomToken=" + global.roomToken, {}, function (response) {
        if (response != false) {
            console.log("Got offer...");
            RTC.createAnswer(response.sdp);
        }
        else
            setTimeout(RTC.waitForOffer, 3000);
    });
};

RTC.createAnswer = function(sdpResponse) {
    RTC.init();

    var sdp;
    try {
        sdp = JSON.parse(sdpResponse);

        peerConnection.setRemoteDescription(new window.SessionDescription(sdp));
    } catch(e) {
        sdp = sdpResponse;

        peerConnection.setRemoteDescription(new window.SessionDescription(sdp));
    }

    peerConnection.createAnswer(function (sessionDescription) {
        peerConnection.setLocalDescription(sessionDescription);               
        sdp = JSON.stringify(sessionDescription);

        var data = {
            sdp: sdp,
            userToken: global.userToken,
            roomToken: global.roomToken,            
        };

        $.post("/WebRTC/PostSDP", data, function (response) {
            console.log("Posted answer successfully!");            
            RTC.checkRemoteICE();
        });

    }, function (e) { console.log(e); }, sdpConstraints);
};

RTC.checkRemoteICE = function() {
    if (global.isGotRemoteStream) return;

    if (!peerConnection) {
        setTimeout(RTC.checkRemoteICE, 3000);
        return;
    }

    $.get("/WebRTC/GetICE?userToken=" + global.userToken + "&roomToken=" + global.roomToken, {}, function (response) {
        if (response == false && !global.isGotRemoteStream)
            setTimeout(RTC.checkRemoteICE, 3000);
        else {            
            try {
                candidate = new window.IceCandidate({ sdpMLineIndex: response.label, candidate: JSON.parse(response.candidate) });
                peerConnection.addIceCandidate(candidate);

                !global.isGotRemoteStream && setTimeout(RTC.checkRemoteICE, 3000);
            } catch (e) {
                try {
                    candidate = new window.IceCandidate({ sdpMLineIndex: response.label, candidate: JSON.parse(response.candidate) });
                    peerConnection.addIceCandidate(candidate);

                    !global.isGotRemoteStream && setTimeout(RTC.checkRemoteICE, 3000);
                } catch (e) {
                    !global.isGotRemoteStream && setTimeout(RTC.checkRemoteICE, 3000);
                }
            }
        }
    });
};

RTC.checkLocalICE = function (event) {    
    if (global.isGotRemoteStream)
        return;
    if (global.postICESuccessful)
        return;

    global.postICESuccessful = true;

    var candidate = event.candidate;

    if (candidate) {
        var data = {
            candidate: JSON.stringify(candidate.candidate),
            label: candidate.sdpMLineIndex,
            userToken: global.userToken,
            roomToken: global.roomToken,            
        };

        $.post("/WebRTC/PostICE", data, function (response) {
            console.log("Posted an ICE candidate!");
        });
    }
};



RTC.checkRemoteStream = function(remoteEvent) {
    if (remoteEvent) {
        console.log("Got a clue for remote video stream!");
        
        remoteVideo.play();

        if (!navigator.mozGetUserMedia) remoteVideo.src = window.URL.createObjectURL(remoteEvent.stream);
        else remoteVideo.mozSrcObject = remoteEvent.stream;

        RTC.waitUntilRemoteStreamStartFlowing();
    }
};

RTC.waitUntilRemoteStreamStartFlowing = function() {    
    console.log("Waiting for remote stream flow!");
    if (!(remoteVideo.readyState <= HTMLMediaElement.HAVE_CURRENT_DATA || remoteVideo.paused || remoteVideo.currentTime <= 0)) {
        global.isGotRemoteStream = true;

        console.log("Finally got the remote stream!");
        $(clientVideo).hide();
        $(remoteVideo).show();
    } else setTimeout(RTC.waitUntilRemoteStreamStartFlowing, 3000);
};

global.mediaAccessAlertMessage = 'This app wants to use your camera and microphone.\n\nGrant it the access!';

function waitForParticipant() {    
    console.log("Waiting for someone to participate.");

    $.get("/WebRTC/GetParticipant?roomname=" + $("#_roomname").val(), {}, function (response) {
        if (response != false) {                   
            console.log("Connected with " + response.participant);
            RTC.createOffer();
        } else {
            setTimeout(waitForParticipant, 5000);
        }
    });
}

if ($("#_userid").val() == $("#_ownertoken").val()) {
    global.userToken = $("#_ownertoken").val();
    global.roomToken = $("#_roomtoken").val();

    waitForParticipant();
}
else if ($("#_userid").val() == $("#_participanttoken").val()) {
    global.userToken = $("#_participanttoken").val();
    global.roomToken = $("#_roomtoken").val();

    setTimeout(function () { RTC.waitForOffer() }, 5000);
}

function captureCamera() {
    navigator.getUserMedia({ audio: true, video: true },
        function (stream) {
            if (!navigator.mozGetUserMedia)
                clientVideo.src = window.URL.createObjectURL(stream);
            else
                clientVideo.mozSrcObject = stream;

            global.clientStream = stream;
            clientVideo.play();
        },
        function () {
            location.reload();
        });
}
captureCamera();