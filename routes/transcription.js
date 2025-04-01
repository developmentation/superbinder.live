var router = require('express').Router();
const transcriptionController = require('../controllers/transcription');

//Sub Routes
router.post('/', transcriptionController.transcribe);


//export the router back to the index.js page
module.exports = router;