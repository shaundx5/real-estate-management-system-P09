const router = require('express').Router();
const c = require('../controllers/authController');
const v = require('../validators/auth');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
router.post('/register', validate({ body: v.register }), c.register);
router.post('/login', validate({ body: v.login }), c.login);
router.get('/me', authenticate, authorize('buyer', 'tenant', 'agent', 'admin'), validate(), c.me);
module.exports = router;
