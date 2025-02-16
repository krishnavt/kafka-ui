"import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Search,
  Loader2,
  Settings,
  MessageCircle,
  Database,
  ChevronDown,
  RefreshCcw,
  Download
} from 'lucide-react';

const KafkaUI = () => {
  const [step, setStep] = useState('config');
  const [config, setConfig] = useState({
    bootstrapServers: '',
    username: '',
    password: '',
    sasl: 'PLAIN',
    ssl: true
  });
  const [token, setToken] = useState(null);
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [wsConnection, setWsConnection] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('kafka_token');
    if (savedToken) {
      setToken(savedToken);
      setStep('messages');
      fetchTopics(savedToken);
    }
  }, []);

  const handleValidate = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/kafka/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to connect to Kafka');
      }

      const { token } = await response.json();
      localStorage.setItem('kafka_token', token);
      setToken(token);
      setStep('messages');
      await fetchTopics(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTopics = async (currentToken) => {
    try {
      const response = await fetch('/api/kafka/topics', {
        headers: {
          'Authorization': \`Bearer \${currentToken}\`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch topics');
      }

      const { topics } = await response.json();
      setTopics(topics);
    } catch (err) {
      setError(err.message);
      if (err.message.includes('token')) {
        localStorage.removeItem('kafka_token');
        setStep('config');
      }
    }
  };

  const connectToTopic = (topic) => {
    if (wsConnection) {
      wsConnection.close();
    }

    const ws = new WebSocket(\`ws://\${window.location.host}/api/kafka/messages/\${topic}\`);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [message, ...prev]);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Failed to connect to topic');
    };

    setWsConnection(ws);
    setSelectedTopic(topic);
  };

  const handleLogout = () => {
    localStorage.removeItem('kafka_token');
    if (wsConnection) {
      wsConnection.close();
    }
    setToken(null);
    setStep('config');
    setTopics([]);
    setMessages([]);
    setSelectedTopic(null);
  };

  if (step === 'config') {
    return (
      <div className=\"min-h-screen bg-gray-100 flex items-center justify-center p-4\">
        <Card className=\"w-full max-w-md\">
          <CardHeader>
            <CardTitle>Kafka Connection Configuration</CardTitle>
          </CardHeader>
          <CardContent className=\"space-y-4\">
            <div className=\"space-y-2\">
              <label className=\"text-sm font-medium\">Bootstrap Servers</label>
              <Input
                placeholder=\"localhost:9092,localhost:9093\"
                value={config.bootstrapServers}
                onChange={(e) => setConfig({ ...config, bootstrapServers: e.target.value })}
              />
            </div>

            <div className=\"space-y-2\">
              <label className=\"text-sm font-medium\">Username</label>
              <Input
                type=\"text\"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
              />
            </div>

            <div className=\"space-y-2\">
              <label className=\"text-sm font-medium\">Password</label>
              <Input
                type=\"password\"
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
              />
            </div>

            <div className=\"space-y-2\">
              <label className=\"text-sm font-medium\">SASL Mechanism</label>
              <select
                className=\"w-full p-2 border rounded-md\"
                value={config.sasl}
                onChange={(e) => setConfig({ ...config, sasl: e.target.value })}
              >
                <option value=\"PLAIN\">PLAIN</option>
                <option value=\"SCRAM-SHA-256\">SCRAM-SHA-256</option>
                <option value=\"SCRAM-SHA-512\">SCRAM-SHA-512</option>
              </select>
            </div>

            <div className=\"flex items-center space-x-2\">
              <input
                type=\"checkbox\"
                id=\"ssl\"
                checked={config.ssl}
                onChange={(e) => setConfig({ ...config, ssl: e.target.checked })}
                className=\"rounded\"
              />
              <label htmlFor=\"ssl\" className=\"text-sm font-medium\">Enable SSL</label>
            </div>

            {error && (
              <Alert variant=\"destructive\">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              className=\"w-full\"
              onClick={handleValidate}
              disabled={isLoading || !config.bootstrapServers}
            >
              {isLoading ? (
                <>
                  <Loader2 className=\"mr-2 h-4 w-4 animate-spin\" />
                  Validating Connection
                </>
              ) : (
                'Connect to Kafka'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className=\"min-h-screen bg-gray-100 p-4\">
      <div className=\"max-w-6xl mx-auto\">
        <div className=\"flex justify-between items-center mb-4\">
          <h1 className=\"text-2xl font-bold\">Kafka Topic Explorer</h1>
          <Button onClick={handleLogout} variant=\"outline\">
            Disconnect
          </Button>
        </div>

        <div className=\"grid grid-cols-1 md:grid-cols-4 gap-4\">
          {/* Topics List */}
          <div className=\"bg-white rounded-lg shadow-sm p-4\">
            <h2 className=\"text-lg font-medium mb-4\">Topics</h2>
            <div className=\"space-y-2\">
              {topics.map(topic => (
                <button
                  key={topic}
                  onClick={() => connectToTopic(topic)}
                  className={\`w-full p-2 text-left rounded-md \${
                    selectedTopic === topic ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                  }\`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* Messages View */}
          <div className=\"md:col-span-3 bg-white rounded-lg shadow-sm p-4\">
            <h2 className=\"text-lg font-medium mb-4\">
              {selectedTopic ? \`Messages: \${selectedTopic}\` : 'Select a topic to view messages'}
            </h2>

            <div className=\"space-y-3\">
              {messages.map((message, index) => (
                <div key={index} className=\"border rounded-lg p-3\">
                  <div className=\"text-sm text-gray-500\">
                    Offset: {message.offset} • Partition: {message.partition} •
                    Timestamp: {new Date(message.timestamp).toLocaleString()}
                  </div>
                  <div className=\"mt-2 font-mono text-sm\">
                    {message.key && (
                      <div className=\"text-gray-600\">Key: {message.key}</div>
                    )}
                    <div className=\"mt-1\">
                      <div className=\"text-gray-600\">Value:</div>
                      <pre className=\"bg-gray-50 p-2 rounded mt-1 overflow-x-auto\">
                        {typeof message.value === 'string' && message.value.startsWith('{')
                          ? JSON.stringify(JSON.parse(message.value), null, 2)
                          : message.value}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}

              {messages.length === 0 && selectedTopic && (
                <div className=\"text-center py-8 text-gray-500\">
                  Waiting for messages...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KafkaUI;