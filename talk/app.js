const express = require("express");
const app = express();
const http = require("http").createServer(app);
const { v1: uuidv1, v4: uuidv4 } = require("uuid");

const io = require("socket.io")(http, {
  cors: {
    origins: ["http://localhost:4200"],
  },
});

var redis = require("redis");
const { group } = require("console");
var redisClient = redis.createClient();

redisClient.on("connect", function () {
  console.log("redis server is up");
});

let sessionStore = {};

io.use((socket, next) => {
  let { ghatna } = socket.handshake.auth;
  if (ghatna === "refreshing") {
    let { sessionId, handleId } = socket.handshake.auth;
    if (sessionId && handleId) {
      redisClient.get(sessionId, (err, object) => {
        if (object) {
          let allPeers = JSON.parse(object);
          let { handle } = allPeers.find((h) => h.handleId === handleId);
          socket.handle = handle;
          socket.handleId = handleId;
          socket.sessionId = sessionId;
          return next();
        }
      });
    }
  } else if (ghatna === "createdRoom") {
    let { handle } = socket.handshake.auth;

    if (handle === undefined) {
      return next(new Error("invalid creds"));
    }
    socket.handle = handle;
    socket.sessionId = uuidv4();
    socket.handleId = uuidv4();
    next();
  } else if (ghatna === "joinedRoom") {
    let { handle, sessionId } = socket.handshake.auth;
    socket.handle = handle;
    socket.handleId = uuidv4();
    socket.sessionId = sessionId;
    next();
  }
});

let groupsChats = [];

io.on("connection", (socket) => {
  console.log("a user connected");
  let { handle, sessionId, handleId } = socket;
  handleInfo = { handle, sessionId, handleId };
  socket.join(`${sessionId}`);

  redisClient.get(`${sessionId} chats`, (err, object) => {
    if (object === null) {
      redisClient.set(`${sessionId} chats`, JSON.stringify([]));
    } else {
      groupsChats = JSON.parse(object);
    }
  });

  socket.emit("selfNetworkInfo", {
    WelcomeMsg: `you have joined the session`,
    handleInfo,
    msg: groupsChats,
  });

  socket
    .to(`${sessionId}`)
    .emit("joineeNetworkInfo", `${handle} has joined the room`); //to all clients except the sender

  socket.on("typing", (data) => {
    let { userTyping, roomId } = data;
    if(userTyping !== "") {
      socket.to(`${roomId}`).emit("typing", `${userTyping} is typing...`); //to all clients except the sender
    } else {
      socket.to(`${roomId}`).emit("typing", `${userTyping}`);
    }
  });

  socket.on("selfMessage", (data) => {
    redisClient.get(`${sessionId} chats`, (err, object) => {
      let chats = JSON.parse(object);
      let chat = data;
      chats.push(chat);
      redisClient.set(`${sessionId} chats`, JSON.stringify(chats));
    });
    socket.to(`${sessionId}`).emit("joineeMessage", data);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    redisClient.get(sessionId, (err, object) => {
      if (object === null) {
        let peer = {};
        peer = { handleId, handle };
        let peers = [peer];
        redisClient.set(sessionId, JSON.stringify(peers));
      } else {
        let peers = JSON.parse(object);
        let peer = {};
        peer = { handleId, handle };
        peers.push(peer);
        redisClient.set(sessionId, JSON.stringify(peers));
      }
    });
    io.in(`${sessionId}`).emit("joineeNetworkInfo", `${handle} left :(`);
  });
});

http.listen(3000, () => {
  console.log("listening on *:3000");
});
