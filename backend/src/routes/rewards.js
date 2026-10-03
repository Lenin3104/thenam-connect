const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/rewardController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/me', rewardController.getMyRewards);
router.get('/leaderboard', rewardController.getLeaderboard);

router.route('/')
    .get(rewardController.getRewards)
    .post(rewardController.grantReward);

module.exports = router;
