class AppError extends Error {
  constructor(status, message, errorCode) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
}
module.exports = AppError;
