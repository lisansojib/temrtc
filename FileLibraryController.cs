using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using WebRTC.Data.Abstracts;
using WebRTC.Infrastructure.Helpers;
using WebRTC.Core.Entities;
using System.IO;
using System.Drawing;
using System.Data.Entity;
using WebRTC.Models;
using AutoMapper;

namespace WebRTC.Controllers
{
    [Authorize]
    public class FileLibraryController : BaseController
    {
        private readonly IFileRepository _fileRepository;
        private readonly IGTFileRepository _gtFileRepository;
        private readonly IGroupRepository _groupRepository;
        private readonly ITeamRepository _teamRepository;
        private readonly IFolderRepository _folderRepository;
        private readonly IGTFolderRepository _gtFolderRepository;
        private readonly ICommonHelper _commonHelper;
        private readonly IMapper _mapper;

        public FileLibraryController(
            IFileRepository fileRepository,
            IGTFileRepository gtFileRepository,
            IGroupRepository groupRepository,
            ITeamRepository teamRepository,
            IFolderRepository folderRepository,
            IGTFolderRepository gtFolderRepository,
            ICommonHelper commonHelper,
            IMapper mapper)
        {
            _fileRepository = fileRepository;
            _gtFileRepository = gtFileRepository;
            _groupRepository = groupRepository;
            _teamRepository = teamRepository;
            _folderRepository = folderRepository;
            _gtFolderRepository = gtFolderRepository;
            _commonHelper = commonHelper;
            _mapper = mapper;
        }

        /// <summary>
        /// FileLibrary/Index
        /// </summary>
        /// <returns></returns>
        public ActionResult Index()
        {
            ViewBag.Id = "";
            ViewBag.GTType = "File";
            ViewBag.GTName = "";

            return View();
        }

        public ActionResult Group(string id)
        {
            var group = _groupRepository.GetSingle(id);

            ViewBag.Id = id;
            ViewBag.GTType = "Group";
            ViewBag.GTName = group.Name;

            return View("~/Views/FileLibrary/Index.cshtml");
        }

        public ActionResult Team(string id)
        {
            var team = _teamRepository.GetSingle(id);

            ViewBag.Id = id;
            ViewBag.GTType = "Team";
            ViewBag.GTName = team.Name;

            return View("~/Views/FileLibrary/Index.cshtml");
        }

        [HttpPost]
        public ActionResult NewFolder(string Name, string ParentID, string Id, string GTType)
        {
            if (GTType == "File")
            {
                var folder = new Folder
                {
                    UserID = UserId,
                    Name = Name,
                    ParentID = ParentID
                };

                _folderRepository.Save(folder);
            }
            else
            {
                var folder = new GTFolder
                {
                    UserID = UserId,
                    UserName = UserName,
                    GTID = Id,
                    GTType = GTType,
                    Name = Name,
                    ParentID = ParentID
                };

                _gtFolderRepository.Save(folder);
            }

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpGet]
        public ActionResult Get(string folderID, string Id, string GTType)
        {
            if (String.IsNullOrEmpty(folderID) == true)
                folderID = "";
            if (String.IsNullOrEmpty(Id) == true)
                Id = "";

            if (GTType == "File")
            {
                var folders = _folderRepository.FindBy(x => x.UserID == UserId && x.ParentID == folderID).ToList();
                var files = _fileRepository.FindBy(x => x.UserID == UserId && x.FolderID == folderID).ToList();

                var navFolders = new List<Folder>();
                for (int i = 0; i < 10; i++)
                {
                    if (folderID == "")
                    {
                        navFolders.Add(new Folder { Name = "All Files", Id = "", Discriminator = "" });
                        break;
                    }
                    else
                    {
                        var folder = _folderRepository.GetSingle(folderID);
                        navFolders.Add(folder);

                        folderID = folder.ParentID;
                    }
                }
                navFolders[0].Discriminator = "LastOne";

                return Json(new { Folders = folders, Files = files, NavFolders = navFolders }, JsonRequestBehavior.AllowGet);
            }
            else
            {
                var folders = _gtFolderRepository.FindBy(x => x.ParentID == folderID && x.GTID == Id).ToList();
                var files = _gtFileRepository.FindBy(x => x.GTID == Id && x.GTType == GTType && x.FolderID == folderID).ToList();

                var navFolders = new List<GTFolder>();
                for (int i = 0; i < 10; i++)
                {
                    if (folderID == "")
                    {
                        navFolders.Add(new GTFolder { Name = "All Files", Id = "", Discriminator = "" });
                        break;
                    }
                    else
                    {
                        var folder = _gtFolderRepository.GetSingle(folderID);
                        navFolders.Add(folder);

                        folderID = folder.ParentID;
                    }
                }
                navFolders[0].Discriminator = "LastOne";

                return Json(new { Folders = folders, Files = files, NavFolders = navFolders }, JsonRequestBehavior.AllowGet);
            }
        }

