const scheduledNotifications = [];
const notificationListeners = [];
const responseListeners = [];

const SchedulableTriggerInputTypes = {
  TIME_INTERVAL: 'timeInterval',
  CALENDAR: 'calendar',
  DAILY: 'daily',
  WEEKLY: 'weekly',
};

const AndroidImportance = {
  DEFAULT: 3,
  HIGH: 4,
  MAX: 5,
};

module.exports = {
  SchedulableTriggerInputTypes,
  AndroidImportance,
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  setNotificationCategoryAsync: jest.fn(async (id, actions) => ({ identifier: id, actions })),
  setNotificationChannelAsync: jest.fn(async (id, config) => ({ id, ...config })),
  scheduleNotificationAsync: jest.fn(async (request) => {
    const id = `mock-notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    scheduledNotifications.push({ id, ...request });
    return id;
  }),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {
    scheduledNotifications.length = 0;
  }),
  getAllScheduledNotificationsAsync: jest.fn(async () => scheduledNotifications),
  addNotificationReceivedListener: jest.fn((listener) => {
    notificationListeners.push(listener);
    return {
      remove: () => {
        const idx = notificationListeners.indexOf(listener);
        if (idx !== -1) notificationListeners.splice(idx, 1);
      },
    };
  }),
  addNotificationResponseReceivedListener: jest.fn((listener) => {
    responseListeners.push(listener);
    return {
      remove: () => {
        const idx = responseListeners.indexOf(listener);
        if (idx !== -1) responseListeners.splice(idx, 1);
      },
    };
  }),
  __simulateResponse: (actionIdentifier, contentData) => {
    responseListeners.forEach((fn) =>
      fn({
        actionIdentifier,
        notification: {
          request: {
            content: {
              data: contentData,
            },
          },
        },
      })
    );
  },
};
