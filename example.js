const Schema = {
  name: String,
  email: {
    type: String,
    required: true,
  },
  age: {
    type: Number,
    min: 20,
    max: 50,
    required: true,
  },
  gender: {
    type: String,
    enum: ['MALE', 'FEMALE'],
  },
  occupation: {
    type: String,
    default: 'Engineer',
  },
};

const data = {
  name: 'Roshan',
  email: 'rdev.dev06@gmail.com',
  age: 37,
  gender: 'MALE',
  occupation: 'Bussiness',
};

const Nsql = require('.');

const userSchema = new Nsql(Schema, 'User');

try {
  const createdData = userSchema.create(data);
  const getOneData = userSchema
    .findOne({ $and: [{ age: { $lt: 37 } }, { name: 'Roshan' }], occupation:{$lt:'Bussiness'} },['-occupation', '-name'])
    .exec();
  console.log(getOneData);
} catch (error) {
  console.log(error);
}
