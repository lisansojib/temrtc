var webrtcMessages = [];

function WebRTC(options) {
    //Init Parameters    
    this.userToken = options.userToken;
    this.participantToken = options.participantToken;
    this.roomToken = options.roomToken;
    this.HRoomToken = $("#hiddenRoomToken").val();

    this.clientVideo = document.getElementById(options.clientVideo);
    this.remoteVideo = document.getElementById(options.remoteVideo);
    this.divRemoteVideo = document.getElementById("div-" + options.remoteVideo);
    this.divNoResponsePanel = document.getElementById("div-div-" + options.remoteVideo);
    this.divReconnectButton = document.getElementById("div-reconnect-" + options.remoteVideo);
    this.spanTimeDuration = document.getElementById("spanTimeDuration-" + options.remoteVideo);
    this.roomNameType = $("#hiddenRoomNameType").val();

    this.timeStart = 0;
    this.tryConnectTimes = 0;

    this.myPhoto = "/Content/ProfilePhoto/" + $("#hiddenMyPhoto").val();
    if (this.myPhoto == "/Content/ProfilePhoto/")
        this.myPhoto = "/Content/Images/no-image.jpg";
    this.myUserName = $("#hiddenMyUserName").val();

    this.partUserName = "";
    this.partPhoto = "";
    this.iceServerList = [];

    var that = this;

    //Init Global
    this.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.getUserMedia;
    this.PeerConnection = window.webkitRTCPeerConnection || window.mozRTCPeerConnection || window.RTCPeerConnection || window.PeerConnection;
    this.SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.RTCSessionDescription || window.SessionDescription;
    this.IceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.RTCIceCandidate || window.IceCandidate;
    this.URL = window.webkitURL || window.URL;
    this.global = {};
    this.dataChannel = null;
    this.peerConnection;
    
    //record audio, video    
    this.recordAudio = null;
    this.recordVideo = null;
    this.recordAudioAndVideo = 0;
    this.recordAudioAndVideoSuccessful = false;
    

    this.sdpConstraints = {
        optional: [],
        mandatory: { OfferToReceiveAudio: true, OfferToReceiveVideo: true }
    };
    this.global.mediaAccessAlertMessage = 'This app wants to use your camera and microphone.\n\nGrant it the access!';

    $(this.divReconnectButton).click(function () {
        that.tryConnectTimes = 0;
        $(that.divRemoteVideo).show();
        $(that.divNoResponsePanel).hide();
        that.waitForParticipant();
    });

    //Capture Camers
    this.captureCamera = function () {        
        this.getUserMedia.call(navigator, { audio: true, video: true }, function (stream) {
            if (!navigator.mozGetUserMedia)
                that.clientVideo.src = that.URL.createObjectURL(stream);
            else
                that.clientVideo.mozSrcObject = stream;

            that.global.clientStream = stream;
            that.clientVideo.play();
        }, function (e) {
            console.log("video camera rejected: ", e);
            toastr.warning(e.name + ", " + e.message);
        });
    };

    //Init WebRTC
    this.init = function () {
        try {
            //var iceServers = [];

            //iceServers.push({
            //    url: 'stun:23.21.150.121'
            //});

            //iceServers.push({
            //    url: 'stun:stun.services.mozilla.com'
            //});

            var iceServers = that.iceServerList;

            this.peerConnection = new this.PeerConnection({ "iceServers": iceServers }, { optional: [{ RtpDataChannels: false }] });
            this.peerConnection.onicecandidate = this.checkLocalICE;

            this.peerConnection.onaddstream = this.checkRemoteStream;
            this.peerConnection.addStream(this.global.clientStream);

            this.peerConnection.oniceconnectionstatechange = function () {
                if (that.peerConnection.iceConnectionState == "disconnected") {
                    $("#btnSendAttachmentFile").removeAttr("disabled");                    
                    $("#btnSendMessage").removeAttr("disabled");

                    var html = "<div style='text-align:center;font-weight:bold;'>---------- " + that.partUserName + " Leave ----------</div>";
                    $("#txtLog").append(html);

                    that.scroolTxtLog();

                    if (that.roomNameType == "Single-Call-Room") {
                        toastr.warning(that.partUserName + " Leave.");
                        //setTimeout(function () {
                        //    location.href = "/User/Dashboard";
                        //}, 3000);
                        $("#btnEndCall").click();
                    }
                }
            };

            //Init datachannel
            this.dataChannel = this.peerConnection.createDataChannel(this.roomToken, { reliable: false });
            this.dataChannel.onerror = function (error) {
                console.log("Data Channel Error:", error);
            };

            this.dataChannel.onopen = function () {
                //that.dataChannel.send("Hello World!");
                console.log("data channel open");
                that.dataChannel.onmessage = that.onMessage;
            };

            this.peerConnection.ondatachannel = function (event) {
                that.dataChannel = event.channel;
                that.dataChannel.onerror = function (error) { console.log("Data Channel Error:", error); };
                that.dataChannel.onopen = function () {
                    //that.dataChannel.send("Hello World!");
                    console.log("data channel open");
                    that.dataChannel.onmessage = that.onMessage;
                };
            };
            
        } catch (e) {
            //document.title = 'WebRTC is not supported in this web browser!';
            //alert('WebRTC is not supported in this web browser!');
            console.log(e);
        }
    };

    //Create Offer
    this.createOffer = function () {
        $.get("https://service.xirsys.com/ice",
                {
                    ident: "cloudsky",
                    secret: "b58d56d2-e2b5-11e5-b9fd-f2c0744ca434",
                    domain: "www.ozrtc.com",
                    application: "ozrtc",
                    room: "ozrtcroom",
                    secure: 1
                },
                function (data, status) {
                    that.iceServerList = data.d.iceServers;

                    that.init();

                    that.peerConnection.createOffer(function (sessionDescription) {
                        that.peerConnection.setLocalDescription(sessionDescription);
                        sdp = JSON.stringify(sessionDescription);
                        var data = { sdp: sdp, userToken: that.userToken, roomToken: that.roomToken, };

                        $.post("/WebRTC/PostSDP", data, function (response) {
                            if (response != false) {
                                console.log("Posted offer successfully!");
                                that.waitForAnswer();
                            }
                        });
                    }, function (e) { console.log(e); }, that.sdpConstraints);
                }
        );
    };

    this.waitForAnswer = function () {        
        console.log("Waiting for answer...");

        $.get("/WebRTC/GetSDP?userToken=" + that.userToken + "&roomToken=" + that.roomToken, {}, function (response) {
            if (response != false) {                
                console.log("Got answer...");
                response = response.sdp;
                try {
                    sdp = JSON.parse(response);
                    that.peerConnection.setRemoteDescription(new that.SessionDescription(sdp));
                } catch (e) {
                    sdp = response;
                    that.peerConnection.setRemoteDescription(new that.SessionDescription(sdp));
                }


                that.checkRemoteICE();
            } else
                setTimeout(that.waitForAnswer, 3000);
        });
    };

    this.waitForOffer = function () {        
        console.log("Waiting for offer...");

        $.get("/WebRTC/GetSDP?userToken=" + that.userToken + "&roomToken=" + that.roomToken, {}, function (response) {
            if (response != false) {                
                console.log("Got offer...");
                that.createAnswer(response.sdp);

                that.partUserName = response.partUserName;
                that.partPhoto = "/Content/ProfilePhoto/" + (response.partPhoto == null ? "" : response.partPhoto);
                if (that.partPhoto == "/Content/ProfilePhoto/")
                    that.partPhoto = "/Content/Images/no-image.jpg";
            }
            else
                setTimeout(that.waitForOffer, 3000);
        });
    };

    this.createAnswer = function (sdpResponse) {
        $.get("https://service.xirsys.com/ice",
                {
                    ident: "cloudsky",
                    secret: "b58d56d2-e2b5-11e5-b9fd-f2c0744ca434",
                    domain: "www.ozrtc.com",
                    application: "ozrtc",
                    room: "ozrtcroom",
                    secure: 1
                },
                function (data, status) {
                    that.iceServerList = data.d.iceServers;

                    that.init();

                    var sdp;
                    try {
                        sdp = JSON.parse(sdpResponse);

                        that.peerConnection.setRemoteDescription(new that.SessionDescription(sdp));
                    } catch (e) {
                        sdp = sdpResponse;

                        that.peerConnection.setRemoteDescription(new that.SessionDescription(sdp));
                    }

                    that.peerConnection.createAnswer(function (sessionDescription) {
                        that.peerConnection.setLocalDescription(sessionDescription);
                        sdp = JSON.stringify(sessionDescription);

                        var data = { sdp: sdp, userToken: that.userToken, roomToken: that.roomToken };

                        $.post("/WebRTC/PostSDP", data, function (response) {
                            console.log("Posted answer successfully!");
                            that.checkRemoteICE();
                        });

                    }, function (e) { console.log(e); }, that.sdpConstraints);

                }
        );
        
    };

    this.checkRemoteICE = function () {
        if (that.global.isGotRemoteStream) return;

        if (!that.peerConnection) {
            setTimeout(that.checkRemoteICE, 3000);
            return;
        }

        $.get("/WebRTC/GetICE?userToken=" + that.userToken + "&roomToken=" + that.roomToken, {}, function (response) {
            if (response == false && !that.global.isGotRemoteStream)
                setTimeout(that.checkRemoteICE, 3000);
            else {
                try {
                    candidate = new that.IceCandidate({ sdpMLineIndex: response.label, candidate: JSON.parse(response.candidate) });
                    that.peerConnection.addIceCandidate(candidate);

                    !that.global.isGotRemoteStream && setTimeout(that.checkRemoteICE, 3000);
                } catch (e) {
                    try {
                        candidate = new that.IceCandidate({ sdpMLineIndex: response.label, candidate: JSON.parse(response.candidate) });
                        that.peerConnection.addIceCandidate(candidate);

                        !that.global.isGotRemoteStream && setTimeout(that.checkRemoteICE, 3000);
                    } catch (e) {
                        !that.global.isGotRemoteStream && setTimeout(that.checkRemoteICE, 3000);
                    }
                }
            }
        });
    };

    this.checkLocalICE = function (event) {
        if (that.global.isGotRemoteStream)
            return;
        //if (that.global.postICESuccessful)
        //    return;
        //that.global.postICESuccessful = true;

        var candidate = event.candidate;

        if (candidate) {
            var data = {
                candidate: JSON.stringify(candidate.candidate),
                label: candidate.sdpMLineIndex,
                userToken: that.userToken,
                roomToken: that.roomToken,
            };

            $.post("/WebRTC/PostICE", data, function (response) {                
                console.log("Posted an ICE candidate!");
            });
        }
    };



    this.checkRemoteStream = function (remoteEvent) {
        if (remoteEvent) {            
            console.log("Got a clue for remote video stream!");
            that.remoteVideo.play();

            if (!navigator.mozGetUserMedia) that.remoteVideo.src = that.URL.createObjectURL(remoteEvent.stream);
            else that.remoteVideo.mozSrcObject = remoteEvent.stream;

            //record audio and video
            //that.recordAudio = RecordRTC(remoteEvent.stream, {
            //    onAudioProcessStarted: function () {
            //        if (!navigator.mozGetUserMedia) {
            //            that.recordVideo.startRecording();
            //        }
            //    }
            //});

            //if (navigator.mozGetUserMedia) {
            //    that.recordAudio.startRecording();
            //}

            //if (!navigator.mozGetUserMedia) {
            //    that.recordVideo = RecordRTC(remoteEvent.stream, {
            //        type: 'video'
            //    });
            //    that.recordAudio.startRecording();
            //}

            that.waitUntilRemoteStreamStartFlowing();
        }
    };

    this.PostBlob = function (blob, fileType, fileName) {
        // FormData
        var formData = new FormData();
        formData.append(fileType + '-filename', fileName);
        formData.append(fileType + '-blob', blob);



        that.xhr("/RecordRTC/PostRecordedAudioVideo", formData, function (response) {
            console.log(response);
            that.recordAudioAndVideo++;
            if (!navigator.mozGetUserMedia && that.recordAudioAndVideo == 2)
                that.recordAudioAndVideoSuccessful = true;
            if (navigator.mozGetUserMedia && that.recordAudioAndVideo == 1)
                that.recordAudioAndVideoSuccessful = true;
        });
    };

    that.xhr = function (url, data, callback) {
        var request = new XMLHttpRequest();
        request.onreadystatechange = function () {
            if (request.readyState == 4 && request.status == 200) {
                callback(request.responseText);
            }
        };
     
        request.open('POST', url);
        request.send(data);
    };

    this.recordRTCData = function () {
        var fname = that.HRoomToken + "-" + that.myUserName + "-" + that.partUserName;

        try {
            if (!navigator.mozGetUserMedia) {
                that.recordAudio.stopRecording(function () {
                    that.PostBlob(that.recordAudio.getBlob(), 'audio', fname + '.wav');
                });
            } else {
                that.recordAudio.stopRecording(function (url) {
                    that.PostBlob(that.recordAudio.getBlob(), 'video', fname + '.webm');
                });
            }

            if (!navigator.mozGetUserMedia) {
                that.recordVideo.stopRecording(function () {
                    that.PostBlob(that.recordVideo.getBlob(), 'video', fname + '.webm');
                });
            }

            toastr.warning("Recording video that chat with " + that.partUserName + ", please waiting...", "Message", { timeOut: 300000 });
        }
        catch (ex) {
            that.recordAudioAndVideoSuccessful = true;
        }
    };

    this.waitUntilRemoteStreamStartFlowing = function () {
        console.log("Waiting for remote stream flow!");

        if (!(that.remoteVideo.readyState <= HTMLMediaElement.HAVE_CURRENT_DATA || that.remoteVideo.paused || that.remoteVideo.currentTime <= 0)) {
            that.global.isGotRemoteStream = true;
            console.log('Finally got the remote stream!');

            that.partOnLine();

        } else setTimeout(that.waitUntilRemoteStreamStartFlowing, 3000);
    };

    //Wait for Participant
    this.waitForParticipant = function () {        
        if (that.tryConnectTimes >= 10) {
            $(that.divRemoteVideo).hide();
            $(that.divNoResponsePanel).show();
            return;
        }
        that.tryConnectTimes++;

        console.log("Waiting for someone to participate.");        

        $.get("/WebRTC/GetParticipant?roomname=" + that.roomToken, {}, function (response) {
            if (response != false) {
                console.log("Connected with " + response.participant);
                that.partUserName = response.participant;
                that.partPhoto = "/Content/ProfilePhoto/" + (response.partPhoto == null ? "" : response.partPhoto);
                if (that.partPhoto == "/Content/ProfilePhoto/")
                    that.partPhoto = "/Content/Images/no-image.jpg";

                that.createOffer();
            } else {
                setTimeout(that.waitForParticipant, 5000);
            }

            
        });
    };

    this.onMessage = function (event) {
        var option = JSON.parse(event.data);

        //Save message
        if (option.type == "text" || option.type == "file") {
            var currentTime = new Date();
            if (webrtcMessages.length == 0 || (currentTime.getTime() - webrtcMessages[webrtcMessages.length - 1].time > 120000)) {
                var html = "<div style='text-align:center;font-weight:bold;margin-top:7px;'><span class='webrtcTimeStamp'>" + currentTime.getHours() + ":" + currentTime.getMinutes() + "</span></div>";
                $("#txtLog").append(html);
                that.scroolTxtLog();

                that.saveMessage({ MessageSender: that.participantToken, MessageType: "TimeStamp", MessageContent: currentTime.getHours() + ":" + currentTime.getMinutes() });
            }

            that.saveMessage({ MessageSender: that.participantToken, MessageType: option.type, MessageContent: option.key1 });
            option.time = (new Date()).getTime();
            webrtcMessages.push(option);
        }

        var messageHtml = "";
        if (option.type == "text") {
            messageHtml = option.key1;
            for (var i = 1; i <= 30; i++) {
                var ii = i >= 10 ? i : "0" + i;
                messageHtml = messageHtml.replace("/e" + ii, '<img src="/Content/emoticons/e' + ii + '.png" style=""/>');
            }
        }
        else if (option.type == "file")
            messageHtml = "<a href='/Content/UploatAttachment/" + option.key1 + "' target='_blank' style='color:white;font-weight:bold;'>" + option.key2 + "</a>";
        else if (option.type == "canvas") {            
            console.log("received canvas");
            if (option.key2 == "Direct") {
                $("#imgCanvasAreaImageData").attr('src', option.key1);
                var iframeDoc = window.frames["iframeCanvasArea"].document;
                var canvas = iframeDoc.getElementById('myCanvas');
                var ctx = canvas.getContext('2d');
                ctx.drawImage(document.getElementById("imgCanvasAreaImageData"), 0, 0);
            }
            else {
                $.get("/WebRTC/GetCanvasData", { filename: option.key1 }, function (response) {
                    $("#imgCanvasAreaImageData").attr('src', response.Data);
                    var iframeDoc = window.frames["iframeCanvasArea"].document;
                    var canvas = iframeDoc.getElementById('myCanvas');
                    var ctx = canvas.getContext('2d');

                    var frameImg = iframeDoc.getElementById("imgCanvasUnderImage");
                    ctx.drawImage(document.getElementById("imgCanvasAreaImageData"), 0, 0, $(frameImg).width(), $(frameImg).height());
                });
            }



            //var html = "<div style='text-align:center;font-weight:bold;'>---------- Canvas Area was updated by " + that.partUserName + " ----------</div>";
            //$("#txtLog").append(html);
            //that.scroolTxtLog();
            return;
        }
        else if (option.type == "startDrawCanvas") {
            $("#divCoverPanel").show();
            return;
        }
        else if (option.type == "uploadCanvasImage") {
            console.log("received canvas image:" + option.key1);
            var iframeDoc = window.frames["iframeCanvasArea"];            
            if (option.key2 == "Image")
                iframeDoc.setCanvasUnderImage(option.key1, option.opt.width, option.opt.height);
            else if (option.key2 == "PDF")
                iframeDoc.setCanvasPDF(option.key1);
            return;
        }
        else if (option.type == "SelectBind") {
            $("#selectPdfImageList").html(option.key1);
        }
        else if (option.type == "SelectBindChange") {
            var $select = $("#selectPdfImageList");

            var filename = "/Content/UploatAttachment/" + option.key1;
            $select.val(option.key1);

            var iframeDoc = window.frames["iframeCanvasArea"];
            iframeDoc.setCanvasUnderImage(filename, $select.attr("data-width"), $select.attr("data-height"));
        }


        var html = "<div class='webrtcMessageLeft'>\
                        <img src='" + that.partPhoto + "' class='senderPhoto'/>\
                        <div class='messageBody'>\
                            <span class='messageUserName'>" + that.partUserName + "</span>\
                            <p class='btn btn-success messageContent'>" + messageHtml + "</p>\
                        </div>\
                    </div>";
        $("#txtLog").append(html);
        that.scroolTxtLog();
    };

    this.sendMessage = function (option) {
        if (this.dataChannel == null || this.dataChannel.readyState != "open") {
            console.log("send message failed.");
            return;
        }

        var message = JSON.stringify(option);
        this.dataChannel.send(message);
        
        //Save message
        if (option.type == "text" || option.type == "file") {
            var currentTime = new Date();
            if (webrtcMessages.length == 0 || (currentTime.getTime() - webrtcMessages[webrtcMessages.length - 1].time > 120000)) {
                var html = "<div style='text-align:center;font-weight:bold;margin-top:7px;'><span class='webrtcTimeStamp'>" + currentTime.getHours() + ":" + currentTime.getMinutes() + "</span></div>";
                $("#txtLog").append(html);
                that.scroolTxtLog();

                that.saveMessage({ MessageSender: that.userToken, MessageType: "TimeStamp", MessageContent: currentTime.getHours() + ":" + currentTime.getMinutes() });
            }

            that.saveMessage({ MessageSender: that.userToken, MessageType: option.type, MessageContent: option.key1 });
            option.time = (new Date()).getTime();
            webrtcMessages.push(option);
        }

        var messageHtml = "";
        if (option.type == "text") {
            messageHtml = option.key1;
            for (var i = 1; i <= 30; i++) {
                var ii = i >= 10 ? i : "0" + i;
                messageHtml = messageHtml.replace("/e" + ii, '<img src="/Content/emoticons/e' + ii + '.png" style=""/>');
            }
        }
        else if (option.type == "file")
            messageHtml = "<a href='/Content/UploatAttachment/" + option.key1 + "' target='_blank' style='color:white;font-weight:bold;'>" + option.key2 + "</a>";
        else if (option.type == "canvas") {
            //var html = "<div style='text-align:center;font-weight:bold;'>---------- Canvas Area was updated by " + that.myUserName + " ----------</div>";
            //$("#txtLog").append(html);
            //that.scroolTxtLog();
            return;
        }
        else if (option.type == "startDrawCanvas") {
            $("#divCoverPanel").hide();
            return;
        }
        else if (option.type == "uploadCanvasImage") {
            console.log("upload canvas image");
            return;
        }

        var html = "<div class='webrtcMessageRight'>\
                        <div class='messageBody'>\
                            <span class='messageUserName'>" + this.myUserName + "</span>\
                            <p class='btn btn-success messageContent'>" + messageHtml + "</p>\
                        </div>\
                        <img src='" + this.myPhoto + "' class='senderPhoto'/>\
                    </div>";
        $("#txtLog").append(html);

        that.scroolTxtLog();
    };

    this.partOnLine = function () {
        $(that.remoteVideo).show();
        $(that.divRemoteVideo).hide();

        $("#btnSendAttachmentFile").removeAttr("disabled");        
        $("#btnSendMessage").removeAttr("disabled");
        $("#divDurationCallAudio").html("");

        var html = "<div style='text-align:center;font-weight:bold;'>---------- " + that.partUserName + " Join ----------</div>";
        $("#txtLog").append(html);

        that.scroolTxtLog();

        that.timeStart = (new Date()).getTime();
        setInterval(function () {
            var time = (new Date()).getTime();
            time = Math.ceil((time - that.timeStart) / 1000);
            var timeFormat = "";
            if (time >= 60) {
                var minutes = parseInt(time / 60);
                var seconds = time - minutes * 60;
                timeFormat = minutes + "m" + seconds + "s";
            }
            else {
                timeFormat = time + "s";
            }
            that.spanTimeDuration.innerHTML = timeFormat;
        }, 1000);
    };

    this.scroolTxtLog = function () {
        var txtLog = document.getElementById("txtLog");
        txtLog.scrollTop = txtLog.scrollHeight - txtLog.clientHeight;
    };

    this.saveMessage = function (option) {
        var data = {
            RoomToken: that.HRoomToken,
            MessageSender: option.MessageSender,
            MessageType: option.MessageType,
            MessageContent: option.MessageContent,
        };

        $.post("/WebRTC/SaveMessage", data, function (response) {
            console.log(response);
        });
    };    
}