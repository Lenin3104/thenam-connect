const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/my-tasks', reportController.getMyTaskReport);
router.get('/my-tasks/pdf', reportController.downloadMyTaskReportPDF);
router.get('/my-tasks/excel', reportController.downloadMyTaskReportExcel);

module.exports = router;
