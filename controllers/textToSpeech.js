const { ElevenLabsClient } = require("elevenlabs");

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });


const voices = async (req, res) =>{


const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
let voiceSearch = await client.voices.search({
    include_total_count: true
});


res.status(200).json({
  message: 'Voices Loaded Successfully',
  voices:voiceSearch.voices.map((voice)=>{return {voice_id:voice.voice_id, name:voice.name, labels: voice.labels}}),
});


}

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
        model_id: "eleven_flash_v2_5" //eleven_multilingual_v2
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

module.exports = { voices, generateAudio };