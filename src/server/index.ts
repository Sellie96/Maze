require("sucrase/register")
import http from "http";
import * as socket_io from "socket.io";
import { WorldServer } from "./world-server";

function Main() {
  const port = process.env.PORT || 3000;

  const server = http.createServer();
  const io = new socket_io.Server(server, {
    cors: {
      origin: "*",
    },
  });

  server.listen(port, () => {
    console.log("listening on: *", port);
  });

  const WORLD = new WorldServer(io);
  WORLD.Run();
}

Main();
