// Simple sentiment analysis (can be enhanced with AI/ML APIs)
const analyzeSentiment = (text) => {
  const lowerText = text.toLowerCase();
  
  // Positive keywords
  const positiveWords = ['love', 'great', 'amazing', 'excellent', 'good', 'awesome', 'best', 'fantastic', 'wonderful', 'perfect', 'beautiful', 'thanks', 'thank you', 'happy', 'excited'];
  
  // Negative keywords
  const negativeWords = ['hate', 'bad', 'worst', 'terrible', 'awful', 'horrible', 'disappointed', 'angry', 'frustrated', 'poor', 'sad', 'upset', 'disgusting'];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  positiveWords.forEach(word => {
    if (lowerText.includes(word)) positiveCount++;
  });
  
  negativeWords.forEach(word => {
    if (lowerText.includes(word)) negativeCount++;
  });
  
  // Calculate sentiment score (-1 to 1)
  const totalWords = positiveCount + negativeCount;
  if (totalWords === 0) {
    return { sentiment: 'neutral', score: 0 };
  }
  
  const score = (positiveCount - negativeCount) / totalWords;
  
  let sentiment = 'neutral';
  if (score > 0.3) {
    sentiment = 'positive';
  } else if (score < -0.3) {
    sentiment = 'negative';
  }
  
  return { sentiment, score };
};

module.exports = {
  analyzeSentiment,
};


