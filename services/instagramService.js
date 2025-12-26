const axios = require('axios');
const Comment = require('../models/Comment');
const { analyzeSentiment } = require('./sentimentAnalysis');
const { generateAIReply } = require('./aiReply');

class InstagramService {
  constructor(tenantConfig) {
    this.accessToken = tenantConfig.accessToken;
    this.pageId = tenantConfig.pageId;
    this.baseURL = 'https://graph.facebook.com/v18.0';
  }

  async fetchRecentComments(postId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/${postId}/comments`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'id,text,from,like_count,timestamp',
          },
        }
      );

      return response.data.data || [];
    } catch (error) {
      console.error('Instagram API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  async replyToComment(commentId, message) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${commentId}/replies`,
        {
          message: message,
          access_token: this.accessToken,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Instagram Reply Error:', error.response?.data || error.message);
      throw error;
    }
  }

  async processNewComments(tenantId, postId) {
    try {
      const comments = await this.fetchRecentComments(postId);
      const processedComments = [];

      for (const comment of comments) {
        // Check if comment already exists
        const existingComment = await Comment.findOne({
          tenant: tenantId,
          commentId: comment.id,
        });

        if (existingComment) {
          continue;
        }

        // Analyze sentiment
        const sentimentResult = analyzeSentiment(comment.text);

        // Create comment record
        const newComment = await Comment.create({
          tenant: tenantId,
          platform: 'instagram',
          postId: postId,
          commentId: comment.id,
          commentText: comment.text,
          author: {
            id: comment.from?.id,
            username: comment.from?.username,
            name: comment.from?.name,
          },
          sentiment: sentimentResult.sentiment,
          sentimentScore: sentimentResult.score,
          metadata: {
            likes: comment.like_count || 0,
            timestamp: comment.timestamp,
            rawData: comment,
          },
        });

        processedComments.push(newComment);

        // Auto-reply if enabled (check tenant settings)
        // This should be done with tenant context - placeholder for now
      }

      return processedComments;
    } catch (error) {
      console.error('Process Comments Error:', error);
      throw error;
    }
  }
}

module.exports = InstagramService;


