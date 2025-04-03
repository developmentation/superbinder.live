const { ElevenLabsClient } = require("elevenlabs");

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

const generateAudio = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { text, path: voiceId } = req.body;
    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(401).json({ message: "API key not configured" });
    }

    const stream = await client.textToSpeech.convertAsStream(
      voiceId || "JBFqnCBsd6RMkjVDRZzb",
      {
        output_format: "mp3_44100_128",
        text,
        model_id: "eleven_multilingual_v2"
      }
    );

    res.set({
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    });

    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('Stream Error:', err);
      res.status(500).end();
    });

    stream.on('end', () => {
      res.end();
    });

  } catch (error) {
    console.error('Text-to-Speech Error:', error);
    return res.status(500).json({ 
      message: "Error generating audio", 
      error: error.message 
    });
  }
};

module.exports = { generateAudio };