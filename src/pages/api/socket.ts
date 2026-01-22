import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import type { Socket as NetSocket } from "net";
import type { Server as SocketIOServer } from "socket.io";
import { initSocketServer } from "@/lib/socket-server";
import { registerSocketHandlers } from "@/lib/socket-events";

type SocketServerWithIO = HTTPServer & {
  io?: SocketIOServer;
};

type NextApiResponseWithSocket = NextApiResponse & {
  socket: NetSocket & {
    server: SocketServerWithIO;
  };
};

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  if (!res.socket.server.io) {
    const io = await initSocketServer(res.socket.server);
    res.socket.server.io = io;

    io.on("connection", (socket) => {
      registerSocketHandlers(io, socket);
    });
  }

  res.status(200).end();
}
