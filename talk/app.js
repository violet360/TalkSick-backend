const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origins: ["http://localhost:4200"],
  },
});

app.get("/", (req, res) => {
  res.send("<h1>gimme mars........bar!!</h1>");
});

io.on("connection", (socket) => {
  console.log("a user connected");
  let { handle, room } = socket.handshake.auth;
  socket.join(`${room}`);
  socket.emit("networkInfo", `Welcome to ${room}`);
  // socket.broadcast.emit("networkInfo", `${handle} has joined the room`);
  socket.to(`${room}`).emit("networkInfo", `${handle} has joined the room`); //to all clients except the sender
  socket.on("disconnect", () => {
    console.log("user disconnected");
    io.in(`${room}`).emit("networkInfo", `${handle} left :(`);
  });
});

http.listen(3000, () => {
  console.log("listening on *:3000");
});
