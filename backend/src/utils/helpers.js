// backend/src/utils/helpers.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

const generateRandomString = (length = 10) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const calculatePagination = (page = 1, limit = 10, total = 0) => {
  const currentPage = parseInt(page);
  const perPage = parseInt(limit);
  const totalPages = Math.ceil(total / perPage);
  const offset = (currentPage - 1) * perPage;

  return {
    currentPage,
    perPage,
    totalPages,
    total,
    offset,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  };
};

const formatLinkedInProfileUrl = (identifier) => {
  if (identifier.startsWith('http')) {
    return identifier;
  }
  return `https://www.linkedin.com/in/${identifier}`;
};

const extractLinkedInUsername = (url) => {
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  return match ? match[1] : null;
};

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const parseTemplate = (template, variables) => {
  let parsed = template;
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{${key}}`, 'g');
    parsed = parsed.replace(regex, variables[key] || `{${key}}`);
  });
  return parsed;
};

// Pipeline status constants
const LEAD_STATUS = {
  LEADS: 'leads',
  INVITE_SENT: 'invite_sent',
  ACCEPTED: 'accepted',
  QUALIFYING: 'qualifying',
  QUALIFIED: 'qualified',
  DISCARDED: 'discarded'
};

const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed'
};

const CONVERSATION_STATUS = {
  HOT: 'hot',
  WARM: 'warm',
  COLD: 'cold'
};

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  generateRandomString,
  calculatePagination,
  formatLinkedInProfileUrl,
  extractLinkedInUsername,
  sleep,
  parseTemplate,
  LEAD_STATUS,
  CAMPAIGN_STATUS,
  CONVERSATION_STATUS
};