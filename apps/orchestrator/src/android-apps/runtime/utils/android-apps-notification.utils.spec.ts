import { parseAndroidNotifications } from './android-apps-notification.utils';

describe('android notification utils', () => {
  it('parses multiline cmd notification output with extras', () => {
    const notifications = parseAndroidNotifications(
      `Notification List:\n  NotificationRecord(0x1: pkg=com.google.android.deskclock user=UserHandle{0} id=7 tag=null importance=4 key=0|com.google.android.deskclock|7|null|10101: Notification(channel=alarm))\n    android.title=Alarm\n    android.text=Weekday wake up\n    tickerText=Alarm`,
    );

    expect(notifications).toEqual([
      {
        packageName: 'com.google.android.deskclock',
        title: 'Alarm',
        text: 'Weekday wake up',
        appName: null,
        raw: [
          'NotificationRecord(0x1: pkg=com.google.android.deskclock user=UserHandle{0} id=7 tag=null importance=4 key=0|com.google.android.deskclock|7|null|10101: Notification(channel=alarm))',
          'android.title=Alarm',
          'android.text=Weekday wake up',
          'tickerText=Alarm',
        ].join('\n'),
      },
    ]);
  });

  it('falls back to single-line notification entries', () => {
    const notifications = parseAndroidNotifications(
      'NotificationRecord(pkg=com.example.clock title=Morning alarm, text=07:30, channel=alarm)',
    );

    expect(notifications).toEqual([
      {
        packageName: 'com.example.clock',
        title: 'Morning alarm',
        text: '07:30',
        appName: null,
        raw: 'NotificationRecord(pkg=com.example.clock title=Morning alarm, text=07:30, channel=alarm)',
      },
    ]);
  });

  it('unwraps typed Android extras instead of displaying their debug representation', () => {
    const notifications = parseAndroidNotifications(
      `NotificationRecord(pkg=com.example.messages)\n  android.title=String (New message)\n  android.text=CharSequence (Hello there)`,
    );

    expect(notifications[0]).toMatchObject({
      title: 'New message',
      text: 'Hello there',
    });
  });

  it('drops clock audio metadata records without user-facing notification content', () => {
    const notifications = parseAndroidNotifications(
      `NotificationRecord(pkg=com.android.deskclock id=1)\n  audioAttributes=AudioAttributes: usage=USAGE_ALARM content=CONTENT_TYPE_SONIFICATION flags=0x800 tags= bundle=null\nNotificationRecord(pkg=com.android.deskclock id=2)\n  android.title=String (Upcoming alarm)\n  android.text=String (Sun 9:35 AM)`,
    );

    expect(notifications).toEqual([
      expect.objectContaining({
        packageName: 'com.android.deskclock',
        title: 'Upcoming alarm',
        text: 'Sun 9:35 AM',
      }),
    ]);
  });
});
