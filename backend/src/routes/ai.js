const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/chat', aiController.chat);
router.get('/quick-actions', aiController.getQuickActions);

module.exports = router;
