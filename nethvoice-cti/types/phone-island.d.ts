declare module '@nethesis/phone-island' {
  export interface PhoneIslandProps {
    dataConfig: string;
    uaType: 'desktop' | 'mobile';
    preferredSummaryExtensionType?: 'webrtc';
    screenShareRoomCreation?: 'direct' | 'middleware';
  }

  export const PhoneIsland: React.FC<PhoneIslandProps>;
}
