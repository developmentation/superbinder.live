const { GoogleGenAI } = require("@google/genai");
const sharp = require("sharp"); // Ensure sharp is installed
const { HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const createImageClient = (provider, credentials) => {
  const envKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  const apiKey = credentials?.apiKey || envKey;

  if (!apiKey) {
    throw new Error(`No API key available for ${provider}`);
  }

  switch (provider.toLowerCase()) {
    case 'gemini':
      return new GoogleGenAI({ apiKey });
    default:
      throw new Error(`Unsupported image generation provider: ${provider}`);
  }
};

const handleImageGeneration = async (promptConfig, sendToClient) => {
  const {
    model: modelConfig,
    uuid,
    session,
    userPrompt,
    messageHistory,
  } = promptConfig;


  let fullUserPrompt = 'Generate an image of the following: ' + userPrompt ;

  const systemMessages = messageHistory
  .filter(msg => msg.role === "system")
  .map(msg => msg.content)
  .join(' ');

  const userMessages = messageHistory
  .filter(msg => msg.role === "user")
  .map(msg => msg.content)
  .join(' ');

  fullUserPrompt += "\nIn your image generation, I want you to follow or take inspiration from these instructions:" + systemMessages;
//   fullUserPrompt += "\nTHis image is part of a longer set of conversations from which here are the most recent messages between people:" + userMessages;
  fullUserPrompt = fullUserPrompt.replace(/@\w+/g, '');

  console.log(fullUserPrompt)

 const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ];


  try {
    const provider = modelConfig.provider.toLowerCase();
    const client = createImageClient(provider, {
      apiKey: modelConfig.apiKey,
    });



    const response = await client.models.generateContent({
      model: modelConfig.model || 'gemini-2.0-flash-exp-image-generation',
      contents: fullUserPrompt,
      safety_settings:safetySettings,
      config: {
        responseModalities: ['Text', 'Image'],
      },
    });

    const candidate = response.candidates[0];
    let textContent = '';
    let imageData = null;

    for (const part of candidate.content.parts) {
      if (part.text) {
        textContent += part.text;
      } else if (part.inlineData) {
        imageData = part.inlineData.data; // Base64 encoded image (likely PNG)
      }
    }

    // Send text response if any
    if (textContent) {
        console.log("Image Text Response", textContent)
      sendToClient(uuid, session, "message", textContent);
    }

    // Resize and convert PNG to JPG, then send image data if generated
    if (imageData) {
        console.log("Image Response", imageData.length )
      // Decode Base64 to buffer
      const imageBuffer = Buffer.from(imageData, 'base64');
      
      // Use sharp to resize and convert to JPG
      const jpgBuffer = await sharp(imageBuffer)
        .resize({ 
          width: 640, // Max width of 640px
          withoutEnlargement: true // Prevent upsizing if original is smaller
        })
        .jpeg({ quality: 70 }) // Convert to JPG with quality setting
        .toBuffer();
      
      // Encode back to Base64
      const jpgBase64 = jpgBuffer.toString('base64');
      
      sendToClient(uuid, session, "image", jpgBase64); // Send resized JPG Base64
    }

    sendToClient(uuid, session, "EOM", { end: true });
  } catch (error) {
    console.error("Image generation error:", error);
    sendToClient(uuid, session, "ERROR", JSON.stringify({
      message: error.message || "An error occurred while generating the image",
    }));
  }
};

module.exports = { handleImageGeneration };