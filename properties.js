const { Joi, pagination } = require('./common');
const types = ['Apartment', 'House', 'Villa', 'Plot', 'Commercial'];
const states = ['Available', 'Under Negotiation', 'Sold', 'Rented'];
const location = Joi.string().trim().min(2).max(100).pattern(/\S/);
const fields = {
  title: Joi.string().trim().min(5).max(150).pattern(/\S/),
  description: Joi.string().max(3000).allow(''),
  type: Joi.string().valid(...types),
  listingFor: Joi.string().valid('Sale', 'Rent'),
  price: Joi.number().positive().min(1).max(1000000000000).precision(2),
  city: location, locality: location,
  bedrooms: Joi.number().integer().min(0).max(30),
  images: Joi.array().items(Joi.string().uri({ scheme: ['http', 'https'] }).max(2048)).max(12).unique()
};
exports.create = Joi.object(fields).fork(['title', 'type', 'listingFor', 'price', 'city', 'locality', 'bedrooms'], s => s.required());
exports.update = Joi.object(fields).min(1);
exports.status = Joi.object({ status: Joi.string().valid(...states).required() });
exports.flag = Joi.object({ reason: Joi.string().trim().min(10).max(1000).pattern(/\S/).required() });
const searchFields = {
  ...pagination, city: location, locality: location,
  minPrice: Joi.number().min(0).max(1000000000000),
  maxPrice: Joi.number().min(0).max(1000000000000).when('minPrice', { is: Joi.exist(), then: Joi.number().min(Joi.ref('minPrice')) }),
  type: Joi.string().valid(...types), bedrooms: Joi.number().integer().min(0).max(30),
  listingFor: Joi.string().valid('Sale', 'Rent'), status: Joi.string().valid(...states),
  sort: Joi.string().valid('newest', 'price_asc', 'price_desc').default('newest')
};
exports.search = Joi.object(searchFields);
exports.citySearch = Joi.object(Object.fromEntries(Object.entries(searchFields).filter(([key]) => key !== 'city')));
exports.cityParams = Joi.object({ city: location.required() });
exports.mine = Joi.object({ ...pagination });
exports.locations = Joi.object({ ...pagination, groupBy: Joi.string().valid('city', 'locality').default('city'), city: location });
