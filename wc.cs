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
    public class WebRTCController : Controller
    {
        Entities entities = null;

        public WebRTCController()
        {
            this.entities = new Entities();
        }

        [HttpPost]
        public JsonResult MakeACall(string callee_user_id)
        {
            Users callee = entities.Users.FirstOrDefault(t => t.Id == callee_user_id);
            string[] parts = new string[] { WebRTCLib.Utils.Helper.CurrentUser.User.UserName, callee.UserName };

            string token = Guid.NewGuid().ToString();
            WebRTCRoom room = new WebRTCRoom()
            {
                ID = token,
                Token = token,
                Name = "Single-Call-Room",
                SharedWith = "public",
                Status = "available",
                LastUpdated = DateTime.Now,
                OwnerName = WebRTCLib.Utils.Helper.CurrentUser.User.UserName,
                OwnerToken = WebRTCLib.Utils.Helper.CurrentUser.User.Id,
                ParticipantName = callee.UserName,
                ParticipantToken = callee.Id,
                CreateOn = DateTime.Now,
                CreateOnStr = DateTime.Now.ToString("yyyy-MM-dd"),
                Participants = String.Join(",", parts),
            };
            entities.WebRTCRoom.Add(room);
            entities.SaveChanges();

            return Json(room, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public JsonResult MakeMMCall(string callee_user_id_list)
        {
            string[] callee_id_list = callee_user_id_list.Split(new string[] { "," }, StringSplitOptions.RemoveEmptyEntries);
            List<Users> callee_list = entities.Users.Where(t => callee_id_list.Contains(t.Id)).ToList<Users>();

            string[] parts = new string[callee_list.Count + 1];
            parts[0] = WebRTCLib.Utils.Helper.CurrentUser.User.UserName;
            for (int i = 1; i <= callee_list.Count; i++)
            {
                parts[i] = callee_list[i - 1].UserName;
            }

            string token = Guid.NewGuid().ToString();
            foreach (Users callee in callee_list) 
            {
                WebRTCRoom room = new WebRTCRoom()
                {
                    ID = Guid.NewGuid().ToString(),
                    Token = token,
                    Name = "MM-Call-Room",
                    SharedWith = "public",
                    Status = "available",
                    LastUpdated = DateTime.Now,
                    OwnerName = WebRTCLib.Utils.Helper.CurrentUser.User.UserName,
                    OwnerToken = WebRTCLib.Utils.Helper.CurrentUser.User.Id,
                    ParticipantName = callee.UserName,
                    ParticipantToken = callee.Id,
                    CreateOn = DateTime.Now,
                    CreateOnStr = DateTime.Now.ToString("yyyy-MM-dd"),
                    Participants = String.Join(",", parts),
                };
                entities.WebRTCRoom.Add(room);
            }
            entities.SaveChanges();
            return Json(new { roomtoken = token }, JsonRequestBehavior.AllowGet);
        }

        /// <summary>
        /// Call Group or Team
        /// </summary>
        /// <param name="id">Group's Id or Team's Id</param>
        /// <param name="type"></param>
        /// <returns></returns>
        [HttpPost]
        public JsonResult CallGroupOrTeam(string id, string type)
        {
            List<Users> users = new List<Users>();
            if (type == "group")
            {
                var entrys = from assignGroup in entities.UserAssignGroup
                             join user in entities.Users on assignGroup.UserID equals user.Id
                             where assignGroup.GroupID == id
                             select new { UserName = user.UserName, Id = user.Id };
                foreach (var entry in entrys)
                    users.Add(new Users() { UserName = entry.UserName, Id = entry.Id });
            }
            else if (type == "team")
            {
                var entrys = from assignTeam in entities.UserAssignTeam
                             join user in entities.Users on assignTeam.UserID equals user.Id
                             where assignTeam.TeamID == id
                             select new { UserName = user.UserName, Id = user.Id };
                foreach (var entry in entrys)
                    users.Add(new Users() { UserName = entry.UserName, Id = entry.Id });
            }

            if (users.Count > 0)
            {
                string[] parts = new string[users.Count + 1];
                parts[0] = WebRTCLib.Utils.Helper.CurrentUser.User.UserName;
                for (int i = 1; i <= users.Count; i++)
                {
                    parts[i] = users[i - 1].UserName;
                }

                string token = Guid.NewGuid().ToString();
                foreach (Users callee in users)
                {
                    WebRTCRoom room = new WebRTCRoom()
                    {
                        ID = Guid.NewGuid().ToString(),
                        Token = token,
                        Name = "Multi-Call-Room",
                        SharedWith = "public",
                        Status = "available",
                        LastUpdated = DateTime.Now,
                        OwnerName = WebRTCLib.Utils.Helper.CurrentUser.User.UserName,
                        OwnerToken = WebRTCLib.Utils.Helper.CurrentUser.User.Id,
                        ParticipantName = callee.UserName,
                        ParticipantToken = callee.Id,
                        CreateOn = DateTime.Now,
                        CreateOnStr = DateTime.Now.ToString("yyyy-MM-dd"),
                        Participants = String.Join(",", parts),
                    };
                    entities.WebRTCRoom.Add(room);
                }
                entities.SaveChanges();
                return Json(new { Successful = true, roomtoken = token }, JsonRequestBehavior.AllowGet);
            }
            else
            {
                return Json(new { Successful = false, Message = "Haven't found any user, Please invite user first." });
            }
        }

        /// <summary>
        /// WebRTC/Room
        /// </summary>
        /// <param name="id">Room ID</param>
        /// <returns></returns>
        public ActionResult Room(string id)
        {
            WebRTCRoom room = entities.WebRTCRoom.FirstOrDefault(t => t.ID == id);
            List<WebRTCRoom> rooms = new List<WebRTCRoom>();
            rooms.Add(room);
            ViewBag.Rooms = rooms;

            ViewBag.RoomToken = id;

            if (room.ParticipantToken == WebRTCLib.Utils.Helper.CurrentUser.User.Id)
            {
                room.Status = "active";
                entities.Entry(room).CurrentValues.SetValues(room);
                entities.SaveChanges();
            }

            return View("~/Views/WebRTC/MultiCallRoom.cshtml");
        }

        /// <summary>
        /// WebRTC/MultiCallRoom
        /// </summary>
        /// <param name="id"></param>
        /// <returns></returns>
        public ActionResult MultiCallRoom(string id)
        {
            WebRTCRoom room = entities.WebRTCRoom.FirstOrDefault(t => t.Token == id && t.ParticipantToken == WebRTCLib.Utils.Helper.CurrentUser.User.Id);
            ViewBag.RoomToken = id;

            if (room != null)
            {
                List<WebRTCRoom> rooms = new List<WebRTCRoom>();
                rooms.Add(room);
                ViewBag.Rooms = rooms;

                room.Status = "active";
                entities.Entry(room).CurrentValues.SetValues(room);
                entities.SaveChanges();
                return View("~/Views/WebRTC/MultiCallRoom.cshtml");
            }
            else
            {
                List<WebRTCRoom> rooms = entities.WebRTCRoom.Where(t => t.Token == id).ToList<WebRTCRoom>();
                ViewBag.Rooms = rooms;
                return View();
            }
        }

        public ActionResult MMCallRoom(string id)
        {
            WebRTCRoom room = entities.WebRTCRoom.FirstOrDefault(t => t.Token == id && t.ParticipantToken == WebRTCLib.Utils.Helper.CurrentUser.User.Id);
            ViewBag.RoomToken = id;

            if (room != null)
            {
                List<WebRTCRoom> rooms = new List<WebRTCRoom>();
                rooms.Add(room);
                ViewBag.Rooms = rooms;

                room.Status = "active";
                entities.Entry(room).CurrentValues.SetValues(room);
                entities.SaveChanges();
                return View("~/Views/WebRTC/MultiCallRoom.cshtml");
            }
            else
            {
                List<WebRTCRoom> rooms = entities.WebRTCRoom.Where(t => t.Token == id).ToList<WebRTCRoom>();
                ViewBag.Rooms = rooms;
                return View("~/Views/WebRTC/MultiCallRoom.cshtml");
            }
        }

        [HttpGet]
        public JsonResult GetParticipant()
        {
            string roomname = Request["roomname"];
            WebRTCRoom room = entities.WebRTCRoom.FirstOrDefault(t => t.ID == roomname);
            if (room.Status != "active")
                return Json(false, JsonRequestBehavior.AllowGet);
            else
            {
                Users userPart = entities.Users.FirstOrDefault(t => t.Id == room.ParticipantToken);
                return Json(new { participant = userPart.UserName, partPhoto = userPart.Photo }, JsonRequestBehavior.AllowGet);
            }
        }

        /// <summary>
        /// Post SDP
        /// </summary>
        /// <param name="sdp"></param>
        /// <param name="roomToken">room id</param>
        /// <param name="userToken">user id</param>
        /// <returns></returns>
        [HttpPost]
        public JsonResult PostSDP(string sdp, string roomToken, string userToken)
        {
            WebRTCSDPMessage sdpmessage = new WebRTCSDPMessage() 
            {
                ID = Guid.NewGuid().ToString(),
                SDP = sdp,
                IsProcessed = false,
                RoomToken = roomToken,
                Sender = userToken,
                CreateOn = DateTime.Now,
            };
            entities.WebRTCSDPMessage.Add(sdpmessage);
            entities.SaveChanges();

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpGet]
        public JsonResult GetSDP()
        {
            string roomToken = Request["roomToken"];
            string userToken = Request["userToken"];

            WebRTCSDPMessage sdpMessage = entities.WebRTCSDPMessage.FirstOrDefault(t => t.RoomToken == roomToken && t.Sender != userToken && t.IsProcessed == false);
            if (sdpMessage == null)
                return Json(false, JsonRequestBehavior.AllowGet);

            sdpMessage.IsProcessed = true;
            entities.Entry(sdpMessage).CurrentValues.SetValues(sdpMessage);
            entities.SaveChanges();

            Users user = entities.Users.FirstOrDefault(t => t.Id == sdpMessage.Sender);

            return Json(new { sdp = sdpMessage.SDP, partUserName = user.UserName, partPhoto = user.Photo }, JsonRequestBehavior.AllowGet);
        }

        /// <summary>
        /// Post ICE
        /// </summary>
        /// <param name="candidate"></param>
        /// <param name="label"></param>
        /// <param name="roomToken">room id</param>
        /// <param name="userToken">user id</param>
        /// <returns></returns>
        [HttpPost]        
        public JsonResult PostICE(string candidate, string label, string roomToken, string userToken)
        {
            WebRTCCandidatesTable cand = new WebRTCCandidatesTable()
            {
                ID = Guid.NewGuid().ToString(),
                Candidate = candidate,
                Label = label,
                RoomToken = roomToken,
                Sender = userToken,
                IsProcessed = false,
                CreateOn = DateTime.Now,
            };
            entities.WebRTCCandidatesTable.Add(cand);
            entities.SaveChanges();

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpGet]
        public JsonResult GetICE()
        {
            string roomToken = Request["roomToken"];
            string userToken = Request["userToken"];

            WebRTCCandidatesTable cand = entities.WebRTCCandidatesTable.FirstOrDefault(t => t.RoomToken == roomToken && t.Sender != userToken && t.IsProcessed == false);
            if (cand == null)
                return Json(false, JsonRequestBehavior.AllowGet);

            cand.IsProcessed = true;
            entities.Entry(cand).CurrentValues.SetValues(cand);
            entities.SaveChanges();

            return Json(new { candidate = cand.Candidate, label = cand.Label }, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public JsonResult SaveMessage()
        {
            ChatMessage chatMessage = new ChatMessage()
            {
                Id = Guid.NewGuid().ToString(),
                UserID = WebRTCLib.Utils.Helper.CurrentUser.User.Id,
                RoomToken = Request["RoomToken"],
                MessageSender = Request["MessageSender"],
                MessageType = Request["MessageType"],
                MessageContent = Request["MessageContent"],
                Discriminator = "ChatMessage",
                CreateOn = DateTime.Now,
                CreateOnStr = DateTime.Now.ToString("yyyy-MM-dd"),
            };
            entities.ChatMessage.Add(chatMessage);
            entities.SaveChanges();

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpGet]
        public JsonResult Ignore(string id)
        {
            WebRTCRoom room = entities.WebRTCRoom.FirstOrDefault(t => t.ID == id);
            room.Status = "Ignore";
            entities.Entry(room).CurrentValues.SetValues(room);
            entities.SaveChanges();

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public JsonResult PostCanvasData(string data)
        {
            string filename = Guid.NewGuid().ToString() + ".txt";
            string filePath = System.IO.Path.Combine(HttpContext.Server.MapPath("~/Content/UploatAttachment"), filename);
            System.IO.FileStream fs = System.IO.File.Create(filePath);
            System.IO.StreamWriter sw = new System.IO.StreamWriter(fs);
            sw.Write(data);
            sw.Close();
            fs.Close();

            return Json(new { FileName = filename }, JsonRequestBehavior.AllowGet);            
        }

        [HttpGet]
        public JsonResult GetCanvasData(string filename)
        {
            string filePath = System.IO.Path.Combine(HttpContext.Server.MapPath("~/Content/UploatAttachment"), filename);
            string data = System.IO.File.ReadAllText(filePath);

            System.IO.File.Delete(filePath);

            return Json(new { Data = data }, JsonRequestBehavior.AllowGet);
        }

    }
}