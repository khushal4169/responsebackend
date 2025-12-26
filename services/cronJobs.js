const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const InstagramService = require('./instagramService');
const FacebookService = require('./facebookService');
const { analyzeSentiment } = require('./sentimentAnalysis');
const { generateAIReply } = require('./aiReply');
const Comment = require('../models/Comment');
const Lead = require('../models/Lead');

// Sync comments every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running scheduled comment sync...');
  
  try {
    const activeTenants = await Tenant.find({ status: 'active' });

    for (const tenant of activeTenants) {
      try {
        // Sync Instagram comments if enabled
        if (tenant.settings.instagramEnabled && tenant.instagramConfig.accessToken) {
          // This would need post IDs from tenant configuration
          // For now, this is a placeholder structure
          console.log(`Syncing Instagram comments for tenant: ${tenant.name}`);
        }

        // Sync Facebook comments if enabled
        if (tenant.settings.facebookEnabled && tenant.facebookConfig.accessToken) {
          // Similar structure for Facebook
          console.log(`Syncing Facebook comments for tenant: ${tenant.name}`);
        }
      } catch (error) {
        console.error(`Error syncing comments for tenant ${tenant.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in cron job:', error);
  }
});

// Process auto-replies every minute
cron.schedule('* * * * *', async () => {
  try {
    const activeTenants = await Tenant.find({ 
      status: 'active',
      'settings.autoReplyEnabled': true,
    });

    for (const tenant of activeTenants) {
      try {
        // Find new comments that haven't been replied to
        const unrepliedComments = await Comment.find({
          tenant: tenant._id,
          isReplied: false,
          status: 'new',
        }).limit(10); // Process 10 at a time

        for (const comment of unrepliedComments) {
          try {
            // Generate AI reply
            const replyText = await generateAIReply(
              comment.commentText,
              tenant.aiConfig,
              { sentiment: comment.sentiment }
            );

            // Send reply via platform API
            let service;
            if (comment.platform === 'instagram') {
              service = new InstagramService(tenant.instagramConfig);
              await service.replyToComment(comment.commentId, replyText);
            } else if (comment.platform === 'facebook') {
              service = new FacebookService(tenant.facebookConfig);
              await service.replyToComment(comment.commentId, replyText);
            }

            // Update comment
            comment.isReplied = true;
            comment.replyText = replyText;
            comment.replySentAt = Date.now();
            comment.isAutoReply = true;
            comment.status = 'replied';
            await comment.save();

            console.log(`Auto-replied to comment ${comment._id} for tenant ${tenant.name}`);
          } catch (error) {
            console.error(`Error auto-replying to comment ${comment._id}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error processing auto-replies for tenant ${tenant.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in auto-reply cron job:', error);
  }
});

// Generate leads from comments daily
cron.schedule('0 9 * * *', async () => {
  console.log('Running daily lead generation...');
  
  try {
    const activeTenants = await Tenant.find({ 
      status: 'active',
      'settings.leadGenerationEnabled': true,
    });

    for (const tenant of activeTenants) {
      try {
        // Find comments that could be leads (based on sentiment, keywords, etc.)
        const potentialLeads = await Comment.find({
          tenant: tenant._id,
          isLead: false,
          status: { $in: ['new', 'in_progress'] },
          // Add additional criteria for lead detection
          $or: [
            { sentiment: 'positive' },
            { sentimentScore: { $gt: 0.5 } },
          ],
        });

        for (const comment of potentialLeads) {
          // Check if comment indicates interest (simple keyword matching)
          const interestKeywords = ['interested', 'price', 'cost', 'buy', 'purchase', 'more info', 'details'];
          const hasInterest = interestKeywords.some(keyword => 
            comment.commentText.toLowerCase().includes(keyword)
          );

          if (hasInterest) {
            // Create lead
            const lead = await Lead.create({
              tenant: tenant._id,
              source: comment.platform,
              commentId: comment._id,
              name: comment.author?.name || comment.author?.username || 'Unknown',
              username: comment.author?.username,
              platformProfileUrl: comment.author?.id 
                ? `https://${comment.platform}.com/${comment.author.id}`
                : null,
              status: 'new',
              priority: comment.sentimentScore > 0.7 ? 'high' : 'medium',
              score: Math.round((comment.sentimentScore + 1) * 50), // Convert -1 to 1 scale to 0-100
              metadata: {
                originalComment: comment.commentText,
                sentiment: comment.sentiment,
              },
            });

            // Mark comment as lead
            comment.isLead = true;
            comment.leadId = lead._id;
            await comment.save();

            console.log(`Generated lead ${lead._id} from comment ${comment._id}`);
          }
        }
      } catch (error) {
        console.error(`Error generating leads for tenant ${tenant.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in lead generation cron job:', error);
  }
});

console.log('Cron jobs initialized');

module.exports = {}; // Export empty object to run the cron jobs when imported


