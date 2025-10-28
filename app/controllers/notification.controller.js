import userModel from '../models/user.model.js';

export const getNotifications = async (req, res) => {
  try {
    const user = await userModel
      .findById(req.user.userId)
      .select('notifications');
    res.json(user.notifications || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const markRead = async (req, res) => {
  try {
    const { createdAt } = req.body;
    const user = await userModel.findById(req.user.userId);
    const notif = (user.notifications || []).find(
      n => new Date(n.createdAt).getTime() === new Date(createdAt).getTime()
    );
    if (notif) notif.isRead = true;
    await user.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
