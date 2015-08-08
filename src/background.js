chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('index.html', {
    'outerBounds': {
      'width': 500,
      'height': 600
    }
  });
});
chrome.alarms.onAlarm.addListener(function(alarm ) {
  chrome.notifications.create('task-done', {
    type: 'basic',
    iconUrl: 'calculator-128.png',
    title: 'Task done',
    message: 'Taks is done, holo yolo',
    priority: 2,
  })
  navigator.vibrate([100, 100, 100, 300, 300])
});
