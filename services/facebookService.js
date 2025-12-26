const axios = require('axios');
const Comment = require('../models/Comment');
const { analyzeSentiment } = require('./sentimentAnalysis');

class FacebookService {
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
            fields: 'id,message,from,like_count,created_time,comment_count',
          },
        }
      );

      return response.data.data || [];
    } catch (error) {
      console.error('Facebook API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  async replyToComment(commentId, message) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${commentId}/comments`,
        {
          message: message,
          access_token: this.accessToken,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Facebook Reply Error:', error.response?.data || error.message);
      throw error;
    }
  }

  async processNewComments(tenantId, postId) {
    try {
      const comments = await this.fetchRecentComments(postId);
      const processedComments = [];

      for (const comment of comments) {
        const existingComment = await Comment.findOne({
          tenant: tenantId,
          commentId: comment.id,
        });

        if (existingComment) {
          continue;
        }

        const sentimentResult = analyzeSentiment(comment.message || '');

        const newComment = await Comment.create({
          tenant: tenantId,
          platform: 'facebook',
          postId: postId,
          commentId: comment.id,
          commentText: comment.message || '',
          author: {
            id: comment.from?.id,
            name: comment.from?.name,
          },
          sentiment: sentimentResult.sentiment,
          sentimentScore: sentimentResult.score,
          metadata: {
            likes: comment.like_count || 0,
            replies: comment.comment_count || 0,
            timestamp: comment.created_time,
            rawData: comment,
          },
        });

        processedComments.push(newComment);
      }

      return processedComments;
    } catch (error) {
      console.error('Process Comments Error:', error);
      throw error;
    }
  }
}

module.exports = FacebookService;


