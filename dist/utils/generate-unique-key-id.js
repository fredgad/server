import UserModel from '../models/user.model';
export const generateUniqueKeyId = async (length = 9, maxRetries = 1000) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let keyId = '';
    let isUnique = false;
    let retries = 0;
    while (!isUnique && retries < maxRetries) {
        keyId = Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        const existingUser = await UserModel.findOne({ keyId });
        if (!existingUser) {
            isUnique = true;
        }
        retries++;
    }
    if (!isUnique) {
        throw new Error('Failed to generate a unique keyId');
    }
    return keyId;
};
