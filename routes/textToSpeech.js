var router = require('express').Router();
const textToSpeechController = require('../controllers/textToSpeech');

//Sub Routes
router.post('/', textToSpeechController.generateAudio);
router.get('/voices', textToSpeechController.voices);

//export the router back to the index.js page
module.exports = router;