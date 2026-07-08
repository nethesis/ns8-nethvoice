declare module '@nethesis/phone-island' {
  export interface PhoneIslandProps {
    dataConfig: string;
    uaType: 'desktop' | 'mobile';
    preferredSummaryExtensionType?: 'webrtc';
  }

  export const PhoneIsland: React.FC<PhoneIslandProps>;
}
