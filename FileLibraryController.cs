using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using System.Web;
using System.Web.Mvc;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.EntityFramework;
using Microsoft.Owin.Security;
using WebRTC.Models;
using WebRTCLib;
using WebRTC.Filters;


namespace WebRTC.Controllers
{
    [LoginRequired]
    public class FileLibraryController : Controller
    {
        Entities entities = null;

        public FileLibraryController()
        {
            this.entities = new Entities();
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
            Groups group = entities.Groups.FirstOrDefault(t => t.Id == id);

            ViewBag.Id = id;
            ViewBag.GTType = "Group";
            ViewBag.GTName = group.Name;

            return View("~/Views/FileLibrary/Index.cshtml");
        }

        public ActionResult Team(string id)
        {
            Teams team = entities.Teams.FirstOrDefault(t => t.Id == id);

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
                WebRTCLib.Folders folder = new Folders()
                {
                    Id = Guid.NewGuid().ToString(),
                    UserID = WebRTCLib.Utils.Helper.CurrentUser.User.Id,
                    Name = Name,
                    ParentID = ParentID,
                    Discriminator = "Folders",
                    CreateOn = DateTime.Now,
                    CreateOnStr = DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
                };
                entities.Folders.Add(folder);
                entities.SaveChanges();
            }
            else
            {
                GTFolders folder = new GTFolders()
                {
                    Id = Guid.NewGuid().ToString(),
                    UserID = WebRTCLib.Utils.Helper.CurrentUser.User.Id,
                    UserName = WebRTCLib.Utils.Helper.CurrentUser.User.UserName,
                    GTID = Id,
                    GTType = GTType,
                    Name = Name,
                    ParentID = ParentID,
                    Discriminator = "Folders",
                    CreateOn = DateTime.Now,
                    CreateOnStr = DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
                };
                entities.GTFolders.Add(folder);
                entities.SaveChanges();
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
                List<Folders> folders = entities.Folders.Where(t => t.UserID == WebRTCLib.Utils.Helper.CurrentUser.User.Id && t.ParentID == folderID).ToList<Folders>();
                List<Files> files = entities.Files.Where(t => t.UserID == WebRTCLib.Utils.Helper.CurrentUser.User.Id && t.FolderID == folderID).ToList<Files>();

                List<Folders> navFolders = new List<Folders>();
                for (int i = 0; i < 10; i++)
                {
                    if (folderID == "")
                    {
                        navFolders.Add(new Folders() { Name = "All Files", Id = "", Discriminator = "" });
                        break;
                    }
                    else
                    {
                        Folders folder = entities.Folders.FirstOrDefault(t => t.Id == folderID);
                        navFolders.Add(folder);

                        folderID = folder.ParentID;
                    }
                }
                navFolders[0].Discriminator = "LastOne";

                return Json(new { Folders = folders, Files = files, NavFolders = navFolders }, JsonRequestBehavior.AllowGet);
            }
            else
            {
                List<GTFolders> folders = entities.GTFolders.Where(t => t.ParentID == folderID && t.GTID == Id).ToList<GTFolders>();
                List<GTFiles> files = entities.GTFiles.Where(t => t.GTID == Id && t.GTType == GTType && t.FolderID == folderID).ToList<GTFiles>();

                List<GTFolders> navFolders = new List<GTFolders>();
                for (int i = 0; i < 10; i++)
                {
                    if (folderID == "")
                    {
                        navFolders.Add(new GTFolders() { Name = "All Files", Id = "", Discriminator = "" });
                        break;
                    }
                    else
                    {
                        GTFolders folder = entities.GTFolders.FirstOrDefault(t => t.Id == folderID);
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
            List<GTFiles> files = entities.GTFiles.Where(t => t.GTID == Id && t.GTType == GTType).ToList<GTFiles>();
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

        public System.Drawing.Image Base64ToImage(string cameraImage)
        {
            byte[] imageBytes = Convert.FromBase64String(cameraImage);
            System.IO.MemoryStream ms = new System.IO.MemoryStream(imageBytes, 0, imageBytes.Length);
            ms.Write(imageBytes, 0, imageBytes.Length);
            System.Drawing.Image image = System.Drawing.Image.FromStream(ms, true);
            return image;
        }


        [HttpPost]
        public JsonResult UploadFile()
        {
            HttpPostedFileBase file = Request.Files["file"];
            if (file != null)
            {
                string filename = Guid.NewGuid().ToString() + System.IO.Path.GetFileName(file.FileName);
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
                    string fp = System.IO.Path.Combine(HttpContext.Server.MapPath("~/Content/UploatAttachment"), filename);
                    file.SaveAs(fp);
                    string saveFilename = WebRTCLib.Utils.Helper.ResizeImage(fp, HttpContext.Server.MapPath("~/Content/UploatAttachment"), filename, 0);

                    return Json(new { Successful = true, FileName = file.FileName, SaveFileName = saveFilename }, JsonRequestBehavior.AllowGet);
                }
                if (filetype == "PDF" && file.ContentLength >= 4 * 1024 * 1024)
                {
                    return Json(new { Successful = false, Message = "Failed, PDF is big than 4MB." });
                }


                string filepath = System.IO.Path.Combine(HttpContext.Server.MapPath("~/Content/UploatAttachment"), filename);
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

            string filepath = System.IO.Path.Combine(HttpContext.Server.MapPath("~/Content/UploatAttachment"), SaveFileName);
            System.IO.FileInfo fileInfo = new System.IO.FileInfo(filepath);
            string fileSize = WebRTCLib.Utils.Helper.FormatBytes(fileInfo.Length);

            int width = 0, height = 0;
            if (filetype == "Image")
            {
                System.Drawing.Image img = System.Drawing.Image.FromFile(filepath);
                width = img.Width;
                height = img.Height;
            }

            if (GTType == "File")
            {
                Files file = new Files()
                {
                    Id = Guid.NewGuid().ToString(),
                    UserID = WebRTCLib.Utils.Helper.CurrentUser.User.Id,
                    FileName = FileName,
                    SaveFileName = SaveFileName,
                    FolderID = FolderID,
                    FileType = filetype,
                    FileSize = fileSize,
                    Discriminator = "Files",
                    CreateOn = DateTime.Now,
                    CreateOnStr = DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
                    Width = width,
                    Height = height,
                };
                entities.Files.Add(file);
                entities.SaveChanges();

                return Json(file, JsonRequestBehavior.AllowGet);
            }
            else
            {
                GTFiles file = new GTFiles()
                {
                    Id = Guid.NewGuid().ToString(),
                    UserID = WebRTCLib.Utils.Helper.CurrentUser.User.Id,
                    UserName = WebRTCLib.Utils.Helper.CurrentUser.User.UserName,
                    GTID = Id,
                    GTType = GTType,
                    FolderID = FolderID,
                    FileName = FileName,
                    SaveFileName = SaveFileName,
                    FileType = filetype,
                    FileSize = fileSize,
                    Discriminator = "GTFiles",
                    CreateOn = DateTime.Now,
                    CreateOnStr = DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
                    Width = width,
                    Height = height,
                };
                entities.GTFiles.Add(file);
                entities.SaveChanges();

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

            string filepath = System.IO.Path.Combine(HttpContext.Server.MapPath("~/Content/UploatAttachment"), SaveFileName);
            System.IO.FileInfo fileInfo = new System.IO.FileInfo(filepath);
            string fileSize = WebRTCLib.Utils.Helper.FormatBytes(fileInfo.Length);

            GTFiles file = new GTFiles()
            {
                Id = Guid.NewGuid().ToString(),
                UserID = WebRTCLib.Utils.Helper.CurrentUser.User.Id,
                UserName = WebRTCLib.Utils.Helper.CurrentUser.User.UserName,
                GTID = Id,
                GTType = GTType,
                FileName = FileName,
                SaveFileName = SaveFileName,
                FileType = filetype,
                FileSize = fileSize,
                Discriminator = "GTFiles",
                CreateOn = DateTime.Now,
                CreateOnStr = DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
            };
            entities.GTFiles.Add(file);
            entities.SaveChanges();

            return Json(file, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public ActionResult Delete(string type, string id)
        {
            if (type == "Folder")
            {
                Folders folder = entities.Folders.FirstOrDefault(t => t.Id == id);
                entities.Folders.Remove(folder);
                entities.SaveChanges();
            }
            else if (type == "File")
            {
                Files file = entities.Files.FirstOrDefault(t => t.Id == id);
                entities.Files.Remove(file);
                entities.SaveChanges();
            }

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public ActionResult DeleteGT(string id)
        {
            GTFiles file = entities.GTFiles.FirstOrDefault(t => t.Id == id);
            entities.GTFiles.Remove(file);
            entities.SaveChanges();

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public ActionResult Rename(string oldName, string newName, string type, string fid, string Id, string GTType)
        {
            if (GTType == "File")
            {
                if (type == "Folder")
                {
                    Folders folder = entities.Folders.FirstOrDefault(t => t.Id == fid);
                    folder.Name = newName;
                    entities.Entry(folder).CurrentValues.SetValues(folder);
                    entities.SaveChanges();
                }
                else if (type == "File")
                {
                    Files file = entities.Files.FirstOrDefault(t => t.Id == fid);
                    file.FileName = newName;
                    entities.Entry(file).CurrentValues.SetValues(file);
                    entities.SaveChanges();
                }
            }
            else
            {
                if (type == "Folder")
                {
                    GTFolders folder = entities.GTFolders.FirstOrDefault(t => t.Id == fid);
                    folder.Name = newName;
                    entities.Entry(folder).CurrentValues.SetValues(folder);
                    entities.SaveChanges();
                }
                else if (type == "File")
                {
                    GTFiles file = entities.GTFiles.FirstOrDefault(t => t.Id == fid);
                    file.FileName = newName;
                    entities.Entry(file).CurrentValues.SetValues(file);
                    entities.SaveChanges();
                }
            }

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public ActionResult RenameGT(string oldName, string newName, string type, string id)
        {

            GTFiles file = entities.GTFiles.FirstOrDefault(t => t.Id == id);
            file.FileName = newName;
            entities.Entry(file).CurrentValues.SetValues(file);
            entities.SaveChanges();

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public ActionResult ChooseFileGT(string Id, string GTType, string ids)
        {
            string[] idList = ids.Split(new string[] { "," }, StringSplitOptions.RemoveEmptyEntries);
            List<Files> files = entities.Files.Where(t => idList.Contains(t.Id)).ToList<Files>();

            int exists = 0;
            int added = 0;

            foreach (var file in files)
            {
                GTFiles gt = entities.GTFiles.FirstOrDefault(t => t.SaveFileName == file.SaveFileName && t.GTID == Id);
                if (gt != null)
                { 
                    exists++;
                    continue;
                }

                GTFiles gtfile = new GTFiles()
                {
                    Id = Guid.NewGuid().ToString(),
                    UserID = WebRTCLib.Utils.Helper.CurrentUser.User.Id,
                    UserName = WebRTCLib.Utils.Helper.CurrentUser.User.UserName,
                    GTID = Id,
                    GTType = GTType,
                    FileName = file.FileName,
                    SaveFileName = file.SaveFileName,
                    FileType = file.FileType,
                    FileSize = file.FileSize,
                    Discriminator = "GTFiles",
                    CreateOn = DateTime.Now,
                    CreateOnStr = DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
                };
                entities.GTFiles.Add(gtfile);
                entities.SaveChanges();

                added++;
            }

            return Json(new { exists = exists, added = added }, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public ActionResult Share(string gids, string tids, string cids, string type, string fid, string GTId, string GTType)
        {
            string[] gidsList = gids.Split(new string[] { "," }, StringSplitOptions.RemoveEmptyEntries);
            string[] tidsList = tids.Split(new string[] { "," }, StringSplitOptions.RemoveEmptyEntries);
            string[] cidsList = cids.Split(new string[] { "," }, StringSplitOptions.RemoveEmptyEntries);

            if (GTType == "File")
            {
                if (type == "File")
                {
                    Files file = entities.Files.FirstOrDefault(t => t.Id == fid);
                    foreach (string gid in gidsList)
                    {
                        GTFiles gfile = new GTFiles(Guid.NewGuid().ToString(), WebRTCLib.Utils.Helper.CurrentUser.User.Id, WebRTCLib.Utils.Helper.CurrentUser.User.UserName, "", gid, "Group", file.FileName, file.SaveFileName, file.FileType, file.FileSize, "GTFiles", DateTime.Now, DateTime.Now.ToString("yyyy-MM-dd HH:mm"));
                        entities.GTFiles.Add(gfile);
                    }
                    foreach (string tid in tidsList)
                    {
                        GTFiles tfile = new GTFiles(Guid.NewGuid().ToString(), WebRTCLib.Utils.Helper.CurrentUser.User.Id, WebRTCLib.Utils.Helper.CurrentUser.User.UserName, "", tid, "Team", file.FileName, file.SaveFileName, file.FileType, file.FileSize, "GTFiles", DateTime.Now, DateTime.Now.ToString("yyyy-MM-dd HH:mm"));
                        entities.GTFiles.Add(tfile);
                    }
                    foreach (string cid in cidsList)
                    {
                        Files cfile = new Files(Guid.NewGuid().ToString(), cid, "", file.FileName, file.SaveFileName, file.FileType, file.FileSize, "Files", DateTime.Now, DateTime.Now.ToString("yyyy-MM-dd HH:mm"));
                        entities.Files.Add(cfile);
                    }
                }
                else if (type == "Folder")
                {

                }
            }
            else
            {
                if (type == "File")
                {
                    GTFiles file = entities.GTFiles.FirstOrDefault(t => t.Id == fid);
                    foreach (string gid in gidsList)
                    {
                        GTFiles gfile = new GTFiles(Guid.NewGuid().ToString(), WebRTCLib.Utils.Helper.CurrentUser.User.Id, WebRTCLib.Utils.Helper.CurrentUser.User.UserName, "", gid, "Group", file.FileName, file.SaveFileName, file.FileType, file.FileSize, "GTFiles", DateTime.Now, DateTime.Now.ToString("yyyy-MM-dd HH:mm"));
                        entities.GTFiles.Add(gfile);
                    }
                    foreach (string tid in tidsList)
                    {
                        GTFiles tfile = new GTFiles(Guid.NewGuid().ToString(), WebRTCLib.Utils.Helper.CurrentUser.User.Id, WebRTCLib.Utils.Helper.CurrentUser.User.UserName, "", tid, "Team", file.FileName, file.SaveFileName, file.FileType, file.FileSize, "GTFiles", DateTime.Now, DateTime.Now.ToString("yyyy-MM-dd HH:mm"));
                        entities.GTFiles.Add(tfile);
                    }
                    foreach (string cid in cidsList)
                    {
                        Files cfile = new Files(Guid.NewGuid().ToString(), cid, "", file.FileName, file.SaveFileName, file.FileType, file.FileSize, "Files", DateTime.Now, DateTime.Now.ToString("yyyy-MM-dd HH:mm"));
                        entities.Files.Add(cfile);
                    }
                }
                else if (type == "Folder")
                {

                }
            }
            entities.SaveChanges();

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public JsonResult SetImageSize(string fileid)
        {
            Files file = entities.Files.FirstOrDefault(t => t.Id == fileid);
            string filepath = System.IO.Path.Combine(HttpContext.Server.MapPath("~/Content/UploatAttachment"), file.SaveFileName);
            System.Drawing.Image img = System.Drawing.Image.FromFile(filepath);

            file.Width = img.Width;
            file.Height = img.Height;

            entities.Entry(file).CurrentValues.SetValues(file);
            entities.SaveChanges();

            return Json(file, JsonRequestBehavior.AllowGet);
        }
    }
}