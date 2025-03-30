var router = require('express').Router();
const libraryController = require('../controllers/library');

//Sub Routes
router.get('/', libraryController.getLibrary); //Retrieve the whole library with more than 5 votes
router.post('/', libraryController.publishBinder); // publish a new binder to the library
router.post('/deploy', libraryController.deployArtifact); // publish a new binder to the library
router.post('/vote', libraryController.voteArtifact); // publish a new binder to the library


//export the router back to the index.js page
module.exports = router;