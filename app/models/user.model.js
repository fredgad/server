import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  tarif: { type: Boolean, required: false },
  image: { type: String, required: false },
  keyId: { type: String, required: true, unique: true },

  outgoingReq: { type: [String], required: false, default: [] },
  incomingReq: { type: [String], required: false, default: [] },

  trustedPeople: {
    type: [
      {
        keyId: { type: String, required: true },
        displayed: { type: Boolean, required: true, default: true },
      },
    ],
    required: false,
    default: [],
    // _id: false,
  },

  videos: {
    type: [
      {
        url: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    required: false,
    default: [],
  },
});

const UserModel = mongoose.model('users', userSchema);

export default UserModel;
