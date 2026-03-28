export async function sendPushNotification({ userId, title, body, data }) {
  console.log('Push notification stub:', { userId, title, body });
}

export async function sendPushToMany({ userIds, title, body, data }) {
  console.log('Push notification stub (many):', { userIds, title, body });
}

export async function sendExpoPush({ token, title, body, data }) {
  console.log('Expo push stub:', { token, title, body });
}

export async function sendPushToUser({ userId, title, body, data }) {
  console.log('Push to user stub:', { userId, title, body });
}

export async function registerPushToken({ userId, token, platform }) {
  console.log('Register push token stub:', { userId, token, platform });
}

export async function disablePushToken({ userId, token }) {
  console.log('Disable push token stub:', { userId, token });
}
