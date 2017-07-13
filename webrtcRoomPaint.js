var webrtcs = [];
var pdfDataList = [];

$(document).ready(function () {
    var $txtMessage = $("#txtMessage");
    var $divCoverPanel = $("#divCoverPanel");
    var $spanCurrentTime = $("#spanCurrentTime");
    var $selectImageList = $("#selectPdfImageList");

    $("video[data-type='remote']").each(function (index, element) {
        var userid = $(element).attr("data-userid");
        var ownertoken = $(element).attr("data-ownertoken");
        var participantotken = $(element).attr("data-participantotken");
        var roomtoken = $(element).attr("data-roomtoken");

        var options = {
            userToken: userid == ownertoken ? ownertoken : participantotken,
            roomToken: roomtoken,
            clientVideo: "client-video",
            remoteVideo: $(element).attr("id"),
            participantToken: userid == ownertoken ? participantotken : ownertoken,
        };


        var webrtc = new WebRTC(options);

        if (index == 0)
            webrtc.captureCamera();
        else
            webrtc.global.clientStream = webrtcs[0].global.clientStream;

        webrtcs.push(webrtc);

        if (userid == ownertoken)
            webrtc.waitForParticipant();

        if (userid == participantotken)
            setTimeout(function () { webrtc.waitForOffer() }, 5000);
    });

    $("#btnSendMessage").click(function () {
        if ($txtMessage.val() == "") {
            toastr.warning("Message can't be empty!");
            return;
        }

        for (var i = 0; i < webrtcs.length; i++) {
            webrtcs[i].sendMessage({ type: 'text', key1: $txtMessage.val(), key2: '' });
        }

        $txtMessage.val("");
    });

    $("#btnEndCall").click(function () {
        for (var i = 0; i < webrtcs.length; i++) {
            webrtcs[i].recordRTCData();
        }
        //location.href = "/User/Dashboard";
        setInterval(function () {
            var allsuccessful = true;
            for (var i = 0; i < webrtcs.length; i++) {
                if (webrtcs[i].recordAudioAndVideoSuccessful == false) {
                    allsuccessful = false;
                    break;
                }
            }
            if (allsuccessful == true)
                location.href = "/User/Dashboard";
        }, 1000);
    });

    document.onkeydown = function (e) {
        var event = document.all ? window.event : e;
        if (event.keyCode == 13) {
            $("#btnSendMessage").click();
            return false;
        }
        else if (event.keyCode == 113) {
            $("#aTab1").tab("show");
            return false;
        }
        else if (event.keyCode == 114) {
            $("#aTab2").tab("show");
            return false;
        }
    };

    $("#attachment").fileupload({
        url: "/User/UploadAttachment",
        dataType: 'json',
        done: function (e, data) {
            if (data.result.Successful == true) {
                for (var i = 0; i < webrtcs.length; i++) {
                    webrtcs[i].sendMessage({ type: 'file', key1: data.result.FileName, key2: data.result.OriginalFileName });
                }
            }
            $("#modalUploadAttachment").modal("hide");
        },
    });

    $("#btnSumbitCanvasArea").click(function () {
        var iframeDoc = window.frames["iframeCanvasArea"].document;
        var canvas = iframeDoc.getElementById('myCanvas');
        var imgStr = canvas.toDataURL();
        console.log(imgStr);

        for (var i = 0; i < webrtcs.length; i++) {
            webrtcs[i].sendMessage({ type: 'canvas', key1: imgStr, key2: '' });
        }
        toastr.success("Canvas Area send successful!");
    });

    $("#btnSaveCanvasArea").click(function () {
        var iframeDoc = window.frames["iframeCanvasArea"].document;
        var canvas = iframeDoc.getElementById('myCanvas');
        var imgStr = canvas.toDataURL("image/png").replace("data:image/png;base64,", "");
        //console.log(imgStr);

        $.post("/User/SaveCanvasArea", { strBase64: imgStr, openImage: window.frames["iframeCanvasArea"].getImageSrc() }, function (response) {
            window.open("/User/DownloadImage/" + response);
        });
    });

    $selectImageList.change(function () {
        var iframeDoc = window.frames["iframeCanvasArea"];
        var filename = "/Content/UploatAttachment/" + $selectImageList.val();

        //Save canvas
        //var canvas = iframeDoc.document.getElementById("myCanvas");
        //var imgStr = canvas.toDataURL("image/png").replace("data:image/png;base64,", "");
        //var imgurl = iframeDoc.getImageSrc();
        //imgurl = imgurl.replace("/Content/UploatAttachment/", "");
        //var optPre = $selectImageList.find("option[value='" + imgurl + "']");
        //pdfDataList[parseInt(optPre.attr("data-index"))] = imgStr;


        iframeDoc.setCanvasUnderImage(filename, $selectImageList.attr("data-width"), $selectImageList.attr("data-height"));

        //Save canvas
        //var imgIndex = $selectImageList.find("option:selected").attr("data-index");
        //if (pdfDataList[parseInt(imgIndex)] != "") {
        //    $("#imgCanvasAreaImageData").attr('src', pdfDataList[parseInt(imgIndex)]);
        //    var ctx = canvas.getContext('2d');
        //    var frameImg = iframeDoc.document.getElementById("imgCanvasUnderImage");
        //    ctx.drawImage(document.getElementById("imgCanvasAreaImageData"), 0, 0, $(frameImg).width(), $(frameImg).height());
        //}
        

        for (var i = 0; i < webrtcs.length; i++) {
            webrtcs[i].sendMessage({ type: 'SelectBindChange', key1: $selectImageList.val(), key2: '' });
        }
    });

    $("#openfile").fileupload({
        url: "/User/UploadAttachment",
        dataType: 'json',
        done: function (e, data) {
            if (data.result.Successful == true) {
                console.log(data.result.FileName);
                //$("#imgCanvasAreaImageData").attr('src', "/Content/UploatAttachment/" + data.result.FileName);
                //var iframeDoc = window.frames["iframeCanvasArea"].document;
                //var canvas = iframeDoc.getElementById('myCanvas');
                //var ctx = canvas.getContext('2d');
                //var Scheduler = setInterval(function () {
                //    console.log("check image");
                //    if (document.getElementById("imgCanvasAreaImageData").complete == true) {
                //        ctx.drawImage(document.getElementById("imgCanvasAreaImageData"), 0, 0);
                //        clearInterval(Scheduler);
                //    }
                //}, 1000);                
                var filename = "/Content/UploatAttachment/" + data.result.FileName;
                pdfDataList = [];

                var iframeDoc = window.frames["iframeCanvasArea"];
                if (data.result.FileType == "Image") {
                    if (data.result.ImagesList == null)
                        iframeDoc.setCanvasUnderImage(filename, data.result.Width, data.result.Height);
                    else {
                        var html = "";
                        for (var i = 0; i < data.result.ImagesList.length; i++) {
                            html += "<option value='" + data.result.ImagesList[i] + "' data-url='' data-index='" + i + "'>Page " + (i + 1) + "</option>";
                            pdfDataList.push("");
                        }
                        filename = "/Content/UploatAttachment/" + data.result.ImagesList[0];
                        iframeDoc.setCanvasUnderImage(filename, data.result.Width, data.result.Height);

                        $selectImageList.attr("data-width", data.result.Width);
                        $selectImageList.attr("data-height", data.result.Height);
                        $selectImageList.html(html);

                        for (var i = 0; i < webrtcs.length; i++) {
                            webrtcs[i].sendMessage({ type: 'SelectBind', key1: html, key2: '' });
                        }
                    }
                }
                else if (data.result.FileType == "PDF")
                    iframeDoc.setCanvasPDF(filename);

                for (var i = 0; i < webrtcs.length; i++) {
                    webrtcs[i].sendMessage({ type: 'uploadCanvasImage', key1: filename, key2: data.result.FileType, opt: { width: data.result.Width, height: data.result.Height } });
                }
            }
            $("#modalOpenPicture").modal("hide");
        },
    });

    var $canvasPanel = $("#divCanvasPanel");
    var $textChatPanel = $("#divTextChatPanel");

    $("#btnChangeFloatTextChat").click(function () {
        if ($canvasPanel.hasClass("col-md-9")) {
            $canvasPanel.removeClass("col-md-9");
            $canvasPanel.addClass("col-md-6");
            $textChatPanel.show();
        }
        else {
            $canvasPanel.removeClass("col-md-6");
            $canvasPanel.addClass("col-md-9");
            $textChatPanel.hide();
        }
    });

    $("#btnStartDrawCanvas").click(function () {
        for (var i = 0; i < webrtcs.length; i++) {
            webrtcs[i].sendMessage({ type: 'startDrawCanvas', key1: "", key2: '' });
        }
    });

    $("#btnOpenCanvasPicture").click(function () {
        $("#btnStartDrawCanvas").click();
        $('#modalOpenPicture').modal('show');        
    });

    $("#btnChooseFromFileLibrary").click(function () {
        $("#btnStartDrawCanvas").click();
        $('#modalChooseFileFromFileLibrary').modal('show');
    });

    setInterval(function () {
        if ($divCoverPanel.is(":visible") == false) {
            var iframeDoc = window.frames["iframeCanvasArea"].document;
            var canvas = iframeDoc.getElementById('myCanvas');
            var imgStr = canvas.toDataURL();
            console.log("automatic send canvas, Canvas length is:" + imgStr.length);

            if (imgStr.length > 10000) {
                $.post("/WebRTC/PostCanvasData", { data: imgStr }, function (response) {
                    for (var i = 0; i < webrtcs.length; i++) {
                        webrtcs[i].sendMessage({ type: 'canvas', key1: response.FileName, key2: 'File' });
                    }
                });
            }
            else {
                for (var i = 0; i < webrtcs.length; i++) {
                    webrtcs[i].sendMessage({ type: 'canvas', key1: imgStr, key2: 'Direct' });
                }
            }
        }
    }, 8000);

    setInterval(function () {
        var time = new Date(),
            minutes = time.getMinutes(),
            seconds = time.getSeconds();
        var m = minutes < 10 ? "0" + minutes : minutes;
        var s = seconds < 10 ? "0" + seconds : seconds;

        var timeFormat1 = time.getFullYear() + "-" + time.getMonth() + "-" + time.getDate();
        var timeFormat2 = time.getHours() + ":" + m + ":" + s;
        $spanCurrentTime.html(timeFormat1 + " " + timeFormat2);
    }, 1000);

    $(".mapIcon").find("img").click(function () {
        var icon = $(this).attr("data-icon");
        var mes = $txtMessage.val();
        $txtMessage.val(mes + "/" + icon);
        $('#modalEmocicon').modal('hide');
    });
});

