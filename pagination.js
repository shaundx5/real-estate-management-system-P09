exports.pageOptions = ({ page = 1, limit = 20 }) => ({ page, limit, skip: (page - 1) * limit });
exports.pageData = (items, total, page, limit) => ({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
