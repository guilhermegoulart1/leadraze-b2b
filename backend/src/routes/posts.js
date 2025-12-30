// backend/src/routes/posts.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const postController = require('../controllers/postController');

// All routes require authentication
router.use(authenticate);

// Search posts
router.post('/search', postController.searchPosts);

// Add authors to campaign
router.post('/add-to-campaign', postController.addAuthorsToCampaign);

// Add engaged profiles to campaign (from comments + reactions)
router.post('/add-engaged-to-campaign', postController.addAuthorsToCampaign);

// Get posts from a specific user
router.get('/user/:userId', postController.getUserPosts);

// Get post by ID
router.get('/:postId', postController.getPost);

// Get comments of a post
router.get('/:postId/comments', postController.getPostComments);

// Get reactions of a post
router.get('/:postId/reactions', postController.getPostReactions);

// Get all engaged profiles (comments + reactions combined)
router.get('/:postId/engaged', postController.getPostEngagedProfiles);

module.exports = router;
