using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Mvc;
using Microsoft.AspNet.Identity;
using WebRTC.Data.Abstracts;
using WebRTC.Core.Entities;
using System.Data.Entity;

namespace WebRTC.Controllers
{
    [Authorize]
    public class WebRTCController : BaseController
    {
        private readonly IWebRTCRoomRepository _roomRepository;
        private readonly IUserRepository _userRepository;
        private readonly IWebRTCSDPMessageRepository _sdpMessageRepository;
        private readonly IWebRTCCandidatesTableRepository _candidateRepository;
        private readonly IChatMessageRepository _chatMessageRepsitory;

        public WebRTCController(
            IWebRTCRoomRepository roomRepository,
            IUserRepository userRepository,
            IWebRTCSDPMessageRepository sdpMessageRepository,
            IWebRTCCandidatesTableRepository candidateRepository,
            IChatMessageRepository chatMessageRepsitory)
        {
            _roomRepository = roomRepository;
            _userRepository = userRepository;
            _sdpMessageRepository = sdpMessageRepository;
            _candidateRepository = candidateRepository;
            _chatMessageRepsitory = chatMessageRepsitory;
        }

        [HttpPost]
        public JsonResult MakeACall(string callee_user_id)
        {
            var callee = UserManager.FindById(callee_user_id);
            string[] parts = new string[] { UserName, callee.UserName };

            string token = Guid.NewGuid().ToString();
            var room = new WebRTCRoom
            {
                Id = token,
                Token = token,
                Name = "Single-Call-Room",
                SharedWith = "public",
                Status = "available",
                LastUpdated = DateTime.Now,
                OwnerName = UserName,
                OwnerToken = UserId,
                ParticipantName = callee.UserName,
                ParticipantToken = callee.Id,
                Participants = string.Join(",", parts),
            };

            _roomRepository.Save(room);

            return Json(room, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public JsonResult MakeMMCall(string callee_user_id_list)
        {
            string[] callee_id_list = callee_user_id_list.Split(new string[] { "," }, StringSplitOptions.RemoveEmptyEntries);
            var callee_list = _userRepository.GetAllUsers(callee_id_list).ToList();

            string[] parts = new string[callee_list.Count + 1];
            parts[0] = UserName;
            for (int i = 1; i <= callee_list.Count; i++)
            {
                parts[i] = callee_list[i - 1].UserName;
            }

            string token = Guid.NewGuid().ToString();
            var rooms = new List<WebRTCRoom>();
            foreach (var callee in callee_list) 
            {
                var item = new WebRTCRoom
                {
                    Token = token,
                    Name = "MM-Call-Room",
                    SharedWith = "public",
                    Status = "available",
                    LastUpdated = DateTime.Now,
                    OwnerName = UserName,
                    OwnerToken = UserId,
                    ParticipantName = callee.UserName,
                    ParticipantToken = callee.Id,
                    Participants = string.Join(",", parts),
                };

                rooms.Add(item);
            }

            _roomRepository.AddMany(rooms);

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
            var users = _userRepository.GetAssignUsers(type, id);

            if (users.Any())
            {
                string[] parts = new string[users.Count + 1];
                parts[0] = UserName;
                for (int i = 1; i <= users.Count; i++)
                {
                    parts[i] = users[i - 1].UserName;
                }

                string token = Guid.NewGuid().ToString();
                var rooms = new List<WebRTCRoom>();
                foreach (var callee in users)
                {
                    var item = new WebRTCRoom
                    {
                        Token = token,
                        Name = "Multi-Call-Room",
                        SharedWith = "public",
                        Status = "available",
                        LastUpdated = DateTime.Now,
                        OwnerName = UserName,
                        OwnerToken = UserId,
                        ParticipantName = callee.UserName,
                        ParticipantToken = callee.Id,
                        Participants = string.Join(",", parts),
                    };

                    rooms.Add(item);
                }

                _roomRepository.AddMany(rooms);

                return Json(new { Successful = true, roomtoken = token }, JsonRequestBehavior.AllowGet);
            }
            else
                return Json(new { Successful = false, Message = "Haven't found any user, Please invite user first." });
        }

        /// <summary>
        /// WebRTC/Room
        /// </summary>
        /// <param name="id">Room ID</param>
        /// <returns></returns>
        public ActionResult Room(string id)
        {
            var room = _roomRepository.GetSingle(id);
            var rooms = new List<WebRTCRoom>();
            rooms.Add(room);

            ViewBag.Rooms = rooms;
            ViewBag.RoomToken = id;
            ViewBag.Photo = UserManager.FindById(UserId).Photo;

            if (room.ParticipantToken == UserId)
            {
                room.Status = "active";
                room.EntityState = EntityState.Modified;

                _roomRepository.Save(room);
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
            var room = _roomRepository.GetSingle(t => t.Token == id && t.ParticipantToken == UserId);
            ViewBag.RoomToken = id;
            ViewBag.Photo = UserManager.FindById(UserId).Photo;

            if (room != null)
            {
                var rooms = new List<WebRTCRoom>();
                rooms.Add(room);
                ViewBag.Rooms = rooms;

                room.Status = "active";
                room.EntityState = EntityState.Modified;
                _roomRepository.Save(room);

                return View("~/Views/WebRTC/MultiCallRoom.cshtml");
            }
            else
            {
                var rooms = _roomRepository.GetSingle(x => x.Token == id);
                ViewBag.Rooms = rooms;
                return View();
            }
        }

        public ActionResult MMCallRoom(string id)
        {
            var room = _roomRepository.GetSingle(t => t.Token == id && t.ParticipantToken == UserId);
            ViewBag.RoomToken = id;
            ViewBag.Photo = UserManager.FindById(UserId).Photo;

            if (room != null)
            {
                var rooms = new List<WebRTCRoom>();
                rooms.Add(room);
                ViewBag.Rooms = rooms;

                room.Status = "active";
                room.EntityState = EntityState.Modified;
                _roomRepository.Save(room);

                return View("~/Views/WebRTC/MultiCallRoom.cshtml");
            }
            else
            {
                var rooms = _roomRepository.GetSingle(x => x.Token == id);
                ViewBag.Rooms = rooms;
                return View("~/Views/WebRTC/MultiCallRoom.cshtml");
            }
        }

        [HttpGet]
        public JsonResult GetParticipant()
        {
            string roomname = Request["roomname"];
            var room = _roomRepository.GetSingle(roomname);
            if (room.Status != "active")
                return Json(false, JsonRequestBehavior.AllowGet);
            else
            {
                var userPart = UserManager.FindById(room.ParticipantToken);
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
            var sdpmessage = new WebRTCSDPMessage 
            {
                SDP = sdp,
                IsProcessed = false,
                RoomToken = roomToken,
                Sender = userToken
            };

            _sdpMessageRepository.Save(sdpmessage);

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpGet]
        public JsonResult GetSDP()
        {
            string roomToken = Request["roomToken"];
            string userToken = Request["userToken"];

            var sdpMessage = _sdpMessageRepository.GetSingle(t => t.RoomToken == roomToken && t.Sender != userToken && !t.IsProcessed);

            if (sdpMessage == null)
                return Json(false, JsonRequestBehavior.AllowGet);

            sdpMessage.IsProcessed = true;
            sdpMessage.EntityState = EntityState.Modified;
            _sdpMessageRepository.Save(sdpMessage);

            var user = UserManager.FindById(sdpMessage.Sender);

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
            var cand = new WebRTCCandidatesTable
            {
                Candidate = candidate,
                Label = label,
                RoomToken = roomToken,
                Sender = userToken,
                IsProcessed = false
            };

            _candidateRepository.Save(cand);

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpGet]
        public JsonResult GetICE()
        {
            string roomToken = Request["roomToken"];
            string userToken = Request["userToken"];

            var cand = _candidateRepository.GetSingle(t => t.RoomToken == roomToken && t.Sender != userToken && t.IsProcessed);
            if (cand == null)
                return Json(false, JsonRequestBehavior.AllowGet);

            cand.IsProcessed = true;
            cand.EntityState = EntityState.Modified;

            _candidateRepository.Save(cand);

            return Json(new { candidate = cand.Candidate, label = cand.Label }, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public JsonResult SaveMessage()
        {
            var message = new ChatMessage
            {
                UserID = UserId,
                RoomToken = Request["RoomToken"],
                MessageSender = Request["MessageSender"],
                MessageType = Request["MessageType"],
                MessageContent = Request["MessageContent"],
                Discriminator = "ChatMessage"
            };

            _chatMessageRepsitory.Save(message);

            return Json(true, JsonRequestBehavior.AllowGet);
        }

        [HttpGet]
        public JsonResult Ignore(string id)
        {
            var room = _roomRepository.GetSingle(id);
            room.Status = "Ignore";
            room.EntityState = EntityState.Modified;

            _roomRepository.Save(room);

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