import { Kafka } from "kafkajs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      throw new Error("No token provided");
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const kafka = new Kafka({
      clientId: "kafka-ui",
      brokers: decoded.bootstrapServers.split(","),
      ssl: decoded.ssl,
      sasl: decoded.sasl ? {
        mechanism: decoded.sasl,
        username: decoded.username,
        password: decoded.password
      } : null,
    });

    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();
    await admin.disconnect();

    // Get details for each topic
    const topicDetails = [];
    for (const topic of topics) {
      try {
        const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
        const partitionCount = metadata.topics[0].partitions.length;
        
        // Get consumer groups for this topic
        const groups = await admin.listGroups();
        const consumerGroups = groups.groups.filter(group => 
          group.protocolType === "consumer" && 
          group.members.some(member => 
            member.memberMetadata.toString().includes(topic)
          )
        );

        topicDetails.push({
          name: topic,
          partitions: partitionCount,
          consumerGroups: consumerGroups.length,
          replicationFactor: metadata.topics[0].partitions[0].replicas.length
        });
      } catch (error) {
        console.error(`Error fetching details for topic ${topic}:`, error);
        topicDetails.push({
          name: topic,
          partitions: "N/A",
          consumerGroups: "N/A",
          replicationFactor: "N/A",
          error: "Failed to fetch details"
        });
      }
    }

    res.json({ 
      topics: topicDetails,
      totalTopics: topics.length
    });
  } catch (error) {
    console.error("Failed to list topics:", error);
    res.status(400).json({ error: error.message });
  }
}
