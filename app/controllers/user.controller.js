import userModel from '../models/user.model.js';
import jwt from 'jsonwebtoken';

// ======== Получить текущего пользователя ========
export const getUser = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ======== Получить доверенных пользователей по keyIds ========
export const getTrustedUsersByKeyIds = async (req, res) => {
  try {
    const { keyIds } = req.body;
    if (!Array.isArray(keyIds) || keyIds.length === 0)
      return res.status(400).json({ error: 'keyIds array is required' });

    const users = await userModel.find(
      { keyId: { $in: keyIds } },
      { username: 1, email: 1, keyId: 1, image: 1, videos: 1 }
    );

    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ======== Сохранить аватар ========
export const saveImage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image is required' });

    const updated = await userModel.findByIdAndUpdate(
      userId,
      { image },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'Image updated successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ======== Отправить заявку в доверенные ========
export const addUserByKeyId = async (req, res) => {
  try {
    const requesterId = req.user.userId;
    const { keyId } = req.body;
    if (!keyId) return res.status(400).json({ error: 'keyId is required' });

    const requester = await userModel.findById(requesterId);
    const targetUser = await userModel.findOne({ keyId });
    if (!targetUser)
      return res.status(404).json({ error: 'Target user not found' });
    if (requester.keyId === keyId)
      return res.status(400).json({ error: 'Cannot add yourself' });

    if (requester.trustedPeople.some(p => p.keyId === keyId))
      return res.status(400).json({ error: 'Already trusted' });

    requester.outgoingReq.push(keyId);
    targetUser.incomingReq.push(requester.keyId);
    await requester.save();
    await targetUser.save();

    res.json({ message: 'Request sent successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ======== Принять доверенного ========
export const acceptTrustedUser = async (req, res) => {
  try {
    const currentUser = await userModel.findById(req.user.userId);
    const { keyId } = req.body;
    const targetUser = await userModel.findOne({ keyId });
    if (!targetUser) return res.status(404).json({ error: 'Target not found' });

    // очистка заявок
    currentUser.incomingReq = currentUser.incomingReq.filter(k => k !== keyId);
    targetUser.outgoingReq = targetUser.outgoingReq.filter(
      k => k !== currentUser.keyId
    );

    // добавляем в trusted
    if (!currentUser.trustedPeople.some(p => p.keyId === keyId))
      currentUser.trustedPeople.push({ keyId, displayed: true });
    if (!targetUser.trustedPeople.some(p => p.keyId === currentUser.keyId))
      targetUser.trustedPeople.push({
        keyId: currentUser.keyId,
        displayed: true,
      });

    await currentUser.save();
    await targetUser.save();

    res.json({ message: 'Trusted user added successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ======== Удалить доверенного ========
export const removeTrustedUser = async (req, res) => {
  try {
    const requester = await userModel.findById(req.user.userId);
    const { keyId } = req.body;
    const target = await userModel.findOne({ keyId });
    if (!target) return res.status(404).json({ error: 'Target not found' });

    requester.trustedPeople = requester.trustedPeople.filter(
      p => p.keyId !== keyId
    );
    target.trustedPeople = target.trustedPeople.filter(
      p => p.keyId !== requester.keyId
    );

    await requester.save();
    await target.save();
    res.json({ message: 'Trusted user removed successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
