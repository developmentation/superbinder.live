const { transcribeFile } = require("../tools/deepgram.js");
const { upload } = require('../tools/uploadForDeepgram');
const fs = require("fs");
const path = require("path");

const SUPPORTED_EXTENSIONS = [
  '.mp3', '.wav', '.ogg', '.webm', '.m4a', '.aac', 
  '.aiff', '.flac', '.caf', '.mka', '.wma',
  '.mp4', '.ogv', '.mov', '.mkv', '.avi', 
  '.wmv', '.3gp', '.flv'
];

const hasValidExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
};

const SUPPORTED_FORMATS = [
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a',
  'audio/aac', 'audio/x-aiff', 'audio/flac', 'audio/x-caf', 'audio/x-matroska', 'audio/x-ms-wma',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska', 
  'video/x-msvideo', 'video/x-ms-wmv', 'video/3gpp', 'video/x-flv'
];

const fileFilter = (req, file, cb) => {
  const isValidMime = SUPPORTED_FORMATS.includes(file.mimetype);
  const isValidExtension = hasValidExtension(file.originalname);
  
  if (isValidMime || isValidExtension) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format. Please upload a valid audio or video file.'), false);
  }
};

const uploadConfig = upload.single('file');

exports.transcribe = [
  (req, res, next) => {
    uploadConfig(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File size too large. Maximum size is 1GB.' });
        }
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      console.log("Transcribing File:", req.file.filename);
      const { result, error } = await transcribeFile(req.file.filename);
      
      if (error) {
        console.error('Error during transcription:', error);
        return res.status(500).json({ error: 'Transcription failed', details: error });
      }

      const formattedTranscript = formatTranscript(result);
      res.status(200).json({
        message: "Transcription completed successfully",
        transcript: formattedTranscript
      });
    } catch (error) {
      console.error('Error processing transcription:', error);
      res.status(500).json({ error: 'Internal server error while transcribing', details: error.message });
    }
  }
];

function formatTranscript(transcriptionResult) {
  try {
    const paragraphs = transcriptionResult?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs || [];
    
    const segments = paragraphs.map((p, idx) => {
      const paragraphText = p.sentences.map(s => s.text).join(' ');
      const speakerNumber = (typeof p.speaker !== 'undefined') ? p.speaker : 0;
      
      return {
        id: idx,
        start: p.start,
        end: p.end,
        text: paragraphText,
        speaker: speakerNumber,
        words: paragraphText.split(' ').length
      };
    });

    const speakerNumbers = new Set(segments.map(p => p.speaker));
    const speakers = Array.from(speakerNumbers).map(speaker => {
      const speakerSegments = segments.filter(s => s.speaker === speaker);
      const totalWords = speakerSegments.reduce((sum, seg) => sum + seg.words, 0);
      const totalTime = speakerSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);

      return {
        id: speaker,
        label: `Speaker ${speaker}`,
        displayName: `Speaker ${speaker}`,
        segments: speakerSegments.length,
        totalWords,
        totalTime: Math.round(totalTime * 100) / 100,
        percentageOfWords: 0
      };
    });

    const totalWords = speakers.reduce((sum, speaker) => sum + speaker.totalWords, 0);
    speakers.forEach(speaker => {
      speaker.percentageOfWords = Math.round((speaker.totalWords / totalWords) * 100);
    });

    return {
      metadata: {
        totalDuration: segments.length ? segments[segments.length - 1].end : 0,
      totalWords,
      speakerCount: speakers.length,
      dateProcessed: new Date().toISOString(),
    },
    speakers,
    segments,
    raw: transcriptionResult
  };
} catch (error) {
  console.error('Error formatting transcript:', error);
  throw error;
}
}