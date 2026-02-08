import { Server } from "socket.io"; //named export - name exact as returned by the package

let connections = {}; //server will store all rooms and all sockets in each room here
let messages = {}; //server will send msg data , sender , socket id os sender here
let timeOnline = {}; //server will send the connecrion time of socjet id
//other function of server will be  - signalling via web rtc , sync msg for new clinet , connect amd disconnect sockets , msg broadcast-chat-meesage

export const connectToSocket = (server) => {
  console.log("connected to socket");
  //param server is http-server
  const io = new Server(server,{
    cors:{
      origin:"*",
      methods:["GET","POST"],
      allowedHeaders:["*"],
      credentials:true
    }
  });
   //io is server and socket is a particualr client

  io.on("connection", (socket) => {
    //f1-new connection joined
    socket.on("join-call", (path) => {
      if (connections[path] === undefined) {
        //if the path exist then dont create new connections list if it does not exost then create a one
        connections[path] = [];
      }
      connections[path].push(socket.id); //connections is an obj of arrys  store socket ids of clients as arr vlaue and room as key

      timeOnline[socket.id] = new Date();

      for (let i = 0; i < connections[path].length; i++) {
        //loop thorugh all participant in room
        io.to(connections[path][i]).emit(
          "user-joined",
          socket.id,//new joined user
          connections[path]//all socket clients 
        ); // to notify all existing participants in a room that a new user has joined.
      }

      //f2-relay
      //Sends each stored message to only the newly connected socket (the user who just joined).

      if (messages[path] !== undefined) {
        for (let i = 0; i < messages[path].length; i++) {
          io.to(socket.id).emit(
            "chat-message",
            messages[path][i]["data"],
            messages[path][i]["sender"],
            messages[path][i]["socket-id-sender"]
          );
        }
      }
    });

    //f3-signalling
    socket.on("signal", (toId, message) => {
      //relay mechanism for WebRTC peer‑to‑peer connections -sdp relay 
      io.to(toId).emit("signal", socket.id, message);
    });
    //Once signaling is exchanged, the peers can establish a direct media/data connection.

    //f4-broadcasting msgs
    socket.on("chat-message", (data, sender) => {
      const [matchingRoom, found] = Object.entries(connections).reduce(
        ([room, isFound], [roomKey, roomValue]) => {
          if (!isFound && roomValue.includes(socket.id)) {
            return [roomKey, true];//when found
          }
          return [room, isFound];//as it is 
        },
        ["", false] //initalize acc room , isfound with 
      );

      if (found) {
        if (messages[matchingRoom] === undefined) {
          messages[matchingRoom] = []; //new arr is created for the room if previously it doesnt contain any meesage
        }
        messages[matchingRoom].push({
          sender: sender,
          data: data,
          "socket-id-sender": socket.id,
        });

        console.log(matchingRoom,"message", ":",data,"by" ,sender, socket.id);
        connections[matchingRoom].forEach((id) => {
          io.to(id).emit("chat-message", data, sender, socket.id);
        });
      }
    });

    //f5-disconnection
    socket.on("disconnect", () => {
      const diffTime = Math.abs(new Date() - timeOnline[socket.id]);
      let room;
    
      for (const [roomKey, socketIds] of Object.entries(connections)) {
        const index = socketIds.indexOf(socket.id);
        if (index !== -1) {
          room = roomKey;
    
          // Notify others in the room
          socketIds.forEach((id) => {
            io.to(id).emit("user-left", socket.id, diffTime);
          });
    
          // Remove socket from the room
          socketIds.splice(index, 1);
    
          // If room is empty, delete it
          if (socketIds.length === 0) {
            delete connections[room];
          }
    
          break; // stop after finding the room
        }
      }
    
      delete timeOnline[socket.id];
    });
  });
  return io;
};

// connections = {
//     "room123": ["socketA", "socketB"],
//     "room456": ["socketC", "socketD", "socketE"]
//   };

// messages = {
//     "room123": [
//       { data: "Hello!", sender: "Alice", "socket-id-sender": "socketA" },
//       { data: "Hi Alice!", sender: "Bob", "socket-id-sender": "socketB" }
//     ],
//     "room456": [
//       { data: "Welcome!", sender: "Charlie", "socket-id-sender": "socketC" }
//     ]
//   };

// timeOnline = {
//     "socketA": "2026-01-18T07:15:00.000Z",
//     "socketB": "2026-01-18T07:16:30.000Z",
//     "socketC": "2026-01-18T07:18:10.000Z"
//   };

/*
erver is not streaming video/audio — it’s only relaying signaling and chat.
That’s why you see io.to(socket).emit("chat-message", ...).
If you want chat to also be peer‑to‑peer, you’d need to use WebRTC data channels instead of Socket.IO.
*/