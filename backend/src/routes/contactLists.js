// backend/src/routes/contactLists.js
const express = require('express');
const router = express.Router();
const contactListController = require('../controllers/contactListController');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// ================================
// TODAS AS ROTAS REQUEREM AUTH
// ================================
router.use(authenticateToken);
router.use(apiLimiter);

// ================================
// CRUD DE LISTAS DE CONTATOS
// ================================

// Listar listas de contatos
router.get('/', contactListController.getContactLists);

// Obter lista específica
router.get('/:id', contactListController.getContactList);

// Criar lista de contatos
router.post('/', contactListController.createContactList);

// Atualizar lista de contatos
router.put('/:id', contactListController.updateContactList);

// Deletar lista de contatos
router.delete('/:id', contactListController.deleteContactList);

// ================================
// GERENCIAMENTO DE ITENS
// ================================

// Obter itens da lista
router.get('/:id/items', contactListController.getContactListItems);

// Adicionar contato à lista
router.post('/:id/items', contactListController.addContactToList);

// Remover contato da lista
router.delete('/:id/items/:itemId', contactListController.removeContactFromList);

// ================================
// IMPORTAÇÃO
// ================================

// Importar contatos de CSV
router.post('/:id/import', contactListController.importContactsFromCSV);

module.exports = router;
