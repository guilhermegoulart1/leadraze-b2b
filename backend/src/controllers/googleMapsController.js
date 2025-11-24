// backend/src/controllers/googleMapsController.js
const googleMapsSearchService = require('../services/googleMapsSearchService');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  ValidationError,
  NotFoundError
} = require('../utils/errors');

// ================================
// 1. BUSCAR NO GOOGLE MAPS
// ================================
const searchGoogleMaps = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;

    const {
      country,
      location,
      query,
      radius,
      minRating,
      minReviews,
      requirePhone,
      requireEmail,
      limit,
      language
    } = req.body;

    console.log(`🔍 Google Maps search request from user ${userId} (account ${accountId})`);
    console.log('📍 Filters:', JSON.stringify(req.body, null, 2));

    // Validação
    if (!location || !query) {
      throw new ValidationError('Location and query are required');
    }

    // Executar busca
    const result = await googleMapsSearchService.search({
      country,
      location,
      query,
      radius,
      minRating,
      minReviews,
      requirePhone: requirePhone === true,
      requireEmail: requireEmail === true,
      limit: limit || 100,
      language: language || 'pt'
    });

    console.log(`✅ Found ${result.count} businesses`);

    sendSuccess(res, result);

  } catch (error) {
    console.error('❌ Error in searchGoogleMaps:', error.message);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 2. EXPORTAR PARA CSV
// ================================
const exportToCSV = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { businesses } = req.body;

    console.log(`📥 CSV export request from user ${userId} (account ${accountId})`);
    console.log(`📊 Exporting ${businesses?.length || 0} businesses`);

    // Validação
    if (!businesses || !Array.isArray(businesses) || businesses.length === 0) {
      throw new ValidationError('Businesses array is required and must not be empty');
    }

    // Gerar CSV
    const csv = googleMapsSearchService.exportToCSV(businesses);

    // Definir headers para download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=google-maps-results.csv');

    // Adicionar BOM para Excel reconhecer UTF-8
    const BOM = '\uFEFF';
    res.send(BOM + csv);

    console.log('✅ CSV exported successfully');

  } catch (error) {
    console.error('❌ Error in exportToCSV:', error.message);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. VERIFICAR CRÉDITOS DA CONTA OUTSCRAPER
// ================================
const getAccountInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`💰 Account info request from user ${userId} (account ${accountId})`);

    const accountInfo = await googleMapsSearchService.getAccountInfo();

    console.log(`✅ Account has ${accountInfo.credits} credits`);

    sendSuccess(res, accountInfo);

  } catch (error) {
    console.error('❌ Error in getAccountInfo:', error.message);
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  searchGoogleMaps,
  exportToCSV,
  getAccountInfo
};
