var webrtcs = [];
var pdfDataList = [];
var iframeCanvasArea;

$(document).ready(function () {
    var $txtMessage = $("#txtMessage");
    var $divCoverPanel = $("#divCoverPanel");
    var $spanCurrentTime = $("#spanCurrentTime");
    var $selectImageList = $("#selectPdfImageList");
    iframeCanvasArea = window.frames[0];

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
        $("#txtSaveCanvasFileName").val("");
        $("#modalSaveCanvas").modal("show");
    });


    $("button[id*=submitSaveCanvas]").click(function () {
        var canvasList = iframeCanvasArea.getAllCanvas();
        var imagelist = iframeCanvasArea.getAllImage();
        var type = $(this).attr("data-type");

        var canvasData = [];
        for (var i = 0; i < canvasList.length; i++) {
            canvasData.push(canvasList[i].toDataURL("image/png").replace("data:image/png;base64,", ""));
        }

        $.post("/User/SaveCanvasArea",
            {
                strBase64: canvasData.join(","),
                openImage: imagelist.join(","),
                imagename: $("#txtSaveCanvasFileName").val(),
                type: type,
            }, function (response) {
                if (type == "FileLibrary") {
                    toastr.success("Successful!");
                    $("#modalSaveCanvas").modal("hide");
                }
                else {
                    window.open("/User/DownloadImage/" + response + "?f=" + $("#txtSaveCanvasFileName").val());
                }
            });
    });

    $selectImageList.change(function () {
        var value = $("#selectPdfImageList").val();
        var index = $("#selectPdfImageList").find("option:selected").attr("data-index");
        iframeCanvasArea.changePdfImageIndex(index);

        for (var i = 0; i < webrtcs.length; i++) {
            webrtcs[i].sendMessage({ type: 'SelectBindChange', key1: value, key2: index });
        }
    });

    $("#openfile").fileupload({
        url: "/User/UploadAttachment",
        dataType: 'json',
        done: function (e, data) {
            if (data.result.Successful == true) {                                                                    
                if (data.result.FileType == "Image") {
                    if (data.result.ImagesList == null) {
                        var list = [];
                        list.push(data.result.FileName);
                        for (var i = 0; i < webrtcs.length; i++) {
                            webrtcs[i].sendMessage({ type: 'SelectBind', key1: "", key2: list, opt: { Width: data.result.Width, Height: data.result.Height } });
                        }

                        iframeCanvasArea.setPdfImageList(list, data.result.Width, data.result.Height);
                    }
                    else {
                        var html = "";
                        for (var i = 0; i < data.result.ImagesList.length; i++) {
                            html += "<option value='" + data.result.ImagesList[i] + "' data-url='' data-index='" + i + "'>Page " + (i + 1) + "</option>";
                        }
                        $selectImageList.html(html);

                        for (var i = 0; i < webrtcs.length; i++) {
                            webrtcs[i].sendMessage({ type: 'SelectBind', key1: html, key2: data.result.ImagesList, opt: { Width: data.result.Width, Height: data.result.Height } });
                        }

                        iframeCanvasArea.setPdfImageList(data.result.ImagesList, data.result.Width, data.result.Height);

                    }
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

    if (filetype == "Image") {
        var list = [];
        list.push($(obj).attr("data-filename"));

        var width = $(obj).attr("data-width");
        var height = $(obj).attr("data-height");

        if (width == "" || height == "") {
            $.post("/FileLibrary/SetImageSize", { fileid: $(obj).attr("data-id") }, function (response) {
                width = parseInt(response.Width);
                height = parseInt(response.Height);

                for (var i = 0; i < webrtcs.length; i++) {
                    webrtcs[i].sendMessage({ type: 'SelectBind', key1: "", key2: list, opt: { Width: width, Height: height } });
                }

                iframeCanvasArea.setPdfImageList(list, width, height);
            });
        }
        else {
            width = parseInt(width);
            height = parseInt(height);
            for (var i = 0; i < webrtcs.length; i++) {
                webrtcs[i].sendMessage({ type: 'SelectBind', key1: "", key2: list, opt: { Width: width, Height: height } });
            }

            iframeCanvasArea.setPdfImageList(list, width, height);
        }
    }
    else if (filetype == "PDF") {
        $.post("/User/GhostPDF", { filename: $(obj).attr("data-realname"), savefilename: $(obj).attr("data-filename") }, function (response) {
            var html = "";
            for (var i = 0; i < response.ImagesList.length; i++) {        
                html += "<option value='" + response.ImagesList[i] + "' data-url='' data-index='" + i + "'>Page " + (i + 1) + "</option>";
            }            
            $selectImageList.html(html);

            for (var i = 0; i < webrtcs.length; i++) {
                webrtcs[i].sendMessage({ type: 'SelectBind', key1: html, key2: response.ImagesList, opt: { Width: response.Width, Height: response.Height } });
            }

            iframeCanvasArea.setPdfImageList(response.ImagesList, response.Width, response.Height);
        });
    }

    $("#modalChooseFileFromFileLibrary").modal("hide");
}

function canvasMouseUp() {
    var canvas = iframeCanvasArea.getActiveCanvas();
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
