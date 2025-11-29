import userModel from '../models/user.model.js';
import { sendFcm, initFirebaseAdmin } from '../services/fcm.js';

// Register device FCM token for current user
export const registerToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const user = await userModel.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const set = new Set(user.fcmTokens || []);
    set.add(token);
    user.fcmTokens = Array.from(set);
    await user.save();

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// Send test push to provided token or first stored for user
export const sendTestPush = async (req, res) => {
  try {
    const { token, title, body, data } = req.body;
    let target = token;

    if (!target) {
      const user = await userModel.findById(req.user.userId);
      target = user?.fcmTokens?.[0];
    }

    if (!target)
      return res.status(400).json({ error: 'FCM token not found for user' });

    const ok = initFirebaseAdmin();
    if (!ok) return res.status(500).json({ error: 'Firebase not configured' });

    await sendFcm({
      token: target,
      title: title || 'Test push',
      body: body || 'It works!',
      data: data || {},
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
