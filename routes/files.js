var router = require('express').Router();
const filesController = require('../controllers/files');

//Sub Routes
router.get('/', filesController.retrieveFiles);
router.post('/', filesController.addFiles);

//export the router back to the index.js page
module.exports = router;