        [HttpGet]
        public ActionResult GetGT(string Id, string GTType)
        {
            var files = _gtFileRepository.FindBy(x => x.GTID == Id && x.GTType == GTType).ToList();
            return Json(new { Files = files }, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public JsonResult UploadCameraFile(string base64)
        {
            Random generator = new Random();
            string rendom = generator.Next(0, 1000000).ToString("D6");
            string filename = rendom + ".jpg";
            string finalName = Guid.NewGuid().ToString() + filename;
            string path = HttpContext.Server.MapPath("~/Content/UploatAttachment/");
            Base64ToImage(base64).Save(path + finalName);
            return Json(new { Successful = true, FileName = filename, SaveFileName = finalName }, JsonRequestBehavior.AllowGet);
        }

        public Image Base64ToImage(string cameraImage)
        {
            byte[] imageBytes = Convert.FromBase64String(cameraImage);
            MemoryStream ms = new MemoryStream(imageBytes, 0, imageBytes.Length);
            ms.Write(imageBytes, 0, imageBytes.Length);
            Image image = Image.FromStream(ms, true);
            return image;
        }

        [HttpPost]
        public JsonResult UploadFile()
        {
            HttpPostedFileBase file = Request.Files["file"];
            if (file != null)
            {
                string filename = Guid.NewGuid().ToString() + Path.GetFileName(file.FileName);
                filename = filename.Replace(" ", "");

                string filetype = "Other";
                string lowerFileName = filename.ToLower();
                if (lowerFileName.EndsWith(".jpg") || lowerFileName.EndsWith(".png"))
                    filetype = "Image";
                else if (lowerFileName.EndsWith(".pdf"))
                    filetype = "PDF";

                //Check file size
                if (filetype == "Image" && file.ContentLength >= 250 * 1024)
                {
                    string fp = Path.Combine(HttpContext.Server.MapPath("~/Content/UploatAttachment"), filename);
                    file.SaveAs(fp);
                    string saveFilename = _commonHelper.ResizeImage(fp, HttpContext.Server.MapPath("~/Content/UploatAttachment"), filename, 0);

                    return Json(new { Successful = true, FileName = file.FileName, SaveFileName = saveFilename }, JsonRequestBehavior.AllowGet);
                }
                if (filetype == "PDF" && file.ContentLength >= 4 * 1024 * 1024)
                {
                    return Json(new { Successful = false, Message = "Failed, PDF is big than 4MB." });
                }


                string filepath = Path.Combine(HttpContext.Server.MapPath("~/Content/UploatAttachment"), filename);
                file.SaveAs(filepath);

                return Json(new { Successful = true, FileName = file.FileName, SaveFileName = filename }, JsonRequestBehavior.AllowGet);
            }
            else
            {
                return Json(new { Successful = false, Message = "No Image" });
            }
        }

        [HttpPost]
        public ActionResult SaveUploadFile(string FileName, string SaveFileName, string FolderID, string Id, string GTType)
        {
            string filetype = "Other";
            string lowerFileName = FileName.ToLower();
            if (lowerFileName.EndsWith(".jpg") || lowerFileName.EndsWith(".png"))
                filetype = "Image";
            else if (lowerFileName.EndsWith(".pdf"))
                filetype = "PDF";

            string filepath = Path.Combine(HttpContext.Server.MapPath("~/Content/UploatAttachment"), SaveFileName);
            FileInfo fileInfo = new FileInfo(filepath);
            string fileSize = _commonHelper.FormatBytes(fileInfo.Length);

            int width = 0, height = 0;
            if (filetype == "Image")
            {
                Image img = Image.FromFile(filepath);
                width = img.Width;
                height = img.Height;
            }

            if (GTType == "File")
            {
                var file = new Core.Entities.File
                {
                    UserID = UserId,
                    FileName = FileName,
                    SaveFileName = SaveFileName,
                    FolderID = FolderID,
                    FileType = filetype,
                    FileSize = fileSize,
                    Width = width,
                    Height = height,
                };

                _fileRepository.Save(file);

                return Json(file, JsonRequestBehavior.AllowGet);
            }
            else
            {
                var file = new GTFile
                {
                    UserID = UserId,
                    UserName = UserName,
                    GTID = Id,
                    GTType = GTType,
                    FolderID = FolderID,
                    FileName = FileName,
                    SaveFileName = SaveFileName,
                    FileType = filetype,
                    FileSize = fileSize,
                    Width = width,
                    Height = height,
                };

                _gtFileRepository.Save(file);

                return Json(file, JsonRequestBehavior.AllowGet);
            }
        }

        [HttpPost]
        public ActionResult SaveUploadFileGT(string FileName, string SaveFileName, string Id, string GTType)
        {
            string filetype = "Other";
            string lowerFileName = FileName.ToLower();
            if (lowerFileName.EndsWith(".jpg") || lowerFileName.EndsWith(".png"))
                filetype = "Image";
            else if (lowerFileName.EndsWith(".pdf"))
                filetype = "PDF";

            string filepath = Path.Combine(HttpContext.Server.MapPath("~/Content/UploatAttachment"), SaveFileName);
            FileInfo fileInfo = new FileInfo(filepath);
            string fileSize = _commonHelper.FormatBytes(fileInfo.Length);

            var file = new GTFile
            {
                UserID = UserId,
                UserName = UserName,
                GTID = Id,
                GTType = GTType,
                FileName = FileName,
                SaveFileName = SaveFileName,
                FileType = filetype,
                FileSize = fileSize
            };

            _gtFileRepository.Save(file);

            return Json(file, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public ActionResult Delete(string type, string id)
        {
            if (type == "Folder")
            {
                var folder = _folderRepository.GetSingle(id);
                folder.EntityState = EntityState.Deleted;
                _folderRepository.Save(folder);
            }
            else if (type == "File")
            {
                var file = _fileRepository.GetSingle(id);
                file.EntityState = EntityState.Deleted;
                _fileRepository.Save(file);
            }

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public ActionResult DeleteGT(string id)
        {
            var file = _gtFileRepository.GetSingle(id);
            file.EntityState = EntityState.Deleted;
            _gtFileRepository.Save(file);

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public ActionResult Rename(string oldName, string newName, string type, string fid, string Id, string GTType)
        {
            if (GTType == "File")
            {
                if (type == "Folder")
                {
                    var folder = _folderRepository.GetSingle(fid);
                    folder.Name = newName;
                    folder.EntityState = EntityState.Modified;
                    _folderRepository.Save(folder);
                }
                else if (type == "File")
                {
                    var file = _fileRepository.GetSingle(fid);
                    file.FileName = newName;
                    file.EntityState = EntityState.Modified;
                    _fileRepository.Save(file);
                }
            }
            else
            {
                if (type == "Folder")
                {
                    var folder = _gtFolderRepository.GetSingle(fid);
                    folder.Name = newName;
                    folder.EntityState = EntityState.Modified;
                    _gtFolderRepository.Save(folder);
                }
                else if (type == "File")
                {
                    var file = _gtFileRepository.GetSingle(fid);
                    file.FileName = newName;
                    file.EntityState = EntityState.Modified;
                    _gtFileRepository.Save(file);
                }
            }

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public ActionResult RenameGT(string oldName, string newName, string type, string id)
        {

            var file = _gtFileRepository.GetSingle(id);
            file.FileName = newName;
            file.EntityState = EntityState.Modified;
            _gtFileRepository.Save(file);

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public ActionResult ChooseFileGT(string Id, string GTType, string ids)
        {
            string[] idList = ids.Split(new string[] { "," }, StringSplitOptions.RemoveEmptyEntries);
            var files = _fileRepository.FindBy(x => idList.Contains(x.Id)).ToList();

            int exists = 0;
            int added = 0;

            var gtFiles = new List<GTFile>();
            foreach (var file in files)
            {
                var gt = _gtFileRepository.GetSingle(x => x.SaveFileName == file.SaveFileName && x.GTID == Id);
                if (gt != null)
                { 
                    exists++;
                    continue;
                }

                var gtfile = new GTFile
                {
                    UserID = UserId,
                    UserName = UserName,
                    GTID = Id,
                    GTType = GTType,
                    FileName = file.FileName,
                    SaveFileName = file.SaveFileName,
                    FileType = file.FileType,
                    FileSize = file.FileSize
                };

                gtFiles.Add(gtfile);
                added++;
            }

            _gtFileRepository.AddMany(gtFiles);

            return Json(new { exists = exists, added = added }, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public ActionResult Share(string gids, string tids, string cids, string type, string fid, string GTId, string GTType)
        {
            string[] gidsList = gids.Split(new string[] { "," }, StringSplitOptions.RemoveEmptyEntries);
            string[] tidsList = tids.Split(new string[] { "," }, StringSplitOptions.RemoveEmptyEntries);
            string[] cidsList = cids.Split(new string[] { "," }, StringSplitOptions.RemoveEmptyEntries);

            var file = new FileCommonViewModel();
            if (GTType == "File" && type == "File")
                file = _mapper.Map<Core.Entities.File, FileCommonViewModel>(_fileRepository.GetSingle(fid));
            else if(GTType != "File" &&  type == "File")
                file = _mapper.Map<GTFile, FileCommonViewModel>(_gtFileRepository.GetSingle(fid));

            var gtFiles = new List<GTFile>();
            var files = new List<Core.Entities.File>();
            foreach (string gid in gidsList)
            {
                var item = new GTFile
                {
                    UserID = UserId,
                    UserName = UserName,
                    GTID = gid,
                    GTType = "Group",
                    FileName = file.FileName,
                    SaveFileName = file.SaveFileName,
                    FileType = file.FileType,
                    FileSize = file.FileSize
                };
                gtFiles.Add(item);
            }
            foreach (string tid in tidsList)
            {
                var item = new GTFile
                {
                    UserID = UserId,
                    UserName = UserName,
                    GTID = tid,
                    GTType = "Team",
                    FileName = file.FileName,
                    SaveFileName = file.SaveFileName,
                    FileType = file.FileType,
                    FileSize = file.FileSize
                };
                gtFiles.Add(item);
            }
            foreach (string cid in cidsList)
            {
                var item = new Core.Entities.File
                {
                    UserID = cid,
                    FileName = file.FileName,
                    SaveFileName = file.SaveFileName,
                    FileType = file.FileType,
                    FileSize = file.FileSize
                };
                files.Add(item);
            }

            _fileRepository.AddMany(files);
            _gtFileRepository.AddMany(gtFiles);

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public JsonResult SetImageSize(string fileid)
        {
            var file = _fileRepository.GetSingle(fileid);
            string filepath = Path.Combine(HttpContext.Server.MapPath("~/Content/UploatAttachment"), file.SaveFileName);
            Image img = Image.FromFile(filepath);

            file.Width = img.Width;
            file.Height = img.Height;
            file.EntityState = EntityState.Modified;
            _fileRepository.Save(file);

            return Json(file, JsonRequestBehavior.AllowGet);
        }
    }
}