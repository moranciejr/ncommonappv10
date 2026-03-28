export async function sendPushNotification({ userId, title, body, data }) {
  console.log('Push notification stub:', { userId, title, body });
}

export async function sendPushToMany({ userIds, title, body, data }) {
  console.log('Push notification stub (many):', { userIds, title, body });
}

export async function sendExpoPush({ token, title, body, data }) {
  console.log('Expo push stub:', { token, title, body });
}
