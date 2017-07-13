webRTCApp.controller('fileLibraryCtrl', ['$http', '$scope', 'AppDataService', 'FileUpload', function ($http, $scope, AppDataService, FileUpload) {
    $scope.Id = document.getElementById("hiddenId").value;
    $scope.GTType = document.getElementById("hiddenGTType").value;
    $scope.UserID = document.getElementById("hiddenUserID").value;

    $scope.folders = {};
    $scope.files = {};
    $scope.navFolders = [];
    $scope.selectFolder = "";

    $scope.fileView = "preview";
    $scope.fileViewList = AppDataService.FileViewList;

    $scope.getFiles = function () {
        $http.get("/FileLibrary/Get?folderID=" + $scope.selectFolder + "&Id=" + $scope.Id + "&GTType=" + $scope.GTType).success(function (result) {
            $scope.folders = result.Folders;
            $scope.files = result.Files;

            $scope.navFolders = [];
            for (var i = result.NavFolders.length - 1; i >= 0; i--)
                $scope.navFolders.push(result.NavFolders[i]);
            console.log(result);
        });
    };

    $scope.getFiles();

    //Choose Folder
    $scope.chooseFolder = function (folder) {
        $scope.selectFolder = folder.Id;
        $scope.getFiles();
    };

    //New Folder
    $scope.folderAdd = { Name: "" };
    $scope.openNewFolder = function () {
        $scope.folderAdd = { Name: "" };
        $("#modalNewFolder").modal("show");
    };

    $scope.submitNewFolder = function () {
        if ($scope.folderAdd.Name == "") {
            toastr.warning("Folder Name can't be empty, please fill it and try again!");
            return;
        }

        $http({
            method: "POST",
            url: "/FileLibrary/NewFolder",
            data: $.param({ Name: $scope.folderAdd.Name, ParentID: $scope.selectFolder,Id: $scope.Id, GTType: $scope.GTType }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).
        success(function (result) {
            $("#modalNewFolder").modal("hide");
            toastr.success("Successful!");
            $scope.getFiles();
        })
        .error(function () {
        });
    };

    //Upload File
    $scope.openUploadFile = function () {
        $("#modalUploadFile").modal("show");
    };

    $scope.onUploadFile = function ($files) {
        if ($files == null)
            return;

        var uploadPhotoProperties = function (data) {
            console.log(data);
            if (data.data.Successful == false) {
                toastr.warning(data.data.Message);
                return;
            }

            $http({
                method: "POST",
                url: "/FileLibrary/SaveUploadFile",
                data: $.param({ FileName: data.data.FileName, SaveFileName: data.data.SaveFileName, FolderID: $scope.selectFolder, Id: $scope.Id, GTType: $scope.GTType }),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }).
            success(function (result) {
                $("#modalUploadFile").modal("hide");
                toastr.success("Successful!");
                $scope.getFiles();
            })
            .error(function () {
            });
        };

        if ($files.length > 0)
            FileUpload.uploadLibrary($files[0]).then(uploadPhotoProperties);
    };

    //Delete
    $scope.deleteEntry = { type: "", name: "", id: "" };
    $scope.openDelete = function (type, name, id) {
        $scope.deleteEntry = { type: type, name: name, id: id };
        $("#modalDeleteFolderOrFile").modal("show");
    };
    $scope.submitDelete = function () {
        $http({
            method: "POST",
            url: "/FileLibrary/Delete",
            data: $.param({ type: $scope.deleteEntry.type, id: $scope.deleteEntry.id }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).
        success(function (result) {
            $("#modalDeleteFolderOrFile").modal("hide");
            toastr.success("Successful!");
            $scope.getFiles();
        })
        .error(function () {
        });
    };


    //Rename
    $scope.renameEntry = { oldName: "", newName: "", type: "", fid: "", Id: $scope.Id, GTType: $scope.GTType };
    $scope.openRename = function (type, name, id) {
        $scope.renameEntry = { oldName: name, newName: name, type: type, fid: id, Id: $scope.Id, GTType: $scope.GTType };
        $("#modalRename").modal("show");
    };

    $scope.submitRename = function () {
        if ($scope.renameEntry.newName == "") {
            toastr.warning("Name can't be empty, please fill it and try again!");
            return;
        }
        $http({
            method: "POST",
            url: "/FileLibrary/Rename",
            data: $.param($scope.renameEntry),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).
        success(function (result) {
            toastr.success("Rename Successful!");
            $("#modalRename").modal("hide");
            $scope.getFiles();
        })
        .error(function () {
        });
    };

    //Share
    $scope.contacts = {};

    $scope.getContacts = function () {
        $http.get("/Contacts/GetContacts").success(function (result) {
            for (var i = 0; i < result.length; i++) {
                result[i].Checked = false;
            }
            $scope.contacts = result;            
        });
    };

    $scope.getContacts();

    $scope.groups = {};

    $scope.getGroups = function () {
        $http.get("/User/GetGroups").success(function (result) {
            console.log(result);
            for (var i = 0; i < result.length; i++) {
                result[i].Index = i + 1;
                result[i].Checked = false;
                for (var j = 0; j < result[i].Teams.length; j++)
                    result[i].Teams[j].Checked = false;
            }
            $scope.groups = result;
        });
    };

    $scope.getGroups();

    $scope.shareEntry = { type: "", fid: "" };
    $scope.openShare = function (type, name, id) {
        $scope.shareEntry = { type: type, fid: id };
        $("#modalShare").modal("show");
    };

    $scope.clearShare = function () {
        for (var i = 0; i < $scope.contacts.length; i++) {
            $scope.contacts[i].Checked == false;
        }
        for (var i = 0; i < $scope.groups.length; i++) {
            $scope.groups[i].Checked == false;
            for (var j = 0; j < $scope.groups[i].Teams.length; j++) {
                $scope.groups[i].Teams[j].Checked == false;
            }
        }
    };

    $scope.submitShare = function () {
        var gids = [];
        var tids = [];
        for (var i = 0; i < $scope.groups.length; i++) {
            if ($scope.groups[i].Checked == true) {
                gids.push($scope.groups[i].Id);
                for (var j = 0; j < $scope.groups[i].Teams.length; j++) {
                    if ($scope.groups[i].Teams[j].Checked == true)
                        tids.push($scope.groups[i].Teams[j].Id);
                }
            }
        }
        var cids = [];
        for (var i = 0; i < $scope.contacts.length; i++) {
            if ($scope.contacts[i].Checked == true)
                cids.push($scope.contacts[i].ContactUserID);
        }

        if (gids.length == 0 && tids.length == 0 && cids.length == 0) {
            toastr.warning("Please select at least one entry to share!");
            return;
        }
        var vm = { gids: gids.join(","), tids: tids.join(","), cids: cids.join(","), type: $scope.shareEntry.type, fid: $scope.shareEntry.fid, GTId: $scope.Id, GTType: $scope.GTType };
        console.log(vm);

        $http({
            method: "POST",
            url: "/FileLibrary/Share",
            data: $.param(vm),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).
        success(function (result) {
            toastr.success("Share Successful!");
            $("#modalShare").modal("hide");
        })
        .error(function () {
        });
    };

    //Open Choose
    $scope.folders2 = {};
    $scope.files2 = {};
    $scope.navFolders2 = [];
    $scope.selectFolder2 = "";

    $scope.getFiles2 = function () {
        $http.get("/FileLibrary/Get?folderID=" + $scope.selectFolder2 + "&Id=&GTType=File").success(function (result) {
            $scope.folders2 = result.Folders;
            $scope.files2 = result.Files;

            $scope.navFolders2 = [];
            for (var i = result.NavFolders.length - 1; i >= 0; i--)
                $scope.navFolders2.push(result.NavFolders[i]);
            console.log(result);
        });
    };

    $scope.getFiles2();

    //Choose Folder
    $scope.chooseFolder2 = function (folder) {
        $scope.selectFolder2 = folder.Id;
        $scope.getFiles2();
    };

    $scope.openChooseFileLibrary = function () {
        for (var i = 0; i < $scope.files2.length; i++) {
            $scope.files2[i].Check = false;
        }
        $("#modalOpenChooseFileLibrary").modal("show");
    };

    $scope.submitChooseFile = function () {
        var list = [];
        for (var i = 0; i < $scope.files2.length; i++) {
            if ($scope.files2[i].Check == true)
                list.push($scope.files2[i].Id);
        }
        if (list.length == 0) {
            toastr.warning("Please select at least one file!");
            return;
        }

        $http({
            method: "POST",
            url: "/FileLibrary/ChooseFileGT",
            data: $.param({ Id: $scope.Id, GTType: $scope.GTType, ids: list.join(",") }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).
        success(function (result) {
            toastr.success(result.exists + " Exists, " + result.added + " Added.");
            $("#modalOpenChooseFileLibrary").modal("hide");
            $scope.getFiles();
        })
        .error(function () {
        });
    };

    $scope.menuOptionsFolder = [
                ['Open', function ($itemScope) {
                    console.log($itemScope);
                    $scope.chooseFolder($itemScope.folder);
                }],
                null,
                ['Move to', function ($itemScope) {
                    console.log($itemScope);
                    toastr.warning("Comming soon.");
                }],
                ['Copy to', function ($itemScope) {
                    console.log($itemScope);
                    toastr.warning("Comming soon.");
                }],
                null,
                ['Rename', function ($itemScope) {
                    console.log($itemScope);
                    if ($scope.UserID == $itemScope.folder.UserID)
                        $scope.openRename("Folder", $itemScope.folder.Name, $itemScope.folder.Id);
                    else
                        toastr.warning("You haven't access to rename it.");
                }],
                ['Delete', function ($itemScope) {
                    console.log($itemScope);
                    if ($scope.UserID == $itemScope.folder.UserID)
                        $scope.openDelete("Folder", $itemScope.folder.Name, $itemScope.folder.Id);
                    else
                        toastr.warning("You haven't access to delete it.");
                }]
    ];

    $scope.menuOptionsFile = [
                ['Open', function ($itemScope) {
                    console.log($itemScope);
                    window.open("/Content/UploatAttachment/" + $itemScope.file.SaveFileName);
                }],
                ['Share', function ($itemScope) {
                    console.log($itemScope);
                    $scope.openShare("File", $itemScope.file.FileName, $itemScope.file.Id);
                }],
                null,
                ['Move to', function ($itemScope) {
                    console.log($itemScope);
                    toastr.warning("Comming soon.");
                }],
                ['Copy to', function ($itemScope) {
                    console.log($itemScope);
                    toastr.warning("Comming soon.");
                }],
                null,
                ['Rename', function ($itemScope) {
                    console.log($itemScope);
                    if ($scope.UserID == $itemScope.file.UserID)
                        $scope.openRename("File", $itemScope.file.FileName, $itemScope.file.Id);
                    else
                        toastr.warning("You haven't access to rename it.");
                }],
                ['Delete', function ($itemScope) {
                    console.log($itemScope);
                    if ($scope.UserID == $itemScope.file.UserID)
                        $scope.openDelete("File", $itemScope.file.FileName, $itemScope.file.Id);
                    else
                        toastr.warning("You haven't access to delete it.");
                }]
    ];

    $scope.openIframeFile = function (filename) {
        console.log(filename);
        $("#iframeOpenfile").attr("src", "/Content/UploatAttachment/" + filename);
        $("#modelOpenFileByIframe").modal("show");
    };
}]);



webRTCApp.controller('fileLibraryGTCtrl', ['$http', '$scope', 'AppDataService', 'FileUpload', function ($http, $scope, AppDataService, FileUpload) {    
    $scope.files = {};
    $scope.Id = document.getElementById("hiddenId").value;
    $scope.GTType = document.getElementById("hiddenGTType").value;

    $scope.fileView = "preview";
    $scope.fileViewList = AppDataService.FileViewList;

    $scope.getFiles = function () {
        $http.get("/FileLibrary/GetGT?Id=" + $scope.Id + "&GTType=" + $scope.GTType).success(function (result) {
            $scope.files = result.Files;
            console.log(result);
        });
    };

    $scope.getFiles();

    //Upload File
    $scope.openUploadFile = function () {
        $("#modalUploadFile").modal("show");
    };

    $scope.onUploadFile = function ($files) {
        if ($files == null)
            return;

        var uploadPhotoProperties = function (data) {
            console.log(data);
            $http({
                method: "POST",
                url: "/FileLibrary/SaveUploadFileGT",
                data: $.param({ FileName: data.data.FileName, SaveFileName: data.data.SaveFileName, Id: $scope.Id, GTType: $scope.GTType }),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }).
            success(function (result) {
                $("#modalUploadFile").modal("hide");
                toastr.success("Successful!");
                $scope.getFiles();
            })
            .error(function () {
            });
        };

        if ($files.length > 0)
            FileUpload.uploadLibrary($files[0]).then(uploadPhotoProperties);
    };

    //Delete
    $scope.deleteEntry = { type: "", name: "", id: "" };
    $scope.openDelete = function (type, name, id) {
        $scope.deleteEntry = { type: type, name: name, id: id };
        $("#modalDeleteFolderOrFile").modal("show");
    };
    $scope.submitDelete = function () {
        $http({
            method: "POST",
            url: "/FileLibrary/DeleteGT",
            data: $.param({ id: $scope.deleteEntry.id }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).
        success(function (result) {
            $("#modalDeleteFolderOrFile").modal("hide");
            toastr.success("Successful!");
            $scope.getFiles();
        })
        .error(function () {
        });
    };

    //Rename
    $scope.renameEntry = { oldName: "", newName: "", type: "", id: "" };
    $scope.openRename = function (type, name, id) {
        $scope.renameEntry = { oldName: name, newName: "", type: type, id: id };
        $("#modalRename").modal("show");
    };

    $scope.submitRename = function () {
        if ($scope.renameEntry.newName == "") {
            toastr.warning("Name can't be empty, please fill it and try again!");
            return;
        }
        $http({
            method: "POST",
            url: "/FileLibrary/RenameGT",
            data: $.param($scope.renameEntry),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).
        success(function (result) {
            toastr.success("Rename Successful!");
            $("#modalRename").modal("hide");
            $scope.getFiles();
        })
        .error(function () {
        });
    };



    //Open Choose
    $scope.folders2 = {};
    $scope.files2 = {};
    $scope.navFolders2 = [];
    $scope.selectFolder = "";

    $scope.getFiles2 = function () {
        $http.get("/FileLibrary/Get?folderID=" + $scope.selectFolder).success(function (result) {
            $scope.folders2 = result.Folders;
            $scope.files2 = result.Files;

            $scope.navFolders2 = [];
            for (var i = result.NavFolders.length - 1; i >= 0; i--)
                $scope.navFolders2.push(result.NavFolders[i]);
            console.log(result);
        });
    };

    $scope.getFiles2();

    //Choose Folder
    $scope.chooseFolder = function (folder) {
        $scope.selectFolder = folder.Id;
        $scope.getFiles2();
    };

    $scope.openChooseFileLibrary = function () {
        for (var i = 0; i < $scope.files2.length; i++) {
            $scope.files2[i].Check = false;
        }
        $("#modalOpenChooseFileLibrary").modal("show");
    };

    $scope.submitChooseFile = function () {
        var list = [];
        for (var i = 0; i < $scope.files2.length; i++) {
            if ($scope.files2[i].Check == true)
                list.push($scope.files2[i].Id);
        }
        if (list.length == 0) {
            toastr.warning("Please select at least one file!");
            return;
        }

        $http({
            method: "POST",
            url: "/FileLibrary/ChooseFileGT",
            data: $.param({ Id: $scope.Id, GTType: $scope.GTType, ids: list.join(",") }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).
        success(function (result) {
            toastr.success(result.exists + " Exists, " + result.added + " Added.");
            $("#modalOpenChooseFileLibrary").modal("hide");
            $scope.getFiles();
        })
        .error(function () {
        });
    };

    $scope.menuOptionsFolder = [
            ['Open', function ($itemScope) {
                console.log($itemScope);
                $scope.chooseFolder($itemScope.folder);
            }],
            null,
            ['Move to', function ($itemScope) {
                console.log($itemScope);
                toastr.warning("Comming soon.");
            }],
            ['Copy to', function ($itemScope) {
                console.log($itemScope);
                toastr.warning("Comming soon.");
            }],
            null,
            ['Rename', function ($itemScope) {
                console.log($itemScope);
                $scope.openRename("Folder", $itemScope.folder.Name, $itemScope.folder.Id);
            }],
            ['Delete', function ($itemScope) {
                console.log($itemScope);
                $scope.openDelete("Folder", $itemScope.folder.Name, $itemScope.folder.Id);
            }]
    ];

    $scope.menuOptionsFile = [
                ['Open', function ($itemScope) {
                    console.log($itemScope);
                    window.open("/Content/UploatAttachment/" + $itemScope.file.SaveFileName);
                }],
                null,
                ['Move to', function ($itemScope) {
                    console.log($itemScope);
                    toastr.warning("Comming soon.");
                }],
                ['Copy to', function ($itemScope) {
                    console.log($itemScope);
                    toastr.warning("Comming soon.");
                }],
                null,
                ['Rename', function ($itemScope) {
                    console.log($itemScope);
                    $scope.openRename("File", $itemScope.file.FileName, $itemScope.file.Id);
                }],
                ['Delete', function ($itemScope) {
                    console.log($itemScope);
                    $scope.openDelete("File", $itemScope.file.FileName, $itemScope.file.Id);
                }]
    ];
}]);