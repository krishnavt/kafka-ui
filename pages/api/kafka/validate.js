import { Kafka } from 'kafkajs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { bootstrapServers, username, password, sasl, ssl } = req.body;

    const kafka = new Kafka({
      clientId: 'kafka-ui',
      brokers: bootstrapServers.split(','),
      ssl: ssl,
      sasl: sasl ? {
        mechanism: sasl,
        username: username,
        password: password
      } : null,
    });

    const admin = kafka.admin();
    await admin.connect();
    await admin.listTopics();
    await admin.disconnect();

    const token = jwt.sign({ bootstrapServers, username }, JWT_SECRET);
    
    res.json({ token, success: true });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(400).json({ error: error.message });
  }
}
