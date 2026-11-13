import { isEmpty } from 'lodash';

/**
 * Filters the devices list based on conditions for displaying in device menu
 * @param devices Array of devices
 * @param defaultDevice Current default device
 * @param phoneLinkData PhoneLink device data
 * @param operatorsStore Operators store data
 * @returns Filtered devices array
 */
export function filterDevicesForMenu(devices: any[], defaultDevice: any, phoneLinkData: any[], operatorsStore: any) {
  return devices
    .sort((a: any, b: any) => {
      const order = ['webrtc', 'nethlink', 'physical'];
      return order.indexOf(a.type) - order.indexOf(b.type);
    })
    .filter((device: any) => {
      const defaultType = defaultDevice?.type;
      
      // Hide webrtc if there is a nethlink device or nethlink device is the default one
      if (defaultType === 'webrtc' && device?.type === 'nethlink') {
        return false;
      }
      
      // Hide webrtc if physical is default and there's an online phonelink device
      if (defaultType === 'physical' && 
          device?.type === 'webrtc' && 
          phoneLinkData?.length >= 1 && 
          phoneLinkData[0]?.id !== '' && 
          !isEmpty(operatorsStore) && 
          operatorsStore?.extensions[phoneLinkData[0]?.id]?.status === 'online') {
        return false;
      }
      
      // Hide nethlink if webrtc is default
      if (defaultType === 'nethlink' && device?.type === 'webrtc') {
        return false;
      }
      
      // Hide nethlink if physical is default and nethlink device is offline
      if (defaultType === 'physical' && 
          device?.type === 'nethlink' && 
          phoneLinkData?.length >= 1 && 
          device?.id !== '' && 
          !isEmpty(operatorsStore) && 
          operatorsStore?.extensions[device?.id]?.status === 'offline') {
        return false;
      }
      
      return true;
    });
}

/**
 * Get icon for device type
 * @param deviceType Type of the device
 * @returns Icon name for the device type
 */
export function getDeviceTypeIcon(deviceType: string) {
  switch (deviceType) {
    case 'webrtc':
      return 'faHeadset';
    case 'physical':
      return 'faOfficePhone';
    case 'nethlink':
      return 'faDesktop';
    default:
      return 'faHeadset';
  }
}
