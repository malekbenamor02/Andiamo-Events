// Simple test endpoint to verify serverless functions work
module.exports = (req, res) => {
  console.log('✅ Simple test function called');
  res.json({ 
    success: true, 
    message: 'Serverless function is working',
    timestamp: new Date().toISOString()
  });
};

