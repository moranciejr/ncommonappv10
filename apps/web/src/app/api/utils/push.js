// Push notification utility stub
export async function sendPushNotification({ userId, title, body, data }) {
  // Wire up Expo push notifications when ready
  console.log('Push notification stub:', { userId, title, body });
}

export async function sendPushToMany({ userIds, title, body, data }) {
  console.log('Push notification stub (many):', { userIds, title, body });
}
