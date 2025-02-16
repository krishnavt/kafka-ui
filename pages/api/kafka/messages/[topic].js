import { Kafka } from "kafkajs";
import jwt from "jsonwebtoken";
import { Server } from "ws";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!res.socket.server.ws) {
    res.socket.server.ws = new Server({ server: res.socket.server });
  }

  res.socket.server.ws.on("connection", async (ws, req) => {
    const topic = req.url.split("/").pop();
    const token = req.headers.authorization?.split(" ")[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const kafka = new Kafka({
        clientId: "kafka-ui",
        brokers: decoded.bootstrapServers.split(","),
      });

      const consumer = kafka.consumer({ groupId: `kafka-ui-${Date.now()}` });
      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: false });

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          ws.send(JSON.stringify({
            topic,
            partition,
            offset: message.offset,
            key: message.key?.toString(),
            value: message.value.toString(),
            timestamp: message.timestamp
          }));
        },
      });

      ws.on("close", async () => {
        try {
          await consumer.disconnect();
        } catch (error) {
          console.error("Error disconnecting consumer:", error);
        }
      });
    } catch (error) {
      console.error("Consumer error:", error);
      ws.close();
    }
  });

  res.end();
}