function chooseFileFromLibrary(obj) {
    var filename = "/Content/UploatAttachment/" + $(obj).attr("data-filename");    
    var filetype = $(obj).attr("data-filetype");
    var $selectImageList = $("#selectPdfImageList");

    var iframeDoc = window.frames["iframeCanvasArea"];
    if (filetype == "Image") {
        iframeDoc.setCanvasUnderImage(filename, 0, 0);
        for (var i = 0; i < webrtcs.length; i++) {
            webrtcs[i].sendMessage({ type: 'uploadCanvasImage', key1: filename, key2: filetype, opt: { width: 0, height: 0 } });
        }
    }
    else if (filetype == "PDF") {
        $.post("/User/GhostPDF", { filename: $(obj).attr("data-realname"), savefilename: $(obj).attr("data-filename") }, function (response) {
            var html = "";
            for (var i = 0; i < response.ImagesList.length; i++) {
                html += "<option value='" + response.ImagesList[i] + "'>Page " + (i + 1) + "</option>";
            }
            var filename = "/Content/UploatAttachment/" + response.ImagesList[0];
            iframeDoc.setCanvasUnderImage(filename, response.Width, response.Height);

            $selectImageList.attr("data-width", response.Width);
            $selectImageList.attr("data-height", response.Height);
            $selectImageList.html(html);

            for (var i = 0; i < webrtcs.length; i++) {
                webrtcs[i].sendMessage({ type: 'SelectBind', key1: html, key2: '' });
            }


            for (var i = 0; i < webrtcs.length; i++) {
                webrtcs[i].sendMessage({ type: 'uploadCanvasImage', key1: filename, key2: "Image", opt: { width: response.Width, height: response.Height } });
            }
        });
    }

    $("#modalChooseFileFromFileLibrary").modal("hide");
}
