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
        raw: 'NotificationRecord(pkg=com.example.clock title=Morning alarm, text=07:30, channel=alarm)',
      },
    ]);
  });
});
