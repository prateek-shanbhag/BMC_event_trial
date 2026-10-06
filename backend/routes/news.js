const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');

// Helper for validation
const validateNews = (title, description, round) => {
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return 'Valid title is required';
  }
  if (!description || typeof description !== 'string' || description.trim() === '') {
    return 'Valid description is required';
  }
  
  if (round === undefined || round === null) {
    return 'Round is required';
  }
  
  const parsedRound = Number(round);
  if (!Number.isInteger(parsedRound) || parsedRound < 1 || parsedRound > 20) {
    return 'Round must be an integer between 1 and 20';
  }
  
  return null; // Valid
};

// GET /api/admin/news
router.get('/', async (req, res) => {
  try {
    const newsSnapshot = await db.collection('news').get();
      
    const newsList = [];
    newsSnapshot.forEach(doc => {
      newsList.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort by round (asc), then by createdAt (desc)
    newsList.sort((a, b) => {
      if (a.round !== b.round) {
        return a.round - b.round;
      }
      const tA = a.createdAt ? a.createdAt.toMillis() : 0;
      const tB = b.createdAt ? b.createdAt.toMillis() : 0;
      return tB - tA;
    });
    
    return res.json({ news: newsList });
  } catch (error) {
    console.error('Error fetching news:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/news/:newsId
router.get('/:newsId', async (req, res) => {
  try {
    const { newsId } = req.params;
    const doc = await db.collection('news').doc(newsId).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'News item not found' });
    }
    
    return res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching news item:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/news
router.post('/', async (req, res) => {
  try {
    const { title, description, round } = req.body;
    
    const validationError = validateNews(title, description, round);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const newsRef = db.collection('news').doc();
    const newNews = {
      id: newsRef.id,
      title: title.trim(),
      description: description.trim(),
      round: Number(round),
      status: 'DRAFT',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await newsRef.set(newNews);
    
    return res.status(201).json(newNews);
  } catch (error) {
    console.error('Error creating news item:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/news/:newsId
router.patch('/:newsId', async (req, res) => {
  try {
    const { newsId } = req.params;
    const { title, description, round } = req.body;
    
    const validationError = validateNews(title, description, round);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const newsRef = db.collection('news').doc(newsId);
    const doc = await newsRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'News item not found' });
    }

    await newsRef.update({
      title: title.trim(),
      description: description.trim(),
      round: Number(round),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    return res.json({ message: 'News updated successfully' });
  } catch (error) {
    console.error('Error updating news item:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/news/:newsId
router.delete('/:newsId', async (req, res) => {
  try {
    const { newsId } = req.params;
    const newsRef = db.collection('news').doc(newsId);
    
    const doc = await newsRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'News item not found' });
    }
    
    await newsRef.delete();
    return res.json({ message: 'News deleted successfully' });
  } catch (error) {
    console.error('Error deleting news item:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/news/:newsId/publish
router.patch('/:newsId/publish', async (req, res) => {
  try {
    const { newsId } = req.params;
    const newsRef = db.collection('news').doc(newsId);
    
    const doc = await newsRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'News item not found' });
    }

    await newsRef.update({
      status: 'PUBLISHED',
      updatedAt: FieldValue.serverTimestamp()
    });
    
    return res.json({ message: 'News published successfully' });
  } catch (error) {
    console.error('Error publishing news item:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/news/:newsId/unpublish
router.patch('/:newsId/unpublish', async (req, res) => {
  try {
    const { newsId } = req.params;
    const newsRef = db.collection('news').doc(newsId);
    
    const doc = await newsRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'News item not found' });
    }

    await newsRef.update({
      status: 'DRAFT',
      updatedAt: FieldValue.serverTimestamp()
    });
    
    return res.json({ message: 'News unpublished successfully' });
  } catch (error) {
    console.error('Error unpublishing news item:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
