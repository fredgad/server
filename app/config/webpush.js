import webpush from 'web-push';

export const webpushInit = () => {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('⚠️ Missing VAPID keys for WebPush');
    return;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  console.log('✅ WebPush initialized');
};

export default webpush;
