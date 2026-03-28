export async function sendPushNotification({ userId, title, body, data }) {
  console.log('Push stub:', { userId, title, body });
}
export async function sendPushToMany({ userIds, title, body, data }) {
  console.log('Push many stub:', { userIds, title, body });
}
export async function sendExpoPush({ token, title, body, data }) {
  console.log('Expo push stub:', { token, title, body });
}
export async function sendExpoPushDebug({ token, title, body, data }) {
  console.log('Expo push debug stub:', { token, title, body });
}
export async function sendPushToUser({ userId, title, body, data }) {
  console.log('Push to user stub:', { userId, title, body });
}
export async function registerPushToken({ userId, token, platform }) {
  console.log('Register token stub:', { userId, token, platform });
}
export async function disablePushToken({ userId, token }) {
  console.log('Disable token stub:', { userId, token });
}
export async function sendPushToNearby({ lat, lng, radiusKm, title, body, data }) {
  console.log('Push nearby stub:', { lat, lng, title, body });
}
export async function getPushTokensForUser(sql, userId) {
  return [];
}
