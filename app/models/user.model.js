import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  tarif: { type: Boolean, required: false },
  image: { type: String, required: false },
  keyId: { type: String, required: true, unique: true },
  videoDeletionDelayMinutes: { type: Number, default: 0 },
  deletionPasswordRequired: { type: Boolean, default: false },

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
        deletionDelayMinutes: { type: Number, default: 0 },
      },
    ],
    required: false,
    default: [],
  },

  pushSubscriptions: {
    type: [
      {
        endpoint: String,
        expirationTime: mongoose.Schema.Types.Mixed,
        keys: {
          p256dh: String,
          auth: String,
        },
      },
    ],
    default: [],
  },

  // FCM device tokens
  fcmTokens: {
    type: [String],
    default: [],
  },

  liveStreams: {
    type: [
      {
        streamId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: 'LiveStream',
        },
        title: { type: String, default: 'Live Stream' },
        isLive: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  },

  notifications: {
    type: [
      {
        _id: false,
        type: { type: String, required: true },
        text: { type: String, required: true },
        streamId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveStream' },
        fromUser: { type: String },
        createdAt: { type: Date, default: Date.now },
        isRead: { type: Boolean, default: false },
      },
    ],
    default: [],
  },
});

export default mongoose.model('users', userSchema);
