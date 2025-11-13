// backend/src/utils/responses.js

const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    data
  };
  
  return res.status(statusCode).json(response);
};

const sendError = (res, error, statusCode = 500) => {
  const response = {
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      originalError: error.originalError
    })
  };
  
  return res.status(error.statusCode || statusCode).json(response);
};

const sendPaginated = (res, data, pagination, message = 'Success') => {
  const response = {
    success: true,
    message,
    data,
    pagination
  };
  
  return res.status(200).json(response);
};

module.exports = {
  sendSuccess,
  sendError,
  sendPaginated
};