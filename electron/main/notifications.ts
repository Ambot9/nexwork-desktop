import { Notification } from 'electron'

export function showNotification(title: string, body: string) {
  if (!Notification.isSupported()) {
    console.log('Notifications are not supported on this system')
    return
  }

  const notification = new Notification({
    title,
    body,
    icon: undefined // TODO: Add icon path
  })

  notification.show()
}

export function notifyFeatureCreated(featureName: string) {
  showNotification(
    'Feature Created',
    `${featureName} has been created successfully`
  )
}

export function notifyFeatureCompleted(featureName: string) {
  showNotification(
    'Feature Completed',
    `${featureName} is now complete!`
  )
}

export function notifyProjectStatusChanged(
  featureName: string,
  projectName: string,
  newStatus: string
) {
  showNotification(
    'Project Status Updated',
    `${projectName} in ${featureName} is now ${newStatus}`
  )
}
